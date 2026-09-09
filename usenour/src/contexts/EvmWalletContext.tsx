import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
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
  connect: (email: string) => Promise<void>;
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

  // Only restore connection on mount IF the user previously chose to connect in this session
  useEffect(() => {
    const savedWallet = localStorage.getItem("nour_connected_wallet");
    if (!savedWallet) return;

    if (savedWallet === "injected") {
      const injectedConnector = connectors.find(c => c.id === "injected");
      if (injectedConnector) {
        connectAsync({ connector: injectedConnector }).catch(() => {
          localStorage.removeItem("nour_connected_wallet");
        });
      }
    } else if (savedWallet === "magic") {
      const magicConnector = connectors.find(c => c.id === "magic" || c.name.toLowerCase().includes("magic"));
      if (magicConnector) {
        connectAsync({ connector: magicConnector }).catch(() => {
          localStorage.removeItem("nour_connected_wallet");
        });
      }
    }
  }, [connectAsync, connectors]);

  const connect = useCallback(async (email: string) => {
    if (!magic) throw new Error("Magic not initialized");
    setInternalConnecting(true);
    try {
      await magic.auth.loginWithMagicLink({ email });
      const connector = connectors.find(c => c.id === 'magic' || c.name.toLowerCase().includes('magic'));
      if (connector) {
        await connectAsync({ connector });
        localStorage.setItem("nour_connected_wallet", "magic");
      }
    } finally {
      setInternalConnecting(false);
    }
  }, [connectAsync, connectors]);

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
      connect,
      connectInjected,
      claimFaucet,
      refreshBalance,
      disconnect,
    }),
    [address, isConnected, isConnecting, isReconnecting, isStuck, internalConnecting, isAuthenticated, collateralBalance, walletProvider, connect, connectInjected, claimFaucet, refreshBalance, disconnect]
  );

  return <EvmWalletContext.Provider value={value}>{children}</EvmWalletContext.Provider>;
};
