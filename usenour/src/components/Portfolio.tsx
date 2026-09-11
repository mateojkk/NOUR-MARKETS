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
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDownUp,
  XCircle,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import { getPositions, getStats, recordTrade, getTrades, type PositionRecord, type UserStats } from "../services/userService";
import {
  redeemWinningPosition,
  placeDreamDexOrder,
  cancelDreamDexOrder,
  getOrderIdFromTx,
  DREAMDEX_CONTRACTS,
  SOMNIA_EXPLORER_URL,
} from "../services/dreamdex";
import { useMarketData } from "../hooks/useMarketData";
import { formatMarketTitle, resolveMarketIcon, type MarketGroup } from "../types";
import TradeHistory from "./TradeHistory";
import TransferHistory from "./TransferHistory";
import { recordTransfer } from "../services/transferService";
import WalletActions, { type WalletModalType } from "./WalletActions";
import RankBadge from "./RankBadge";
import { useToast, ToastContainer } from "./Toast";
import "./Portfolio.css";

interface SettledOnchainData {
  marketId: string;
  poolAddress: string;
  clobStatus: string;
  isResolved: boolean;
  winningOutcome?: 0 | 1;
  yesTokenId?: string;
  noTokenId?: string;
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
  outcomeTokenId?: string;
  isSettled?: boolean;
  settlementStatus?: "won" | "lost" | "refunded" | "pending";
  resolvedOutcome?: "UP" | "DOWN";
  isRefunded?: boolean;
  isRested?: boolean;
  orderId?: string;
  txSignature?: string;
  contractsHeldOnchain?: number;
}

interface BatchSettledResult {
  settledMap: Map<string, SettledOnchainData>;
  userOutcomeMap: Map<string, { balance: number; tokenId: string }>;
}

async function fetchBatchSettledMarkets(ids: string[], userAddress?: string): Promise<BatchSettledResult> {
  const settledMap = new Map<string, SettledOnchainData>();
  const userOutcomeMap = new Map<string, { balance: number; tokenId: string }>();
  const cleanIds = ids.filter(Boolean);

  try {
    const safeUser = userAddress ? userAddress.toLowerCase() : "";
    const query = `query {
      ${cleanIds.length > 0 ? `
      Market(where: { _or: [{ id: { _in: ${JSON.stringify(cleanIds)} } }, { marketId: { _in: ${JSON.stringify(cleanIds)} } }] }) {
        id
        marketId
        poolAddress
        clobStatus
        yesTokenId
        noTokenId
        finalized
        winningOutcome
      }
      MarketResolutionEvent(where: { market_id: { _in: ${JSON.stringify(cleanIds)} } }) {
        market_id
        outcomeIdx
        payoutNumerators
      }
      ` : ""}
      ${safeUser ? `
      OutcomeBalance(where: { account: { _ilike: "${safeUser}" } }) {
        balance
        outcomeIndex
        tokenId
        market_id
      }
      ` : ""}
    }`;

    const resp = await fetch("https://dev.smk.somnia.host/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!resp.ok) return { settledMap, userOutcomeMap };
    const json = await resp.json().catch(() => null);
    const marketsList = json?.data?.Market || [];
    const resList = json?.data?.MarketResolutionEvent || [];
    const outcomeBalancesList = json?.data?.OutcomeBalance || [];

    const resMap = new Map<string, number>();
    for (const r of resList) {
      if (typeof r.outcomeIdx === "number") {
        resMap.set(String(r.market_id).toLowerCase(), r.outcomeIdx);
      }
    }

    for (const m of marketsList) {
      const idKey = String(m.id).toLowerCase();
      const mKey = m.marketId ? String(m.marketId).toLowerCase() : "";
      const resWinningOutcome = resMap.get(idKey) ?? (mKey ? resMap.get(mKey) : undefined);
      const winningOutcome = resWinningOutcome !== undefined
        ? resWinningOutcome
        : typeof m.winningOutcome === "number"
        ? m.winningOutcome
        : undefined;

      const entry: SettledOnchainData = {
        marketId: m.marketId || m.id,
        poolAddress: m.poolAddress,
        clobStatus: m.clobStatus,
        isResolved: winningOutcome !== undefined,
        winningOutcome: winningOutcome as 0 | 1 | undefined,
        yesTokenId: m.yesTokenId ? String(m.yesTokenId) : undefined,
        noTokenId: m.noTokenId ? String(m.noTokenId) : undefined,
      };
      settledMap.set(idKey, entry);
      if (mKey) settledMap.set(mKey, entry);
      const suffix = idKey.slice(-6);
      settledMap.set(suffix, entry);
    }

    for (const b of outcomeBalancesList) {
      const mId = String(b.market_id).toLowerCase();
      const contracts = Number(b.balance) / 1e6;
      const val = { balance: contracts, tokenId: String(b.tokenId) };
      userOutcomeMap.set(`${mId}-${b.outcomeIndex}`, val);
      const suffix = mId.slice(-6);
      userOutcomeMap.set(`${suffix}-${b.outcomeIndex}`, val);
    }
  } catch (err) {
    console.error("Failed to query on-chain settled market info:", err);
  }

  return { settledMap, userOutcomeMap };
}

type TabType = "positions" | "closed" | "history" | "transfers" | "stats";

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
  const { toasts, addToast, removeToast } = useToast();
  const claimablePositions = useMemo(
    () => closedPositions.filter((p) => p.settlementStatus === "won" && p.contracts > 0 && !!p.outcomeTokenId),
    [closedPositions]
  );
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
  const [walletModal, setWalletModal] = useState<WalletModalType>(null);

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

      const [backendPositionsRaw, userTrades] = await Promise.all([
        getPositions(walletAddress),
        getTrades(walletAddress).catch(() => []),
      ]);
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

      const { settledMap, userOutcomeMap } = await fetchBatchSettledMarkets(settledHexIds, walletAddress);

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
        const onchainSettled = hexId ? settledMap.get(hexId) : (pSuffix ? settledMap.get(pSuffix) : null);

        const avgPrice = p.avg_price || 50;
        let contracts = p.contracts || 0;

        let isSettled = false;
        let settlementStatus: "won" | "lost" | "refunded" | "pending" | undefined;
        let currentPrice = 50;
        let poolAddress = market?.poolAddress;
        let marketId = market?.marketId;
        let outcomeTokenId: string | undefined;

        const outcomeIdx = p.side === "yes" ? 0 : 1;
        const userOutcome = (hexId ? userOutcomeMap.get(`${hexId}-${outcomeIdx}`) : null) ??
                            (pSuffix ? userOutcomeMap.get(`${pSuffix}-${outcomeIdx}`) : null);
        const heldTokens = userOutcome ? userOutcome.balance : 0;
        if (userOutcome?.tokenId) {
          outcomeTokenId = userOutcome.tokenId;
        }

        // 1. Check if the market has resolved on-chain
        if (onchainSettled && onchainSettled.isResolved) {
          isSettled = true;
          poolAddress = onchainSettled.poolAddress || poolAddress;
          marketId = onchainSettled.marketId || marketId;
          outcomeTokenId = outcomeTokenId || (outcomeIdx === 0 ? onchainSettled.yesTokenId : onchainSettled.noTokenId);
          const userWon = (p.side === "yes" && onchainSettled.winningOutcome === 0) ||
                          (p.side === "no" && onchainSettled.winningOutcome === 1);
          if (userWon) {
            if (heldTokens > 0) {
              settlementStatus = "won";
              currentPrice = 100;
              contracts = heldTokens;
            } else {
              // User placed order, but it expired unfilled on the CLOB and was 100% refunded to wallet
              settlementStatus = "refunded";
              currentPrice = avgPrice;
            }
          } else {
            settlementStatus = "lost";
            currentPrice = 0;
            if (heldTokens > 0) {
              contracts = heldTokens;
            }
          }
        } else if (market && !market.closed && market.active !== false && (!market.expiry || Date.now() / 1000 <= market.expiry)) {
          // 2. Market is currently actively trading on-chain
          isSettled = false;
          poolAddress = market.poolAddress || DREAMDEX_CONTRACTS.binaryMarketsModule;
          marketId = market.marketId;
          outcomeTokenId = outcomeTokenId || (outcomeIdx === 0 ? market.yes_token_id : market.no_token_id);
          currentPrice = p.side === "yes" ? market.price_yes : market.price_no;
        } else if (onchainSettled) {
          // 3. Market is finalized/expired, awaiting resolution event
          isSettled = true;
          poolAddress = onchainSettled.poolAddress || poolAddress;
          marketId = onchainSettled.marketId || marketId;
          outcomeTokenId = outcomeTokenId || (outcomeIdx === 0 ? onchainSettled.yesTokenId : onchainSettled.noTokenId);
          settlementStatus = "pending";
          currentPrice = avgPrice;
        } else if (market && (market.closed || (market.expiry && Date.now() / 1000 > market.expiry))) {
          // 4. Market is closed in feed, awaiting resolution
          isSettled = true;
          poolAddress = market.poolAddress || DREAMDEX_CONTRACTS.binaryMarketsModule;
          marketId = market.marketId;
          outcomeTokenId = outcomeTokenId || (outcomeIdx === 0 ? market.yes_token_id : market.no_token_id);
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

        const isRefunded = settlementStatus === "refunded";
        const isRested = !isSettled && heldTokens === 0;
        const matchingTrade = userTrades.find(
          (t) => t.ticker.toLowerCase() === p.ticker.toLowerCase() && t.side === p.side && t.action === "buy"
        );
        const txSignature = matchingTrade?.tx_signature;

        const pnl = isRefunded ? 0 : ((currentPrice - avgPrice) * contracts) / 100;
        const pnlPercent = isRefunded || avgPrice === 0 ? 0 : ((currentPrice - avgPrice) / avgPrice) * 100;

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
          outcomeTokenId,
          isSettled,
          settlementStatus,
          resolvedOutcome,
          isRefunded,
          isRested,
          txSignature,
          contractsHeldOnchain: heldTokens,
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

    // Pre-fetch orderId if resting order
    if (position.isRested && !position.orderId && position.txSignature) {
      getOrderIdFromTx(position.txSignature).then((id) => {
        if (id) {
          setPositionToClose((prev) => (prev ? { ...prev, orderId: id } : null));
        }
      }).catch(() => {});
    }
  };

  const handleConfirmClose = async () => {
    const activePos = activePositionToClose;
    if (!walletProvider || !activePos || !walletAddress) return;

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

    const isRestingOrder = (activePos.isRested || activePos.contractsHeldOnchain === 0) && !activePos.isSettled;

    // Handle Resting Limit Order Cancellation (100% Collateral Refund)
    if (isRestingOrder) {
      setClosingStatus("Cancelling resting order & refunding collateral on Somnia...");
      setCloseError(null);
      setCloseSuccess(null);

      try {
        let orderId: string | null | undefined = activePos.orderId;
        if (!orderId && activePos.txSignature) {
          orderId = await getOrderIdFromTx(activePos.txSignature);
        }
        if (!orderId) {
          const latestTrades = await getTrades(walletAddress).catch(() => []);
          const trade = latestTrades.find(
            (t) => t.ticker.toLowerCase() === activePos.ticker.toLowerCase() && t.side === activePos.side && t.action === "buy" && t.tx_signature
          );
          if (trade?.tx_signature) {
            orderId = await getOrderIdFromTx(trade.tx_signature);
          }
        }

        if (!orderId) {
          throw new Error("Could not find on-chain order ID for this resting order. The order may have already been cancelled or expired.");
        }

        const cancelTxHash = await cancelDreamDexOrder(walletProvider, pool, orderId);

        const refundAmount = (activePos.contracts * activePos.avgPrice) / 100;

        await recordTrade(walletAddress, {
          ticker: activePos.ticker,
          title: activePos.title,
          side: activePos.side,
          action: "sell",
          amount: activePos.contracts,
          price: activePos.avgPrice,
          total_cost: refundAmount,
          platform: "dreamdex",
          tx_signature: cancelTxHash,
          platform_fee: 0,
          pnl: 0,
        }).catch(() => {});

        setClosingStatus(null);
        setCloseSuccess(`Order cancelled! $${refundAmount.toFixed(2)} tUSDC refunded to your wallet.`);
        addToast("success", `Order cancelled! $${refundAmount.toFixed(2)} tUSDC returned to your wallet.`);

        await refreshBalance();
        await fetchPortfolio();

        setTimeout(() => {
          setPositionToClose(null);
          setCloseSuccess(null);
        }, 1600);
        return;
      } catch (err: any) {
        console.error("Cancel resting order error:", err);
        setClosingStatus(null);
        setCloseError(err?.reason || err?.message || "Failed to cancel order on Somnia");
        return;
      }
    }

    // Handle Active Holding Token Position Sale
    if (closeShares <= 0 || closeShares > activePos.contracts) {
      setCloseError(`Please enter a valid contract amount (1 to ${activePos.contracts})`);
      return;
    }

    setClosingStatus("Authorizing tokens & placing sell order...");
    setCloseError(null);
    setCloseSuccess(null);

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
      addToast("error", "Cannot redeem: on-chain binary pool address was not found for this market.");
      return;
    }
    if (!pos.outcomeTokenId) {
      addToast("error", "Cannot redeem: on-chain outcome token ID was not found.");
      return;
    }
    setRedeemingId(pos.ticker);
    try {
      const tx = await redeemWinningPosition(
        walletProvider,
        pos.poolAddress,
        pos.outcomeTokenId,
        pos.contracts,
        walletAddress || undefined
      );
      if (walletAddress) {
        recordTransfer(walletAddress, {
          type: "deposit",
          subtype: "payout",
          amount: pos.contracts,
          token: "tUSDC",
          txHash: typeof tx === "string" ? tx : undefined,
          fromAddress: pos.poolAddress,
          toAddress: walletAddress,
          timestamp: new Date().toISOString(),
          status: "completed",
          note: `Market Win Payout: ${pos.title || pos.ticker} (${pos.side.toUpperCase()})`,
        });
      }
      addToast("success", `Successfully claimed $${pos.contracts.toFixed(2)} tUSDC payout!`);
      await refreshBalance();
      await fetchPortfolio();
    } catch (err: any) {
      console.error("Redemption error:", err);
      addToast("error", err?.reason || err?.message || "Redemption failed on Somnia Shannon");
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

        <div className="portfolio-header-actions">
          <button
            className="portfolio-action-btn-header deposit"
            onClick={() => setWalletModal("deposit")}
            title="Deposit collateral / claim faucet"
          >
            <ArrowDownToLine size={14} />
            <span>Deposit</span>
          </button>
          <button
            className="portfolio-action-btn-header withdraw"
            onClick={() => setWalletModal("withdraw")}
            title="Withdraw tUSDC to external address"
          >
            <ArrowUpFromLine size={14} />
            <span>Withdraw</span>
          </button>
          <button
            className={`refresh-btn ${loading ? "spinning" : ""}`}
            onClick={fetchPortfolio}
            title="Refresh balances & positions"
          >
            <RefreshCw size={16} />
          </button>
        </div>
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
          <div className="stat-card-footer-row">
            <div className="stat-hint">Available trading collateral</div>
            <div className="stat-card-action-btns">
              <button
                className="stat-card-action-btn deposit"
                onClick={() => setWalletModal("deposit")}
                title="Deposit / Claim Faucet"
              >
                <ArrowDownToLine size={12} />
                <span>Deposit</span>
              </button>
              <button
                className="stat-card-action-btn withdraw"
                onClick={() => setWalletModal("withdraw")}
                title="Withdraw tUSDC"
              >
                <ArrowUpFromLine size={12} />
                <span>Withdraw</span>
              </button>
            </div>
          </div>
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
          className={`tab-btn ${activeTab === "transfers" ? "active" : ""}`}
          onClick={() => handleTabChange("transfers")}
        >
          <ArrowDownUp size={15} />
          <span>Transfers & Activity</span>
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

                      <div className="position-badges-group">
                        <span className={`position-side-badge ${position.side}`}>
                          {position.side === "yes" ? "UP (YES)" : "DOWN (NO)"}
                        </span>
                        {position.isRested && (
                          <span className="position-resting-badge">
                            RESTING ORDER
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="position-metrics-grid">
                      <div className="metric-box">
                        <span className="m-label">Contracts / Shares</span>
                        <span className="m-val">{position.contracts.toLocaleString()}</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">{position.isRested ? "Order Limit Price" : "Avg Entry Price"}</span>
                        <span className="m-val">{position.avgPrice.toFixed(1)}¢</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Current Price</span>
                        <span className="m-val">{position.currentPrice.toFixed(1)}¢</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">{position.isRested ? "Escrow Collateral" : "Unrealized P&L"}</span>
                        {position.isRested ? (
                          <span className="m-val text-warning">
                            ${((position.contracts * position.avgPrice) / 100).toFixed(2)} (Resting)
                          </span>
                        ) : (
                          <span className={`m-val ${position.pnl >= 0 ? "text-success" : "text-danger"}`}>
                            {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)} ({position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="position-footer-actions">
                      <button
                        className={`position-action-btn ${position.isRested ? "cancel-order-action-btn" : "close-btn"}`}
                        onClick={() => handleOpenCloseModal(position)}
                      >
                        <XCircle size={14} />
                        <span>{position.isRested ? "Cancel Order" : "Close Position"}</span>
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
                const isRefunded = position.settlementStatus === "refunded";
                const totalCost = (position.contracts * position.avgPrice) / 100;
                const finalPayout = isWon ? (position.contracts * 100) / 100 : isRefunded ? totalCost : 0;
                const marketOutcome = position.resolvedOutcome || (isWon ? (position.side === "yes" ? "UP" : "DOWN") : (position.side === "yes" ? "DOWN" : "UP"));

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
                          <div style={{ display: "flex", alignItems: "center", marginTop: "3px" }}>
                            <span className="window-ended-tag">Ended Window</span>
                            <span className="position-ticker">{position.ticker}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className={`position-side-badge ${position.side}`}>
                          {position.side === "yes" ? "UP (YES)" : "DOWN (NO)"}
                        </span>
                        {isWon && <span className="settled-outcome-pill won">🏆 WON</span>}
                        {isLost && <span className="settled-outcome-pill lost">❌ LOST</span>}
                        {isRefunded && <span className="settled-outcome-pill refunded">↩ REFUNDED</span>}
                        {!isWon && !isLost && !isRefunded && <span className="settled-outcome-pill pending">⏳ SETTLING</span>}
                      </div>
                    </div>

                    {/* What Happened / Resolution Explanation Banner */}
                    <div className={`settled-story-card ${isWon ? "won" : isLost ? "lost" : isRefunded ? "refunded" : "pending"}`}>
                      <div className="story-header">
                        <span className="story-result-title">
                          {isWon && `✅ Won! Market Settled ${marketOutcome}`}
                          {isLost && `❌ Market Settled ${marketOutcome} (Lost)`}
                          {isRefunded && `↩ Order Expired Unfilled (Refunded)`}
                          {!isWon && !isLost && !isRefunded && `⏳ Market Closed · Resolving`}
                        </span>
                        <span className="story-tag">
                          {isWon ? "Settled @ 100.0¢" : isLost ? "Settled @ 0.0¢" : isRefunded ? "100% Refunded" : "Awaiting Oracle"}
                        </span>
                      </div>
                      <p className="story-description">
                        {isWon && (
                          `You predicted ${position.side === "yes" ? "UP" : "DOWN"}. Because the price moved in your favor, each of your ${position.contracts.toLocaleString()} contracts resolved to 100.0¢ ($1.00 tUSDC).`
                        )}
                        {isLost && (
                          `You predicted ${position.side === "yes" ? "UP" : "DOWN"}. Because this window finished ${marketOutcome}, contracts expired out-of-the-money at 0.0¢ with $0.00 payout.`
                        )}
                        {isRefunded && (
                          `Your limit order did not match with a counterparty before this window closed. Your $${totalCost.toFixed(2)} tUSDC collateral was returned 100% to your wallet.`
                        )}
                        {!isWon && !isLost && !isRefunded && (
                          `Trading has closed for this window. The Somnia oracle is publishing the final price to determine winners.`
                        )}
                      </p>
                    </div>

                    <div className="position-metrics-grid">
                      <div className="metric-box">
                        <span className="m-label">Your Prediction</span>
                        <span className="m-val">{position.contracts.toLocaleString()} {position.side.toUpperCase()} @ {position.avgPrice.toFixed(1)}¢</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Initial Cost</span>
                        <span className="m-val">${totalCost.toFixed(2)} tUSDC</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Final Payout</span>
                        <span className="m-val" style={{ fontWeight: 700, color: isWon ? "#22c55e" : isLost ? "#ef4444" : "var(--text)" }}>
                          {isWon ? `$${finalPayout.toFixed(2)} tUSDC` : isRefunded ? `$${finalPayout.toFixed(2)} (Refunded)` : "$0.00"}
                        </span>
                      </div>
                      <div className="metric-box">
                        <span className="m-label">Realized P&L</span>
                        <span className={`m-val ${isRefunded ? "" : position.pnl >= 0 ? "text-success" : "text-danger"}`}>
                          {isRefunded ? "$0.00 (0.0%)" : `${position.pnl >= 0 ? "+" : ""}$${position.pnl.toFixed(2)} (${position.pnlPercent >= 0 ? "+" : ""}${position.pnlPercent.toFixed(1)}%)`}
                        </span>
                      </div>
                    </div>

                    <div className="position-footer-actions">
                      {isWon && (
                        <button
                          className="position-action-btn redeem"
                          onClick={() => handleRedeem(position)}
                          disabled={redeemingId === position.ticker}
                        >
                          <Trophy size={14} />
                          <span>{redeemingId === position.ticker ? "Redeeming..." : `Claim Payout ($${finalPayout.toFixed(2)} tUSDC)`}</span>
                        </button>
                      )}
                      <button
                        className="trade-next-btn"
                        onClick={() => handleTradeMore(position)}
                      >
                        <span>Trade Active Window</span>
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

      {/* Tab 2: Trade History */}
      {activeTab === "history" && (
        <div className="tab-pane">
          <TradeHistory walletAddress={walletAddress} />
        </div>
      )}

      {/* Tab 3: Transfers (Deposits & Withdrawals) */}
      {activeTab === "transfers" && (
        <div className="tab-pane">
          <TransferHistory
            walletAddress={walletAddress}
            collateralBalance={collateralBalance}
            onOpenDeposit={() => setWalletModal("deposit")}
            onOpenWithdraw={() => setWalletModal("withdraw")}
          />
        </div>
      )}

      {/* Tab 4: Performance & Stats */}
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
                <XCircle size={18} className={activePositionToClose.isRested ? "text-warning" : "text-danger"} />
                <span>{activePositionToClose.isRested ? "Cancel Resting Order" : "Close Position"}</span>
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
                  <span className="close-modal-stat-label">{activePositionToClose.isRested ? "Order Contracts" : "Contracts Held"}</span>
                  <span className="close-modal-stat-value">{activePositionToClose.contracts.toLocaleString()}</span>
                </div>
                <div className="close-modal-stat-item">
                  <span className="close-modal-stat-label">{activePositionToClose.isRested ? "Order Price" : "Entry Avg"}</span>
                  <span className="close-modal-stat-value">{activePositionToClose.avgPrice.toFixed(1)}¢</span>
                </div>
                <div className="close-modal-stat-item">
                  <span className="close-modal-stat-label">Current Mark</span>
                  <span className="close-modal-stat-value">{activePositionToClose.currentPrice.toFixed(1)}¢</span>
                </div>
              </div>
            </div>

            {activePositionToClose.isRested && (
              <div className="close-modal-resting-banner">
                <AlertCircle size={18} className="resting-banner-icon" />
                <div className="resting-banner-content">
                  <div className="resting-banner-heading">Unfilled Limit Order (Escrowed)</div>
                  <div className="resting-banner-text">
                    This order is currently resting on the Somnia order book. Cancelling will withdraw the order on-chain and refund <strong>100% of your collateral (${((activePositionToClose.contracts * activePositionToClose.avgPrice) / 100).toFixed(2)} tUSDC)</strong> directly to your wallet.
                  </div>
                </div>
              </div>
            )}

            {!activePositionToClose.isRested && (
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
            )}

            {/* Financial Proceeds Breakdown */}
            {activePositionToClose.isRested ? (
              <div className="close-modal-proceeds-box resting-proceeds">
                <div className="proceeds-row">
                  <span>Collateral in Escrow:</span>
                  <span>${((activePositionToClose.contracts * activePositionToClose.avgPrice) / 100).toFixed(2)} tUSDC</span>
                </div>
                <div className="proceeds-row">
                  <span>Realized P&L:</span>
                  <span>$0.00 (Collateral Returned)</span>
                </div>
                <div className="proceeds-row highlight">
                  <span>Net Refund to Receive:</span>
                  <span className="proceeds-value-large text-warning">
                    ${((activePositionToClose.contracts * activePositionToClose.avgPrice) / 100).toFixed(2)} tUSDC
                  </span>
                </div>
              </div>
            ) : (
              (() => {
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
              })()
            )}

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
                Back
              </button>
              <button
                type="button"
                className={`modal-confirm-btn ${activePositionToClose.isRested ? "cancel-resting-btn" : ""}`}
                onClick={handleConfirmClose}
                disabled={!!closingStatus || (!activePositionToClose.isRested && (closeShares <= 0 || closeShares > activePositionToClose.contracts))}
              >
                {closingStatus ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    <span>{closingStatus}</span>
                  </>
                ) : activePositionToClose.isRested ? (
                  <span>
                    Cancel Order · Refund ${((activePositionToClose.contracts * activePositionToClose.avgPrice) / 100).toFixed(2)} tUSDC
                  </span>
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

      {/* Wallet Actions (Deposit & Withdraw Modals) */}
      {walletAddress && (
        <WalletActions
          walletAddress={walletAddress}
          usdcBalance={collateralBalance}
          onTransactionComplete={fetchPortfolio}
          modalOpen={walletModal}
          onModalClose={() => setWalletModal(null)}
          showButtons={false}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
