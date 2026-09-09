import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { Magic } from "magic-sdk";
import { clearAuthToken, getAuthToken, setAuthToken } from "../services/auth";
import { getCollateralBalance, claimTestnetFaucet } from "../services/dreamdex";

const MAGIC_KEY = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY?.trim();
const SOMNIA_RPC = import.meta.env.VITE_SOMNIA_RPC_URL || "https://50312.rpc.thirdweb.com";

// Initialize Magic on Somnia Shannon Testnet via Thirdweb RPC (whitelisted in Magic CSP connect-src)
export const magic = typeof window !== "undefined" && MAGIC_KEY ? new Magic(MAGIC_KEY, {
  network: {
    rpcUrl: SOMNIA_RPC,
    chainId: 50312,
  },
}) : null;

interface EvmWalletContextType {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  authenticated: boolean;
  collateralBalance: number;
  walletProvider: any;
  emailOtpSent: boolean;
  emailOtpError: string;
  startEmailLogin: (email: string) => Promise<void>;
  verifyEmailOtp: (code: string) => Promise<void>;
  cancelEmailLogin: () => void;
  connectInjected: () => Promise<void>;
  claimFaucet: () => Promise<string>;
  refreshBalance: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const EvmWalletContext = createContext<EvmWalletContextType | null>(null);

export const useEvmWallet = () => {
  const ctx = useContext(EvmWalletContext);
  if (!ctx) throw new Error("useEvmWallet must be used within EvmWalletProvider");
  return ctx;
};

export const EvmWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected, isConnecting, isReconnecting, connector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { connectAsync, connectors } = useConnect();
  
  const [internalConnecting, setInternalConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAuthToken());
  const [collateralBalance, setCollateralBalance] = useState<number>(0);
  const [isStuck, setIsStuck] = useState(false);
  const [walletProvider, setWalletProvider] = useState<any>(null);

  // Headless email OTP login state
  const otpHandleRef = useRef<any>(null);
  const otpResolveRef = useRef<(() => void) | null>(null);
  const otpRejectRef = useRef<((err: Error) => void) | null>(null);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState("");

  // Dynamically resolve active wallet provider (MetaMask / Injected / Magic)
  useEffect(() => {
    let isCurrent = true;
    async function resolveProvider() {
      if (!isConnected) {
        setWalletProvider(null);
        return;
      }
      try {
        if (connector && typeof connector.getProvider === "function") {
          const p = await connector.getProvider();
          if (isCurrent && p) {
            setWalletProvider(p);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not get provider from connector:", err);
      }
      if (typeof window !== "undefined" && (window as any).ethereum) {
        if (isCurrent) setWalletProvider((window as any).ethereum);
      } else if (magic && magic.rpcProvider) {
        if (isCurrent) setWalletProvider(magic.rpcProvider);
      }
    }
    resolveProvider();
    return () => { isCurrent = false; };
  }, [isConnected, connector]);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setCollateralBalance(0);
      return;
    }
    try {
      const bal = await getCollateralBalance(address);
      setCollateralBalance(bal);
    } catch {
      setCollateralBalance(0);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      setAuthToken(`auth-${address}`, address);
      setIsAuthenticated(true);
      refreshBalance();
    } else {
      clearAuthToken();
      setIsAuthenticated(false);
      setCollateralBalance(0);
    }
  }, [isConnected, address, refreshBalance]);

  useEffect(() => {
    if (isConnecting || isReconnecting) {
      const timer = setTimeout(() => setIsStuck(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsStuck(false);
    }
  }, [isConnecting, isReconnecting]);

  // Restore the previous session on mount — silently, without any popups.
  // 1. Injected wallet: probe `eth_accounts` (never prompts); connect only if
  //    the wallet is already authorized and unlocked.
  // 2. Magic email: probe `magic.user.isLoggedIn()` directly and only then
  //    attach the connector — this also survives a lost/cleared
  //    `nour_connected_wallet` flag, and avoids the connector falling back to
  //    its login modal when the Magic session has expired.
  useEffect(() => {
    let cancelled = false;

    const findInjected = () => connectors.find(c => c.id === "injected");
    const findMagic = () =>
      connectors.find(c => c.id === "magic" || c.name.toLowerCase().includes("magic"));

    const restoreInjected = async (): Promise<boolean> => {
      const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
      const connector = findInjected();
      if (!eth?.request || !connector) return false;
      try {
        // Silent read — never triggers a wallet popup
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        if (cancelled || !accounts?.length) return false;
        await connectAsync({ connector });
        if (!cancelled) localStorage.setItem("nour_connected_wallet", "injected");
        return true;
      } catch {
        return false;
      }
    };

    const restoreMagic = async (): Promise<boolean> => {
      if (!magic) return false;
      const connector = findMagic();
      if (!connector) return false;
      try {
        // Silent session check — if false, the connector would otherwise open
        // its login modal and hang forever, so we bail out early instead.
        const loggedIn = await magic.user.isLoggedIn();
        if (cancelled || !loggedIn) {
          if (!loggedIn) localStorage.removeItem("nour_connected_wallet");
          return false;
        }
        await connectAsync({ connector });
        if (!cancelled) localStorage.setItem("nour_connected_wallet", "magic");
        return true;
      } catch {
        // Transient failures (RPC/network) keep the flag for the next reload;
        // the flag is only removed when the session is genuinely gone (above).
        return false;
      }
    };

    (async () => {
      const saved = localStorage.getItem("nour_connected_wallet");
      if (saved === "injected") {
        if (await restoreInjected()) return;
      } else if (saved === "magic") {
        if (await restoreMagic()) return;
      }
      // Fallbacks: the flag can be missing (cleared/partitioned storage) even
      // though a session is still alive — probe Magic, then injected.
      if (await restoreMagic()) return;
      await restoreInjected();
    })();

    return () => { cancelled = true; };
  }, [connectAsync, connectors]);

  // Shared: attach the Wagmi Magic connector after Magic auth succeeds
  const connectWithMagicConnector = useCallback(async () => {
    const connector = connectors.find(c => c.id === 'magic' || c.name.toLowerCase().includes('magic'));
    if (connector) {
      await connectAsync({ connector });
      localStorage.setItem("nour_connected_wallet", "magic");
    }
  }, [connectAsync]);

  // Headless email login: sends a 6-digit code WITHOUT Magic's prebuilt UI.
  // Resolves once the code has been delivered (or immediately if the login
  // completes without an OTP challenge, e.g. a remembered device).
  const startEmailLogin = useCallback((email: string) => {
    return new Promise<void>((resolve, reject) => {
      if (!magic) { reject(new Error("Magic not initialized")); return; }
      setEmailOtpError("");
      setEmailOtpSent(false);

      const handle: any = magic.auth.loginWithEmailOTP({ email, showUI: false });
      otpHandleRef.current = handle;
      let startSettled = false;

      handle.on("email-otp-sent", () => {
        if (!startSettled) {
          startSettled = true;
          setEmailOtpSent(true);
          resolve();
        }
      });

      const fail = (message: string, fatal: boolean) => {
        setEmailOtpError(message);
        if (fatal) {
          otpHandleRef.current = null;
          setEmailOtpSent(false);
          const err = new Error(message);
          otpRejectRef.current?.(err);
          otpResolveRef.current = null;
          otpRejectRef.current = null;
          if (!startSettled) { startSettled = true; reject(err); }
        } else {
          // Invalid code: reject the pending verify attempt so the UI
          // re-enables input; the same handle stays valid for a retry.
          const err = new Error(message);
          otpRejectRef.current?.(err);
          otpResolveRef.current = null;
          otpRejectRef.current = null;
        }
      };

      handle.on("invalid-email-otp", () => fail("Invalid code. Please try again.", false));
      handle.on("expired-email-otp", () => fail("Your code expired. Please request a new one.", true));
      handle.on("max-email-otp-attempts-exceeded", () => fail("Too many attempts. Please request a new code.", true));

      handle.then(async () => {
        otpHandleRef.current = null;
        try {
          await connectWithMagicConnector();
          setEmailOtpSent(false);
          otpResolveRef.current?.();
        } catch (err: any) {
          setEmailOtpSent(false);
          otpRejectRef.current?.(new Error(err?.message || "Signed in, but failed to start wallet session."));
        } finally {
          otpResolveRef.current = null;
          otpRejectRef.current = null;
          if (!startSettled) { startSettled = true; resolve(); }
        }
      }).catch((err: any) => {
        otpHandleRef.current = null;
        setEmailOtpSent(false);
        const e = new Error(err?.message || "Email login failed");
        otpRejectRef.current?.(e);
        otpResolveRef.current = null;
        otpRejectRef.current = null;
        if (!startSettled) { startSettled = true; reject(e); }
      });
    });
  }, [connectWithMagicConnector]);

  // Verifies the user-entered 6-digit code against the pending login handle.
  const verifyEmailOtp = useCallback((code: string) => {
    return new Promise<void>((resolve, reject) => {
      const handle = otpHandleRef.current;
      if (!handle) {
        reject(new Error("No login in progress. Please request a new code."));
        return;
      }
      setEmailOtpError("");
      otpResolveRef.current = resolve;
      otpRejectRef.current = reject;
      handle.emit("verify-email-otp", code.trim());
    });
  }, []);

  // Aborts an in-flight email login (Back button) and cleans all state.
  const cancelEmailLogin = useCallback(() => {
    otpHandleRef.current = null;
    otpResolveRef.current = null;
    otpRejectRef.current = null;
    setEmailOtpSent(false);
    setEmailOtpError("");
  }, []);

  const connectInjected = useCallback(async () => {
    setInternalConnecting(true);
    try {
      const connector = connectors.find(c => c.id === 'injected');
      if (connector) {
        await connectAsync({ connector });
        localStorage.setItem("nour_connected_wallet", "injected");
      }
    } finally {
      setInternalConnecting(false);
    }
  }, [connectAsync, connectors]);

  const claimFaucet = useCallback(async () => {
    if (!address) throw new Error("Please connect your wallet first");

    let p = walletProvider;
    if (!p && connector && typeof connector.getProvider === "function") {
      try { p = await connector.getProvider(); } catch {}
    }
    if (!p && typeof window !== "undefined" && (window as any).ethereum) {
      p = (window as any).ethereum;
    }
    if (!p && magic && magic.rpcProvider) {
      p = magic.rpcProvider;
    }
    if (!p) throw new Error("No active wallet provider found. Please connect MetaMask or log in.");

    const tx = await claimTestnetFaucet(p, 1000);
    await refreshBalance();
    return tx;
  }, [address, walletProvider, connector, refreshBalance]);

  const disconnect = useCallback(async () => {
    localStorage.removeItem("nour_connected_wallet");
    localStorage.removeItem("nour-auth-address");
    try {
      localStorage.removeItem("wagmi.store");
      localStorage.removeItem("wagmi.recentConnectorId");
      localStorage.removeItem("injected.connected");
      localStorage.removeItem("injected.disconnected");
    } catch {}
    if (magic) {
      try { await magic.user.logout(); } catch {}
    }
    clearAuthToken();
    await disconnectAsync();
  }, [disconnectAsync]);

  const value = useMemo(
    () => ({
      address: isConnected && address ? address : null,
      connected: isConnected && !!address,
      connecting: ((isConnecting || isReconnecting) && !isStuck) || internalConnecting,
      authenticated: isAuthenticated,
      collateralBalance,
      walletProvider,
      emailOtpSent,
      emailOtpError,
      startEmailLogin,
      verifyEmailOtp,
      cancelEmailLogin,
      connectInjected,
      claimFaucet,
      refreshBalance,
      disconnect,
    }),
    [address, isConnected, isConnecting, isReconnecting, isStuck, internalConnecting, isAuthenticated, collateralBalance, walletProvider, emailOtpSent, emailOtpError, startEmailLogin, verifyEmailOtp, cancelEmailLogin, connectInjected, claimFaucet, refreshBalance, disconnect]
  );

  return <EvmWalletContext.Provider value={value}>{children}</EvmWalletContext.Provider>;
};
