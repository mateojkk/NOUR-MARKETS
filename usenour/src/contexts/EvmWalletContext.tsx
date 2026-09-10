import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAccount, useDisconnect, useConnect } from "wagmi";
import { Magic } from "magic-sdk";
import { clearAuthToken, getAuthToken, setAuthToken, syncBackendSession, deleteBackendSession } from "../services/auth";
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
  restoring: boolean;
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
  const [isRestoring, setIsRestoring] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      localStorage.getItem("nour_connected_wallet") ||
      localStorage.getItem("nour_session_token") ||
      localStorage.getItem("nour-auth-address")
    );
  });
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
      const method = (localStorage.getItem("nour_connected_wallet") as "magic" | "injected") || "injected";
      setAuthToken(`auth-${address}`, address);
      setIsAuthenticated(true);
      refreshBalance();
      syncBackendSession(address, method).catch(() => {});
    } else if (!isRestoring && !internalConnecting && !isConnecting && !isReconnecting) {
      const hasSavedSession = Boolean(
        typeof window !== "undefined" &&
        (localStorage.getItem("nour_connected_wallet") || localStorage.getItem("nour_session_token"))
      );
      if (!hasSavedSession) {
        clearAuthToken();
        setIsAuthenticated(false);
        setCollateralBalance(0);
      }
    }
  }, [isConnected, address, isRestoring, internalConnecting, isConnecting, isReconnecting, refreshBalance]);

  useEffect(() => {
    if (isConnecting || isReconnecting) {
      const timer = setTimeout(() => setIsStuck(true), 5000);
      return () => clearTimeout(timer);
    } else {
      setIsStuck(false);
    }
  }, [isConnecting, isReconnecting]);

  // Restore the previous session on mount — silently, without any popups.
  // Magic's hidden login iframe can take a moment to boot on a cold page
  // load, so probes are RETRIED until the SDK gives a definitive answer.
  // A timeout/exception is "indeterminate — try again", NOT "logged out".
  useEffect(() => {
    let cancelled = false;

    const log = (...args: any[]) => console.info("[nour:restore]", ...args);

    // Bounded promise timeout to avoid hanging on slow network or blocked iframes
    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        ),
      ]);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const findInjected = () => connectors.find((c) => c.id === "injected");
    const findMagic = () =>
      connectors.find((c) => c.id === "magic" || c.name.toLowerCase().includes("magic"));

    const restoreInjected = async (): Promise<boolean> => {
      const delays = [0, 600, 1500];
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return false;
        if (delays[i]) await sleep(delays[i]);
        if (cancelled) return false;
        const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
        const connector = findInjected();
        if (!eth?.request || !connector) continue;
        try {
          // Silent read — never triggers a wallet popup
          const accounts: string[] = await withTimeout(
            eth.request({ method: "eth_accounts" }),
            3000,
            "eth_accounts"
          );
          if (cancelled) return false;
          if (accounts?.length) {
            await connectAsync({ connector });
            if (!cancelled) localStorage.setItem("nour_connected_wallet", "injected");
            log("restored session via browser wallet");
            return true;
          }
          log("injected probe attempt", i + 1, "found no active accounts, will retry if intervals remain");
        } catch (err: any) {
          log("injected probe indeterminate, will retry:", err?.message || err);
        }
      }
      return false;
    };

    const restoreMagic = async (): Promise<boolean> => {
      if (!magic) {
        log("Magic SDK not initialized (missing VITE_MAGIC_PUBLISHABLE_KEY?)");
        return false;
      }
      const connector = findMagic();
      if (!connector) return false;
      const delays = [0, 800, 1600];
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return false;
        if (delays[i]) await sleep(delays[i]);
        if (cancelled) return false;
        try {
          const loggedIn = await withTimeout(magic.user.isLoggedIn(), 3500, "magic.user.isLoggedIn");
          log("magic session alive?", loggedIn, `(attempt ${i + 1}/${delays.length})`);
          if (cancelled) return false;
          if (loggedIn) {
            await connectAsync({ connector });
            if (!cancelled) localStorage.setItem("nour_connected_wallet", "magic");
            log("restored session via Magic email login");
            return true;
          }
        } catch (err: any) {
          log("Magic probe indeterminate (iframe still booting?), will retry:", err?.message || err);
        }
      }
      return false;
    };

    (async () => {
      const saved = localStorage.getItem("nour_connected_wallet");
      log("saved flag:", saved ?? "(none)");
      const magicAvailable = !!magic && !!findMagic();
      const injectedAvailable =
        typeof window !== "undefined" && !!(window as any).ethereum && !!findInjected();

      if (!magicAvailable && !injectedAvailable) {
        log("no session providers available");
        setIsRestoring(false);
        return;
      }

      setIsRestoring(true);
      try {
        if (saved === "injected" && (await restoreInjected())) return;
        if (saved === "magic" && (await restoreMagic())) return;
        // Fallbacks: probe Magic, then injected
        if (await restoreMagic()) return;
        if (await restoreInjected()) return;
        log("no live session found — clearing stale state");
        localStorage.removeItem("nour_connected_wallet");
        clearAuthToken();
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
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
    await deleteBackendSession().catch(() => {});
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
      restoring: isRestoring,
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
    [address, isConnected, isConnecting, isReconnecting, isStuck, isRestoring, internalConnecting, isAuthenticated, collateralBalance, walletProvider, emailOtpSent, emailOtpError, startEmailLogin, verifyEmailOtp, cancelEmailLogin, connectInjected, claimFaucet, refreshBalance, disconnect]
  );

  return <EvmWalletContext.Provider value={value}>{children}</EvmWalletContext.Provider>;
};
