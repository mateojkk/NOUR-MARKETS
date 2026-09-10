import React, { useState } from "react";
import {
  Droplets,
  ExternalLink,
  Check,
  RefreshCw,
  Loader2,
  Wallet,
} from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
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
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBalance();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleClaim = async () => {
    if (!connected || !address) return;
    setClaiming(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await claimFaucet();
      setSuccessMsg("Claimed 1,000 tUSDC successfully");
      await refreshBalance();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setErrorMsg(err?.reason || err?.message || "Failed to claim tUSDC");
    } finally {
      setClaiming(false);
    }
  };

  if (!connected) {
    return (
      <div className="faucet-page-container">
        <div className="faucet-card empty">
          <Wallet size={36} className="faucet-empty-icon" />
          <h2>Connect Wallet</h2>
          <p>Connect your wallet to claim testnet collateral.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="faucet-page-container">
      <div className="faucet-card">
        {/* Card Header: Title & Balance */}
        <div className="faucet-card-header">
          <div className="faucet-title-group">
            <div className="faucet-icon-wrap">
              <Droplets size={18} />
            </div>
            <h2>Testnet Faucet</h2>
          </div>

          <div className="faucet-balance-badge">
            <span className="balance-label">Balance</span>
            <span className="balance-val">
              ${collateralBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="balance-token"> tUSDC</span>
            </span>
            <button
              className={`faucet-refresh-btn ${refreshing ? "spinning" : ""}`}
              onClick={handleRefresh}
              title="Refresh balance"
              aria-label="Refresh balance"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Card Body: Amount & Action */}
        <div className="faucet-body">
          <div className="faucet-amount-hero">
            <span className="amount-number">1,000</span>
            <span className="amount-label">tUSDC</span>
          </div>

          <button
            className="faucet-claim-btn"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? (
              <>
                <Loader2 size={16} className="spinning" />
                <span>Minting tUSDC...</span>
              </>
            ) : (
              <>
                <Droplets size={16} />
                <span>Claim 1,000 tUSDC</span>
              </>
            )}
          </button>

          {/* Feedback messages */}
          {successMsg && (
            <div className="faucet-status-msg success">
              <Check size={14} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="faucet-status-msg error">
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Card Footer: Compact Gas Link */}
        <div className="faucet-footer">
          <span>Need testnet gas?</span>
          <a
            href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
            target="_blank"
            rel="noopener noreferrer"
            className="gas-link"
          >
            <span>Get Somnia STT</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default FaucetPage;
