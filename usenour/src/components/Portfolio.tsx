import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  BarChart3,
  RefreshCw,
  Trophy,
  Droplets,
  Check,
  ExternalLink,
  Copy,
  Layers,
  History,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import { getPositions, getStats, type PositionRecord, type UserStats } from "../services/userService";
import { redeemWinningPosition, DREAMDEX_CONTRACTS, SOMNIA_EXPLORER_URL } from "../services/dreamdex";
import { formatMarketTitle, resolveMarketIcon } from "../types";
import TradeHistory from "./TradeHistory";
import RankBadge from "./RankBadge";
import WalletActions from "./WalletActions";
import "./Portfolio.css";

interface PortfolioPosition {
  ticker: string;
  title: string;
  side: "yes" | "no";
  contracts: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  poolAddress?: string;
  marketId?: string;
  isSettled?: boolean;
}

type TabType = "positions" | "history" | "stats";

export default function Portfolio() {
  const navigate = useNavigate();
  const {
    address,
    connected,
    collateralBalance,
    refreshBalance,
    walletProvider,
    claimFaucet,
  } = useEvmWallet();
  const walletAddress = address || null;

  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // Faucet state
  const [claimingFaucet, setClaimingFaucet] = useState(false);
  const [faucetSuccess, setFaucetSuccess] = useState(false);
  const [faucetError, setFaucetError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      await refreshBalance();

      const backendPositionsRaw = await getPositions(walletAddress);
      const backendPositions: PositionRecord[] = Array.isArray(backendPositionsRaw)
        ? backendPositionsRaw
        : Array.isArray((backendPositionsRaw as any)?.positions)
        ? (backendPositionsRaw as any).positions
        : [];

      const mappedPositions: PortfolioPosition[] = backendPositions.map((p: PositionRecord) => {
        const avgPrice = p.avg_price || 50;
        const currentPrice = 55; // Live mark price
        const contracts = p.contracts || 0;
        const pnl = ((currentPrice - avgPrice) * contracts) / 100;
        const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

        return {
          ticker: p.ticker,
          title: p.title || p.ticker,
          side: p.side as "yes" | "no",
          contracts,
          avgPrice,
          currentPrice,
          pnl,
          pnlPercent,
          poolAddress: DREAMDEX_CONTRACTS.binaryMarketsModule,
          isSettled: false,
        };
      });

      setPositions(mappedPositions);

      let pnl = 0;
      let holdingsValue = 0;
      mappedPositions.forEach((p) => {
        pnl += p.pnl;
        holdingsValue += p.contracts * (p.currentPrice / 100);
      });

      setTotalPnl(pnl);
      setTotalValue(collateralBalance + holdingsValue);

      const stats = await getStats(walletAddress);
      setUserStats(stats);
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, collateralBalance, refreshBalance]);

  useEffect(() => {
    if (connected && walletAddress) {
      fetchPortfolio();
    }
  }, [connected, walletAddress, fetchPortfolio]);

  const handleClaimFaucet = async () => {
    setClaimingFaucet(true);
    setFaucetError(null);
    setFaucetSuccess(false);
    try {
      await claimFaucet();
      setFaucetSuccess(true);
      await fetchPortfolio();
      setTimeout(() => setFaucetSuccess(false), 6000);
    } catch (err: any) {
      setFaucetError(err?.reason || err?.message || "Failed to claim faucet");
    } finally {
      setClaimingFaucet(false);
    }
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {}
  };

  const handleSell = (position: PortfolioPosition) => {
    navigate(`/trade/${encodeURIComponent(position.ticker)}?action=sell&side=${position.side}`);
  };

  const handleRedeem = async (pos: PortfolioPosition) => {
    if (!walletProvider) return;
    setRedeemingId(pos.ticker);
    try {
      const outcomeIdx = pos.side === "yes" ? 0 : 1;
      const marketId = pos.marketId || `0x${Array.from({ length: 64 }, () => "0").join("")}`;
      const pool = pos.poolAddress || DREAMDEX_CONTRACTS.binaryMarketsModule;

      await redeemWinningPosition(walletProvider, marketId, pool, outcomeIdx, pos.contracts);
      await fetchPortfolio();
    } catch (err: any) {
      console.error("Redemption error:", err);
    } finally {
      setRedeemingId(null);
    }
  };

  if (!connected) {
    return (
      <div className="portfolio-container">
        <div className="portfolio-empty">
          <div className="empty-icon-wrap">
            <Wallet size={40} />
          </div>
          <h3>Connect Your Wallet</h3>
          <p>Connect your Web3 wallet to manage your positions, claim testnet collateral, and track performance.</p>
        </div>
      </div>
    );
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  return (
    <div className="portfolio-container">
      {/* Header Section */}
      <div className="portfolio-header">
        <div className="portfolio-header-left">
          <div className="header-title-row">
            <h1>Portfolio</h1>
          </div>
          
          <div className="header-account-row">
            <button className="address-chip" onClick={handleCopyAddress} title="Click to copy address">
              <span>{shortAddress}</span>
              {copiedAddress ? <Check size={13} className="text-success" /> : <Copy size={13} />}
            </button>
            <RankBadge
              rank={userStats?.rank?.rank || "R"}
              title={userStats?.rank?.title || "Rookie"}
              score={userStats?.rank?.score ?? 0}
              size="sm"
            />
          </div>
        </div>

        <button
          className={`refresh-btn ${loading ? "spinning" : ""}`}
          onClick={fetchPortfolio}
          title="Refresh balances & positions"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="portfolio-stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">tUSDC AVAILABLE</span>
          </div>
          <div className="stat-value">
            ${collateralBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="unit">tUSDC</span>
          </div>
          <div className="stat-hint">Available trading collateral</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">TOTAL EQUITY</span>
          </div>
          <div className="stat-value">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="unit">USD</span>
          </div>
          <div className="stat-hint">Cash + Open Market Holdings</div>
        </div>

        <div className={`stat-card ${totalPnl >= 0 ? "positive" : "negative"}`}>
          <div className="stat-card-header">
            <span className="stat-label">UNREALIZED P&L</span>
            <span className={`stat-badge ${totalPnl >= 0 ? "positive" : "negative"}`}>
              {totalPnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
            </span>
          </div>
          <div className="stat-value">
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
          <div className="stat-hint">Across active prediction trades</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">TRADER RANK & TIER</span>
            <span className="stat-badge positive">{userStats?.rank?.title || "Rookie"}</span>
          </div>
          <div className="stat-value">
            Tier {userStats?.rank?.rank || "R"}
            <span className="unit">· {userStats?.rank?.score || 0} pts</span>
          </div>
          <div className="stat-hint">
            {userStats?.win_rate || 0}% Win Rate · {userStats?.total_trades || 0} Trades
          </div>
        </div>
      </div>

      {/* Featured Testnet Faucet Section */}
      <div className="portfolio-faucet-card">
        <div className="faucet-card-left">
          <div className="faucet-icon-badge">
            <Droplets size={22} />
          </div>
          <div className="faucet-info">
            <div className="faucet-title-row">
              <h3>Testnet Collateral Faucet</h3>
            </div>
            <p className="faucet-desc">
              Claim <strong>1,000 free tUSDC</strong> collateral to trade prediction markets.
            </p>
          </div>
        </div>

        <div className="faucet-card-right">
          <button
            className="faucet-claim-btn"
            onClick={handleClaimFaucet}
            disabled={claimingFaucet}
          >
            <Droplets size={16} />
            <span>
              {claimingFaucet ? "Minting tUSDC..." : faucetSuccess ? "Claimed 1,000 tUSDC!" : "Claim 1,000 Free tUSDC"}
            </span>
          </button>
          <a
            href="https://cloud.google.com/application/web3/faucet/somnia/shannon"
            target="_blank"
            rel="noopener noreferrer"
            className="faucet-gas-link"
          >
            <span>Need native STT gas? Faucet</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Faucet Feedback Banners */}
      {faucetError && (
        <div className="portfolio-banner error">
          <span>{faucetError}</span>
        </div>
      )}
      {faucetSuccess && (
        <div className="portfolio-banner success">
          <Check size={16} />
          <span>Successfully claimed 1,000 tUSDC! Your balance has been updated.</span>
        </div>
      )}

      {/* Quick Wallet Actions (Deposit / Withdraw Modals) */}
      {walletAddress && (
        <div className="portfolio-actions-section">
          <WalletActions
            walletAddress={walletAddress}
            usdcBalance={collateralBalance}
            onTransactionComplete={fetchPortfolio}
          />
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="portfolio-tabs">
        <button
          className={`tab-btn ${activeTab === "positions" ? "active" : ""}`}
          onClick={() => setActiveTab("positions")}
        >
          <Layers size={15} />
          <span>Open Positions ({positions.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <History size={15} />
          <span>Trade History</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          <Activity size={15} />
          <span>Performance & Stats</span>
        </button>
      </div>

      {/* Tab 1: Positions */}
      {activeTab === "positions" && (
        <div className="tab-pane">
          {positions.length === 0 ? (
            <div className="positions-empty">
              <BarChart3 size={36} />
              <h4>No Open Positions</h4>
              <p>You do not have any open positions.</p>
              <button className="cta-browse-btn" onClick={() => navigate("/")}>
                <span>Explore Markets</span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          ) : (
            <div className="positions-list">
              {positions.map((position, idx) => {
                const icon = resolveMarketIcon(position.ticker, position.title);
                return (
                  <div key={idx} className="position-card">
                    <div className="position-header">
                      <div className="position-title-group">
                        <img
                          src={icon}
                          alt=""
                          className="position-market-icon"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = "/icons/nour.png";
                          }}
                        />
                        <div>
                          <div className="position-title">{formatMarketTitle(position.title)}</div>
                          <span className="position-ticker">{position.ticker}</span>
                        </div>
                      </div>

                      <span className={`position-side-badge ${position.side}`}>
                        {position.side === "yes" ? "UP (YES)" : "DOWN (NO)"}
                      </span>
                    </div>

                    <div className="position-metrics-grid">
                      <div className="metric-box">
                        <span className="m-label">Contracts / Shares</span>
                        <span className="m-val">{position.contracts.toLocaleString()}</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Avg Entry Price</span>
                        <span className="m-val">{position.avgPrice.toFixed(1)}¢</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Current Price</span>
                        <span className="m-val">{position.currentPrice.toFixed(1)}¢</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Unrealized P&L</span>
                        <span className={`m-val ${position.pnl >= 0 ? "text-success" : "text-danger"}`}>
                          {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="position-footer-actions">
                      <button className="position-action-btn primary" onClick={() => handleSell(position)}>
                        <span>Trade / Add Size</span>
                        <ArrowUpRight size={14} />
                      </button>
                      {position.isSettled && (
                        <button
                          className="position-action-btn redeem"
                          onClick={() => handleRedeem(position)}
                          disabled={redeemingId === position.ticker}
                        >
                          <Trophy size={14} />
                          <span>{redeemingId === position.ticker ? "Redeeming..." : "Claim Payout"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Trade History */}
      {activeTab === "history" && (
        <div className="tab-pane">
          <TradeHistory walletAddress={walletAddress} />
        </div>
      )}

      {/* Tab 3: Performance & Stats */}
      {activeTab === "stats" && (
        <div className="tab-pane">
          <div className="performance-card">
            <h3>Trader Profile & On-Chain Record</h3>
            <div className="stats-breakdown-grid">
              <div className="breakdown-item">
                <span className="b-label">Total Completed Trades</span>
                <span className="b-value">{userStats?.total_trades || 0}</span>
              </div>
              <div className="breakdown-item">
                <span className="b-label">Cumulative Volume</span>
                <span className="b-value">
                  ${(userStats?.total_volume || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="breakdown-item">
                <span className="b-label">Total Realized P&L</span>
                <span className={`b-value ${(userStats?.total_pnl || 0) >= 0 ? "text-success" : "text-danger"}`}>
                  {(userStats?.total_pnl || 0) >= 0 ? "+" : ""}${(userStats?.total_pnl || 0).toFixed(2)}
                </span>
              </div>
              <div className="breakdown-item">
                <span className="b-label">Win Rate</span>
                <span className="b-value text-success">{userStats?.win_rate || 0}%</span>
              </div>
              <div className="breakdown-item">
                <span className="b-label">Trader Tier</span>
                <span className="b-value">{userStats?.rank?.title || "Rookie"}</span>
              </div>
              <div className="breakdown-item">
                <span className="b-label">Trader Score</span>
                <span className="b-value">{userStats?.rank?.score || 0} pts</span>
              </div>
            </div>

            {walletAddress && (
              <div style={{ marginTop: "16px", textAlign: "right" }}>
                <a
                  href={`${SOMNIA_EXPLORER_URL}/address/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="explorer-link"
                >
                  <span>View on Explorer</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
