import React, { useState } from "react";
import {
  Droplets,
  Wallet,
  ExternalLink,
  Check,
  Copy,
  RefreshCw,
  Coins,
  ShieldCheck,
  Fuel,
} from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import WalletActions from "./WalletActions";
import "./FaucetPage.css";

const FaucetPage: React.FC = () => {
  const {
    address,
    connected,
    collateralBalance,
    refreshBalance,
    claimFaucet,
  } = useEvmWallet();

  const [claiming, setClaiming] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const walletAddress = address || null;

  const handleCopy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBalance();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  const handleClaim = async () => {
    if (!connected || !walletAddress) return;
    setClaiming(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const txHash = await claimFaucet();
      setSuccessMsg(
        `Successfully claimed 1,000 tUSDC! (Tx: ${txHash ? txHash.slice(0, 10) + "..." : "confirmed"})`
      );
      await refreshBalance();
    } catch (err: any) {
      setErrorMsg(err?.reason || err?.message || "Failed to claim testnet collateral");
    } finally {
      setClaiming(false);
    }
  };

  if (!connected) {
    return (
      <div className="faucet-page-container">
        <div className="faucet-empty-card">
          <div className="empty-icon-wrap">
            <Wallet size={40} />
          </div>
          <h3>Connect Your Wallet</h3>
          <p>
            Connect your Web3 wallet or log in with your email to claim free Somnia Shannon
            testnet collateral (tUSDC).
          </p>
        </div>
      </div>
    );
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  return (
    <div className="faucet-page-container">
      {/* Header */}
      <div className="faucet-header">
        <div>
          <h1>Testnet Faucet</h1>
          <p className="faucet-subtitle">
            Mint free testnet collateral to trade live binary event contracts on Somnia Shannon Testnet.
          </p>
        </div>
        <button
          className={`faucet-refresh-btn ${refreshing ? "spinning" : ""}`}
          onClick={handleRefresh}
          title="Refresh collateral balance"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Account & Balance Bar */}
      <div className="faucet-account-card">
        <div className="account-info">
          <div className="account-row">
            <span className="account-label">Wallet Address:</span>
            <button className="faucet-chip" onClick={handleCopy} title="Click to copy">
              <span>{shortAddress}</span>
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </button>
          </div>
          <div className="account-row">
            <span className="account-label">Network:</span>
            <span className="network-pill">
              <span className="network-dot" />
              Somnia Shannon (50312)
            </span>
          </div>
        </div>

        <div className="balance-highlight">
          <span className="balance-label">CURRENT tUSDC BALANCE</span>
          <span className="balance-amount">
            ${collateralBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="balance-unit"> tUSDC</span>
          </span>
        </div>
      </div>

      {/* Main Claim Card */}
      <div className="faucet-main-card">
        <div className="card-top">
          <div className="faucet-badge">
            <Coins size={24} />
          </div>
          <div className="card-top-info">
            <h2>Claim 1,000 tUSDC Collateral</h2>
            <p>
              Receive instant on-chain testnet collateral tokens directly into your wallet. You can claim multiple times if you run low.
            </p>
          </div>
        </div>

        <div className="card-actions">
          <button
            className="claim-btn"
            onClick={handleClaim}
            disabled={claiming}
          >
            <Droplets size={18} />
            <span>{claiming ? "Minting tUSDC on Somnia..." : "Claim 1,000 Free tUSDC"}</span>
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMsg && (
          <div className="faucet-alert error">
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="faucet-alert success">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Gas Requirement Card */}
      <div className="faucet-gas-card">
        <div className="gas-card-left">
          <div className="gas-icon-wrap">
            <Fuel size={20} />
          </div>
          <div>
            <h3>Need Native STT Gas?</h3>
            <p>
              Transactions on Somnia require a small amount of native <strong>STT</strong> for network gas fees.
            </p>
          </div>
        </div>
        <a
          href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
          target="_blank"
          rel="noopener noreferrer"
          className="gas-link-btn"
        >
          <span>Google Cloud Somnia Faucet</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Wallet Actions / Deposit Simulation */}
      {walletAddress && (
        <div className="faucet-wallet-actions">
          <h3 className="section-title">
            <ShieldCheck size={18} />
            <span>Collateral Management</span>
          </h3>
          <WalletActions
            walletAddress={walletAddress}
            usdcBalance={collateralBalance}
            onTransactionComplete={refreshBalance}
          />
        </div>
      )}
    </div>
  );
};

export default FaucetPage;
