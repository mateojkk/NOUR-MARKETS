import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Wallet,
  BarChart3,
  RefreshCw,
  Trophy,
  Check,
  CheckCircle2,
  ExternalLink,
  Copy,
  Layers,
  History,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  XCircle,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import { getPositions, getStats, recordTrade, type PositionRecord, type UserStats } from "../services/userService";
import { redeemWinningPosition, placeDreamDexOrder, DREAMDEX_CONTRACTS, SOMNIA_EXPLORER_URL } from "../services/dreamdex";
import { useMarketData } from "../hooks/useMarketData";
import { formatMarketTitle, resolveMarketIcon, type MarketGroup } from "../types";
import TradeHistory from "./TradeHistory";
import RankBadge from "./RankBadge";
import "./Portfolio.css";

interface SettledOnchainData {
  marketId: string;
  poolAddress: string;
  clobStatus: string;
  isResolved: boolean;
  winningOutcome?: 0 | 1;
}

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
  settlementStatus?: "won" | "lost" | "pending";
  resolvedOutcome?: "UP" | "DOWN";
}

async function fetchBatchSettledMarkets(ids: string[]): Promise<Map<string, SettledOnchainData>> {
  const result = new Map<string, SettledOnchainData>();
  const cleanIds = ids.filter(Boolean);
  if (!cleanIds.length) return result;

  try {
    const query = `query {
      Market(where: { _or: [{ id: { _in: ${JSON.stringify(cleanIds)} } }, { marketId: { _in: ${JSON.stringify(cleanIds)} } }] }) {
        id
        marketId
        poolAddress
        clobStatus
      }
      MarketResolutionEvent(where: { market_id: { _in: ${JSON.stringify(cleanIds)} } }) {
        market_id
        outcomeIdx
        payoutNumerators
      }
    }`;

    const resp = await fetch("https://dev.smk.somnia.host/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) return result;
    const json = await resp.json().catch(() => null);
    const marketsList = json?.data?.Market || [];
    const resList = json?.data?.MarketResolutionEvent || [];

    const resMap = new Map<string, number>();
    for (const r of resList) {
      if (typeof r.outcomeIdx === "number") {
        resMap.set(String(r.market_id).toLowerCase(), r.outcomeIdx);
      }
    }

    for (const m of marketsList) {
      const idKey = String(m.id).toLowerCase();
      const mKey = m.marketId ? String(m.marketId).toLowerCase() : "";
      const winningOutcome = resMap.get(idKey) ?? (mKey ? resMap.get(mKey) : undefined);
      const entry: SettledOnchainData = {
        marketId: m.marketId || m.id,
        poolAddress: m.poolAddress,
        clobStatus: m.clobStatus,
        isResolved: winningOutcome !== undefined,
        winningOutcome: winningOutcome as 0 | 1 | undefined,
      };
      result.set(idKey, entry);
      if (mKey) result.set(mKey, entry);
    }
  } catch (err) {
    console.error("Failed to query on-chain settled market info:", err);
  }

  return result;
}

type TabType = "positions" | "closed" | "history" | "stats";

export default function Portfolio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    address,
    connected,
    collateralBalance,
    refreshBalance,
    walletProvider,
  } = useEvmWallet();
  const walletAddress = address || null;

  const { markets } = useMarketData();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const t = searchParams.get("tab");
    return t === "closed" || t === "history" || t === "stats" ? t : "positions";
  });

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "positions" || t === "closed" || t === "history" || t === "stats") {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const openPositions = useMemo(() => positions.filter((p) => !p.isSettled), [positions]);
  const closedPositions = useMemo(() => positions.filter((p) => p.isSettled), [positions]);
  const claimablePositions = useMemo(() => closedPositions.filter((p) => p.settlementStatus === "won"), [closedPositions]);
  const totalClaimable = useMemo(() => claimablePositions.reduce((sum, p) => sum + p.contracts, 0), [claimablePositions]);
  const [totalPnl, setTotalPnl] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // Close position modal state
  const [positionToClose, setPositionToClose] = useState<PortfolioPosition | null>(null);
  const [closeShares, setCloseShares] = useState<number>(0);
  const [closingStatus, setClosingStatus] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeSuccess, setCloseSuccess] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  // Derive active position to keep modal price and P&L reactive to live market feed ticks
  const activePositionToClose = useMemo(() => {
    if (!positionToClose) return null;
    const live = positions.find(
      (p) => p.ticker.toLowerCase() === positionToClose.ticker.toLowerCase() && p.side === positionToClose.side
    );
    return live || positionToClose;
  }, [positionToClose, positions]);

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

      // Identify all positions that are settled or whose market is finalized/missing from live trading
      const settledHexIds: string[] = [];
      backendPositions.forEach((p: PositionRecord) => {
        const pSuffix = p.ticker?.split("-").pop()?.toLowerCase();
        const isLive = markets.some((m) => {
          if (m.closed || m.active === false) return false;
          if (m.expiry && Date.now() / 1000 > m.expiry) return false;
          if (m.ticker === p.ticker) return true;
          const mSuffix = m.ticker?.split("-").pop()?.toLowerCase();
          if (pSuffix && mSuffix && pSuffix === mSuffix) return true;
          if (pSuffix && m.marketId && m.marketId.toLowerCase().endsWith(pSuffix)) return true;
          return false;
        });
        if (!isLive && pSuffix && /^[0-9a-f]+$/i.test(pSuffix)) {
          settledHexIds.push(`0x${pSuffix.padStart(64, "0")}`);
        }
      });

      const settledDataMap = settledHexIds.length > 0
        ? await fetchBatchSettledMarkets(settledHexIds)
        : new Map<string, SettledOnchainData>();

      const mappedPositions: PortfolioPosition[] = backendPositions.map((p: PositionRecord) => {
        const pSuffix = p.ticker?.split("-").pop()?.toLowerCase();
        // Match strictly by ticker, suffix, or marketId — NEVER by recurring window question title!
        const market = markets.find((m) => {
          if (m.ticker === p.ticker) return true;
          const mSuffix = m.ticker?.split("-").pop()?.toLowerCase();
          if (pSuffix && mSuffix && pSuffix === mSuffix) return true;
          if (pSuffix && m.marketId && m.marketId.toLowerCase().endsWith(pSuffix)) return true;
          return false;
        });

        const hexId = pSuffix && /^[0-9a-f]+$/i.test(pSuffix) ? `0x${pSuffix.padStart(64, "0")}`.toLowerCase() : null;
        const onchainSettled = hexId ? settledDataMap.get(hexId) : null;

        const avgPrice = p.avg_price || 50;
        const contracts = p.contracts || 0;

        let isSettled = false;
        let settlementStatus: "won" | "lost" | "pending" | undefined;
        let currentPrice = 50;
        let poolAddress = market?.poolAddress;
        let marketId = market?.marketId;

        // 1. Check if the market has resolved on-chain
        if (onchainSettled && onchainSettled.isResolved) {
          isSettled = true;
          poolAddress = onchainSettled.poolAddress || poolAddress;
          marketId = onchainSettled.marketId || marketId;
          const userWon = (p.side === "yes" && onchainSettled.winningOutcome === 0) ||
                          (p.side === "no" && onchainSettled.winningOutcome === 1);
          if (userWon) {
            settlementStatus = "won";
            currentPrice = 100;
          } else {
            settlementStatus = "lost";
            currentPrice = 0;
          }
        } else if (market && !market.closed && market.active !== false && (!market.expiry || Date.now() / 1000 <= market.expiry)) {
          // 2. Market is currently actively trading on-chain
          isSettled = false;
          poolAddress = market.poolAddress || DREAMDEX_CONTRACTS.binaryMarketsModule;
          marketId = market.marketId;
          currentPrice = p.side === "yes" ? market.price_yes : market.price_no;
        } else if (onchainSettled) {
          // 3. Market is finalized/expired, awaiting resolution event
          isSettled = true;
          poolAddress = onchainSettled.poolAddress || poolAddress;
          marketId = onchainSettled.marketId || marketId;
          settlementStatus = "pending";
          currentPrice = avgPrice;
        } else if (market && (market.closed || (market.expiry && Date.now() / 1000 > market.expiry))) {
          // 4. Market is closed in feed, awaiting resolution
          isSettled = true;
          poolAddress = market.poolAddress || DREAMDEX_CONTRACTS.binaryMarketsModule;
          marketId = market.marketId;
          settlementStatus = "pending";
          currentPrice = avgPrice;
        } else if (markets.length > 0) {
          isSettled = true;
          currentPrice = 0;
          settlementStatus = "lost";
        } else {
          // Feed is still initializing
          isSettled = false;
          currentPrice = avgPrice;
        }

        const resolvedOutcome: "UP" | "DOWN" | undefined = onchainSettled?.winningOutcome === 0
          ? "UP"
          : onchainSettled?.winningOutcome === 1
          ? "DOWN"
          : undefined;

        const pnl = ((currentPrice - avgPrice) * contracts) / 100;
        const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;

        return {
          ticker: market?.ticker || p.ticker,
          title: p.title || market?.title || p.ticker,
          side: p.side as "yes" | "no",
          contracts,
          avgPrice,
          currentPrice,
          pnl,
          pnlPercent,
          poolAddress,
          marketId,
          isSettled,
          settlementStatus,
          resolvedOutcome,
        };
      });

      setPositions(mappedPositions);

      let pnl = 0;
      let holdingsValue = 0;
      mappedPositions.forEach((p) => {
        if (!p.isSettled) {
          pnl += p.pnl;
          holdingsValue += p.contracts * (p.currentPrice / 100);
        }
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
  }, [walletAddress, collateralBalance, refreshBalance, markets]);

  useEffect(() => {
    if (connected && walletAddress) {
      fetchPortfolio();
    }
  }, [connected, walletAddress, fetchPortfolio]);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch {}
  };

  const handleOpenCloseModal = (position: PortfolioPosition) => {
    setPositionToClose(position);
    setCloseShares(position.contracts);
    setCloseError(null);
    setCloseSuccess(null);
    setClosingStatus(null);
  };

  const handleConfirmClose = async () => {
    const activePos = activePositionToClose;
    if (!walletProvider || !activePos || !walletAddress) return;
    if (closeShares <= 0 || closeShares > activePos.contracts) {
      setCloseError(`Please enter a valid contract amount (1 to ${activePos.contracts})`);
      return;
    }

    setClosingStatus("Authorizing tokens & placing sell order...");
    setCloseError(null);
    setCloseSuccess(null);

    if (activePos.isSettled) {
      setClosingStatus(null);
      setCloseError("This market window has already ended and settled. Please click 'Claim Payout' to redeem.");
      return;
    }

    const pool = activePos.poolAddress;
    if (!pool || pool.toLowerCase() === DREAMDEX_CONTRACTS.binaryMarketsModule.toLowerCase()) {
      setClosingStatus(null);
      setCloseError("This position's market does not have an active binary pool address on Somnia.");
      return;
    }
    const priceProb = activePos.currentPrice / 100;

    try {
      const result = await placeDreamDexOrder({
        walletProvider,
        poolAddress: pool,
        side: activePos.side,
        action: "sell",
        priceProb,
        contractsAmount: closeShares,
        orderType: "limit",
      });

      const netProceeds = (closeShares * activePos.currentPrice) / 100;
      const estPnl = ((activePos.currentPrice - activePos.avgPrice) * closeShares) / 100;

      await recordTrade(walletAddress, {
        ticker: activePos.ticker,
        title: activePos.title,
        side: activePos.side,
        action: "sell",
        amount: closeShares,
        price: activePos.currentPrice,
        total_cost: netProceeds,
        platform: "dreamdex",
        tx_signature: result.txHash,
        platform_fee: 0,
        pnl: estPnl,
      }).catch(() => {});

      setClosingStatus(null);
      setCloseSuccess(`Closed ${closeShares} contracts! Payout: $${netProceeds.toFixed(2)} tUSDC`);

      await refreshBalance();
      await fetchPortfolio();

      setTimeout(() => {
        setPositionToClose(null);
        setCloseSuccess(null);
      }, 1600);
    } catch (err: any) {
      console.error("Close position error:", err);
      setClosingStatus(null);
      setCloseError(err?.reason || err?.message || "Failed to close position on Somnia");
    }
  };

  const handleTradeMore = (position: PortfolioPosition) => {
    const pSuffix = position.ticker?.split("-").pop()?.toLowerCase();

    // 1. Try to find the exact live market in the active feed
    const liveMarket = markets.find((m) => {
      if (m.ticker.toLowerCase() === position.ticker.toLowerCase()) return true;
      if (position.marketId && m.marketId?.toLowerCase() === position.marketId.toLowerCase()) return true;
      const mSuffix = m.ticker?.split("-").pop()?.toLowerCase();
      if (pSuffix && mSuffix && pSuffix === mSuffix) return true;
      return false;
    });

    if (liveMarket && !liveMarket.closed && liveMarket.active !== false) {
      const group: MarketGroup = {
        ticker: liveMarket.ticker,
        title: liveMarket.title.trim(),
        totalVolume: liveMarket.volume || 0,
        markets: [liveMarket],
        image: liveMarket.image || resolveMarketIcon(liveMarket.asset, liveMarket.title),
      };
      navigate(`/trade/${encodeURIComponent(liveMarket.ticker)}?action=buy&side=${position.side}`, {
        state: { group },
      });
      return;
    }

    // 2. If this window ended, find the active market for the SAME asset (e.g. BTC -> active BTC market)
    const asset = position.ticker?.split("-")[0]?.toUpperCase();
    const activeAssetMarket = markets.find((m) =>
      !m.closed && m.active !== false && m.asset?.toUpperCase() === asset
    );

    if (activeAssetMarket) {
      const group: MarketGroup = {
        ticker: activeAssetMarket.ticker,
        title: activeAssetMarket.title.trim(),
        totalVolume: activeAssetMarket.volume || 0,
        markets: [activeAssetMarket],
        image: activeAssetMarket.image || resolveMarketIcon(activeAssetMarket.asset, activeAssetMarket.title),
      };
      navigate(`/trade/${encodeURIComponent(activeAssetMarket.ticker)}?action=buy&side=${position.side}`, {
        state: { group },
      });
      return;
    }

    // 3. Fallback
    navigate(`/trade/${encodeURIComponent(position.ticker)}?action=buy&side=${position.side}`);
  };

  const handleRedeem = async (pos: PortfolioPosition) => {
    if (!walletProvider) return;
    if (!pos.poolAddress || pos.poolAddress.toLowerCase() === DREAMDEX_CONTRACTS.binaryMarketsModule.toLowerCase()) {
      alert("Cannot redeem: on-chain binary pool address was not found for this market.");
      return;
    }
    if (!pos.marketId || pos.marketId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      alert("Cannot redeem: on-chain market ID was not found.");
      return;
    }
    setRedeemingId(pos.ticker);
    try {
      const outcomeIdx = pos.side === "yes" ? 0 : 1;
      await redeemWinningPosition(walletProvider, pos.marketId, pos.poolAddress, outcomeIdx, pos.contracts);
      await refreshBalance();
      await fetchPortfolio();
    } catch (err: any) {
      console.error("Redemption error:", err);
      alert(err?.reason || err?.message || "Redemption failed on Somnia Shannon");
    } finally {
      setRedeemingId(null);
    }
  };

  const handleClaimAll = async () => {
    if (!walletProvider || claimablePositions.length === 0) return;
    for (const pos of claimablePositions) {
      await handleRedeem(pos);
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

      {/* Claimable Winnings Notification Banner */}
      {claimablePositions.length > 0 && (
        <div className="claimable-payout-banner">
          <div className="claimable-payout-info">
            <div className="claimable-trophy-wrap">
              <Trophy size={20} className="text-success" />
            </div>
            <div>
              <div className="claimable-payout-title">
                ${totalClaimable.toFixed(2)} tUSDC Ready to Claim!
              </div>
              <div className="claimable-payout-sub">
                {claimablePositions.length} winning position{claimablePositions.length > 1 ? "s" : ""} resolved on Somnia Shannon.
              </div>
            </div>
          </div>
          <button
            className="claim-all-btn"
            onClick={handleClaimAll}
            disabled={!!redeemingId}
          >
            <Trophy size={15} />
            <span>{redeemingId ? "Redeeming..." : `Claim All ($${totalClaimable.toFixed(2)} tUSDC)`}</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="portfolio-tabs">
        <button
          className={`tab-btn ${activeTab === "positions" ? "active" : ""}`}
          onClick={() => handleTabChange("positions")}
        >
          <Layers size={15} />
          <span>Open Positions ({openPositions.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "closed" ? "active" : ""}`}
          onClick={() => handleTabChange("closed")}
        >
          <CheckCircle2 size={15} />
          <span>Closed Positions ({closedPositions.length})</span>
          {claimablePositions.length > 0 && (
            <span className="tab-claim-count">{claimablePositions.length} WON</span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => handleTabChange("history")}
        >
          <History size={15} />
          <span>Trade History</span>
        </button>

        <button
          className={`tab-btn ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => handleTabChange("stats")}
        >
          <Activity size={15} />
          <span>Performance & Stats</span>
        </button>
      </div>

      {/* Tab 1: Open Positions */}
      {activeTab === "positions" && (
        <div className="tab-pane">
          {openPositions.length === 0 ? (
            <div className="positions-empty">
              <BarChart3 size={36} />
              <h4>No Open Positions</h4>
              <p>You do not have any active open prediction trades.</p>
              <button className="cta-browse-btn" onClick={() => navigate("/")}>
                <span>Explore Markets</span>
                <ArrowUpRight size={15} />
              </button>
            </div>
          ) : (
            <div className="positions-list">
              {openPositions.map((position, idx) => {
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
                      <button
                        className="position-action-btn close-btn"
                        onClick={() => handleOpenCloseModal(position)}
                      >
                        <XCircle size={14} />
                        <span>Close Position</span>
                      </button>
                      <button className="position-action-btn primary" onClick={() => handleTradeMore(position)}>
                        <span>Trade More</span>
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Closed / Settled Positions */}
      {activeTab === "closed" && (
        <div className="tab-pane">
          {closedPositions.length === 0 ? (
            <div className="positions-empty">
              <CheckCircle2 size={36} />
              <h4>No Closed Positions</h4>
              <p>Your completed, settled, or expired positions will appear here.</p>
            </div>
          ) : (
            <div className="positions-list">
              {closedPositions.map((position, idx) => {
                const icon = resolveMarketIcon(position.ticker, position.title);
                const isWon = position.settlementStatus === "won";
                const isLost = position.settlementStatus === "lost";
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

                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className={`position-side-badge ${position.side}`}>
                          {position.side === "yes" ? "UP (YES)" : "DOWN (NO)"}
                        </span>
                        {isWon && <span className="settled-outcome-pill won">WON</span>}
                        {isLost && <span className="settled-outcome-pill lost">LOST</span>}
                        {!isWon && !isLost && <span className="settled-outcome-pill pending">PENDING</span>}
                      </div>
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
                        <span className="m-label">Settlement Price</span>
                        <span className="m-val">{isWon ? "100.0¢" : isLost ? "0.0¢" : `${position.currentPrice.toFixed(1)}¢`}</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Realized P&L</span>
                        <span className={`m-val ${position.pnl >= 0 ? "text-success" : "text-danger"}`}>
                          {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    <div className="position-footer-actions">
                      {isWon ? (
                        <button
                          className="position-action-btn redeem"
                          onClick={() => handleRedeem(position)}
                          disabled={redeemingId === position.ticker}
                        >
                          <Trophy size={14} />
                          <span>{redeemingId === position.ticker ? "Redeeming..." : `Claim Payout ($${((position.contracts * 100) / 100).toFixed(2)} tUSDC)`}</span>
                        </button>
                      ) : isLost ? (
                        <div className="settled-status-badge lost">
                          <span>{position.resolvedOutcome ? `Resolved ${position.resolvedOutcome} · Position Lost ($0.00)` : "Position Lost ($0.00)"}</span>
                        </div>
                      ) : (
                        <div className="settled-status-badge pending">
                          <span>Awaiting Settlement</span>
                        </div>
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

      {/* Close Position Modal */}
      {activePositionToClose && (
        <div className="close-modal-overlay" onClick={() => !closingStatus && setPositionToClose(null)}>
          <div className="close-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="close-modal-header">
              <h3 className="close-modal-title">
                <XCircle size={18} className="text-danger" />
                <span>Close Position</span>
              </h3>
              <button
                className="close-modal-close-btn"
                onClick={() => !closingStatus && setPositionToClose(null)}
                disabled={!!closingStatus}
              >
                <X size={16} />
              </button>
            </div>

            <div className="close-modal-market-info">
              <div className="close-modal-market-row">
                <span className="close-modal-market-name">{formatMarketTitle(activePositionToClose.title)}</span>
                <span className={`position-side-badge ${activePositionToClose.side}`}>
                  {activePositionToClose.side === "yes" ? "UP (YES)" : "DOWN (NO)"}
                </span>
              </div>
              <div className="close-modal-stats-grid">
                <div className="close-modal-stat-item">
                  <span className="close-modal-stat-label">Contracts Held</span>
                  <span className="close-modal-stat-value">{activePositionToClose.contracts.toLocaleString()}</span>
                </div>
                <div className="close-modal-stat-item">
                  <span className="close-modal-stat-label">Entry Avg</span>
                  <span className="close-modal-stat-value">{activePositionToClose.avgPrice.toFixed(1)}¢</span>
                </div>
                <div className="close-modal-stat-item">
                  <span className="close-modal-stat-label">Current Price</span>
                  <span className="close-modal-stat-value">{activePositionToClose.currentPrice.toFixed(1)}¢</span>
                </div>
              </div>
            </div>

            <div className="close-modal-shares-section">
              <div className="close-modal-shares-header">
                <span>Contracts to Close</span>
                <span>Max: {activePositionToClose.contracts}</span>
              </div>
              <div className="close-modal-input-wrap">
                <input
                  type="number"
                  min="1"
                  max={activePositionToClose.contracts}
                  value={closeShares || ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCloseShares(isNaN(val) ? 0 : Math.min(val, activePositionToClose.contracts));
                  }}
                  className="close-modal-input"
                  placeholder="0"
                />
                <span className="close-modal-input-unit">contracts</span>
              </div>
              <div className="percent-chips-row">
                {[25, 50, 75, 100].map((pct) => {
                  const targetVal = pct === 100
                    ? activePositionToClose.contracts
                    : Math.max(1, Math.floor(activePositionToClose.contracts * (pct / 100)));
                  const isActive = closeShares === targetVal;
                  return (
                    <button
                      key={pct}
                      type="button"
                      className={`percent-chip ${isActive ? "active" : ""}`}
                      onClick={() => setCloseShares(targetVal)}
                    >
                      {pct === 100 ? "100% (All)" : `${pct}%`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Financial Proceeds Breakdown */}
            {(() => {
              const net = (closeShares * activePositionToClose.currentPrice) / 100;
              const estPnl = ((activePositionToClose.currentPrice - activePositionToClose.avgPrice) * closeShares) / 100;
              return (
                <div className="close-modal-proceeds-box">
                  <div className="proceeds-row">
                    <span>Estimated Realized P&L:</span>
                    <span className={estPnl >= 0 ? "text-success" : "text-danger"}>
                      {estPnl >= 0 ? "+" : ""}${estPnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="proceeds-row highlight">
                    <span>Net Payout to Receive:</span>
                    <span className="proceeds-value-large">${net.toFixed(2)} tUSDC</span>
                  </div>
                </div>
              );
            })()}

            {closeError && (
              <div className="close-modal-feedback error">
                <AlertCircle size={15} />
                <span>{closeError}</span>
              </div>
            )}

            {closeSuccess && (
              <div className="close-modal-feedback success">
                <Check size={15} />
                <span>{closeSuccess}</span>
              </div>
            )}

            <div className="close-modal-actions">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setPositionToClose(null)}
                disabled={!!closingStatus}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-confirm-btn"
                onClick={handleConfirmClose}
                disabled={!!closingStatus || closeShares <= 0 || closeShares > activePositionToClose.contracts}
              >
                {closingStatus ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    <span>{closingStatus}</span>
                  </>
                ) : (
                  <span>
                    Confirm Close · Payout ${((closeShares * activePositionToClose.currentPrice) / 100).toFixed(2)} tUSDC
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
