import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, TrendingUp, Zap, SlidersHorizontal, Info } from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import type { Market, MarketGroup } from "../types";
import { getSubtitle, formatMarketTitle, resolveMarketIcon } from "../types";
import { recordTrade, getPositions, type PositionRecord } from "../services/userService";
import { placeDreamDexOrder, getPoolBookTops, DREAMDEX_CONTRACTS, type PoolBookTops } from "../services/dreamdex";
import PriceChart from "./PriceChart";
import styles from "./TradePage.module.css";

interface TradePageProps {
  group: MarketGroup;
  onBack: () => void;
  onOrderComplete?: (success: boolean, message: string) => void;
}

const TradePage: React.FC<TradePageProps> = ({
  group,
  onBack,
  onOrderComplete,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { address, connected, collateralBalance, walletProvider, refreshBalance } = useEvmWallet();
  const evmAddress = address || null;

  // Read action and side from URL params
  const urlAction = searchParams.get("action") as "buy" | "sell" | null;
  const urlSide = searchParams.get("side") as "yes" | "no" | null;

  // Match specific market from URL /trade/:ticker if present
  const routeTicker = useMemo(() => {
    const match = location.pathname.match(/\/trade\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  const initialMarket = useMemo(() => {
    if (routeTicker) {
      const rtLower = routeTicker.toLowerCase();
      const rtSuffix = routeTicker.split("-").pop()?.toLowerCase();
      const found = group.markets.find((m) => {
        if (m.ticker.toLowerCase() === rtLower) return true;
        if (m.marketId?.toLowerCase() === rtLower) return true;
        const mSuffix = m.ticker.split("-").pop()?.toLowerCase();
        if (mSuffix && rtSuffix && mSuffix === rtSuffix) return true;
        if (m.marketId && rtSuffix && m.marketId.toLowerCase().endsWith(rtSuffix)) return true;
        return false;
      });
      if (found) return found;
    }
    return group.markets[0] || ({} as Market);
  }, [group.markets, routeTicker]);

  const [selectedMarket, setSelectedMarket] = useState<Market>(initialMarket);

  useEffect(() => {
    if (initialMarket && initialMarket.ticker && initialMarket.ticker !== selectedMarket?.ticker) {
      setSelectedMarket(initialMarket);
    }
  }, [initialMarket]);

  const [orderSide, setOrderSide] = useState<"yes" | "no">(urlSide || "yes");
  const [tradeAction, setTradeAction] = useState<"buy" | "sell">(urlAction || "buy");
  const [orderAmount, setOrderAmount] = useState<number | "">("");
  const [inputType, setInputType] = useState<"usd" | "shares">(urlAction === "sell" ? "shares" : "usd");
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);
  const [showTradePanelMobile, setShowTradePanelMobile] = useState(urlAction === "sell");
  const MAX_VISIBLE_OUTCOMES = 4;
  const visibleMarkets = showAllOutcomes 
    ? group.markets 
    : group.markets.slice(0, MAX_VISIBLE_OUTCOMES);
  const hasMoreOutcomes = group.markets.length > MAX_VISIBLE_OUTCOMES;

  // Query user positions to provide holding context and quick-sell shortcuts
  const [userPositions, setUserPositions] = useState<PositionRecord[]>([]);

  const fetchPositions = async () => {
    if (!evmAddress) {
      setUserPositions([]);
      return;
    }
    try {
      const res = await getPositions(evmAddress);
      const arr: PositionRecord[] = Array.isArray(res)
        ? res
        : Array.isArray((res as any)?.positions)
        ? (res as any).positions
        : [];
      setUserPositions(arr);
    } catch {
      setUserPositions([]);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [evmAddress]);

  const heldPosition = useMemo(() => {
    return userPositions.find(
      (p) => p.ticker === selectedMarket.ticker && (p.contracts || 0) > 0
    );
  }, [userPositions, selectedMarket.ticker]);

  // Live market updated from websocket feed without re-triggering market selection
  const activeMarket = useMemo(() => {
    return group.markets.find((m) => m.ticker === selectedMarket.ticker) || selectedMarket;
  }, [group.markets, selectedMarket]);

  // Order mode state: "market" (instant taker fill) or "limit" (custom maker price)
  const [orderMode, setOrderMode] = useState<"market" | "limit">("market");
  const [customLimitPrice, setCustomLimitPrice] = useState<number | null>(null);
  const [bookTops, setBookTops] = useState<PoolBookTops | null>(null);

  // Poll live top of book directly from Somnia pool contract every 3.5s
  useEffect(() => {
    const pool = activeMarket.poolAddress || selectedMarket.poolAddress;
    if (!pool || pool.toLowerCase() === DREAMDEX_CONTRACTS.binaryMarketsModule.toLowerCase()) return;
    let mounted = true;
    const fetchTops = async () => {
      try {
        const tops = await getPoolBookTops(pool);
        if (mounted) setBookTops(tops);
      } catch {}
    };
    fetchTops();
    const interval = setInterval(fetchTops, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeMarket.poolAddress, selectedMarket.poolAddress]);

  // Derive live executable prices from top of book
  const liveBestAskYes = bookTops?.bestAskYes !== null && bookTops?.bestAskYes !== undefined
    ? Math.round(bookTops.bestAskYes * 1000) / 10
    : null;
  const liveBestBidYes = bookTops?.bestBidYes !== null && bookTops?.bestBidYes !== undefined
    ? Math.round(bookTops.bestBidYes * 1000) / 10
    : null;
  const liveBestAskNo = bookTops?.bestAskNo !== null && bookTops?.bestAskNo !== undefined
    ? Math.round(bookTops.bestAskNo * 1000) / 10
    : null;
  const liveBestBidNo = bookTops?.bestBidNo !== null && bookTops?.bestBidNo !== undefined
    ? Math.round(bookTops.bestBidNo * 1000) / 10
    : null;

  // Real-time executable market price (Taker)
  const executableMarketPrice = useMemo(() => {
    if (tradeAction === "buy") {
      if (orderSide === "yes") {
        return liveBestAskYes ?? activeMarket.price_yes;
      } else {
        return liveBestAskNo ?? activeMarket.price_no;
      }
    } else {
      // Sell takes the highest bid
      if (orderSide === "yes") {
        return liveBestBidYes ?? activeMarket.price_yes;
      } else {
        return liveBestBidNo ?? activeMarket.price_no;
      }
    }
  }, [tradeAction, orderSide, liveBestAskYes, liveBestBidYes, liveBestAskNo, liveBestBidNo, activeMarket.price_yes, activeMarket.price_no]);

  // Active price used for execution & calculation
  const price = orderMode === "limit" && customLimitPrice !== null ? customLimitPrice : executableMarketPrice;
  
  // Calculate cost and shares
  const cost = inputType === "usd" 
    ? Number(orderAmount) || 0
    : (Number(orderAmount) || 0) * (price / 100);
    
  const shares = inputType === "shares"
    ? Number(orderAmount) || 0
    : Math.floor((Number(orderAmount) || 0) / (price / 100));
  
  const totalWithFee = cost;
  const netSellProceeds = cost;
  
  const potentialReturn = shares; // Each winning contract pays 1 tUSDC
  const expectedProfit = Math.max(0, potentialReturn - totalWithFee);
  const roi = totalWithFee > 0 ? (expectedProfit / totalWithFee) * 100 : 0;

  // Realized P&L calculation when selling an existing position
  const costBasis = heldPosition && heldPosition.avg_price ? (heldPosition.avg_price / 100) * shares : null;
  const estSellPnl = costBasis !== null ? netSellProceeds - costBasis : null;
  const estSellPnlPct = costBasis && costBasis > 0 ? (estSellPnl! / costBasis) * 100 : null;

  const isMarketClosed = Boolean(activeMarket.closed) || (Boolean(activeMarket.expiry) && Date.now() / 1000 > (activeMarket.expiry || 0));

  const handleTrade = async () => {
    if (isMarketClosed) {
      onOrderComplete?.(false, "This market's trading window has closed.");
      return;
    }
    if (!connected || !walletProvider) {
      onOrderComplete?.(false, "Please connect your wallet first");
      return;
    }
    if (shares <= 0) {
      onOrderComplete?.(false, "Please enter a valid trade amount");
      return;
    }

    const poolAddress = activeMarket.poolAddress || selectedMarket.poolAddress;
    if (!poolAddress || poolAddress.toLowerCase() === DREAMDEX_CONTRACTS.binaryMarketsModule.toLowerCase()) {
      onOrderComplete?.(false, "This market does not have an active on-chain trading pool. Please select a LIVE market.");
      return;
    }
    setOrderStatus(tradeAction === "sell" ? "Authorizing tokens & selling..." : "Submitting to Somnia...");

    try {
      const result = await placeDreamDexOrder({
        walletProvider,
        poolAddress,
        side: orderSide,
        action: tradeAction,
        priceProb: price / 100,
        contractsAmount: shares,
        orderType: orderMode === "market" ? "market" : "limit",
      });

      // Record trade locally
      if (evmAddress) {
        const estPnl = tradeAction === "sell" && heldPosition
          ? ((price - (heldPosition.avg_price || price)) * shares) / 100
          : undefined;

        await recordTrade(evmAddress, {
          ticker: activeMarket.ticker || selectedMarket.ticker,
          title: activeMarket.title || selectedMarket.title || group.title,
          side: orderSide,
          action: tradeAction,
          amount: shares,
          price: price,
          total_cost: tradeAction === "sell" ? netSellProceeds : totalWithFee,
          platform: "dreamdex",
          tx_signature: result.txHash,
          platform_fee: 0,
          pnl: estPnl,
        }).catch(() => {});
      }

      await refreshBalance();
      await fetchPositions();

      if (result.isFilled) {
        onOrderComplete?.(
          true,
          `⚡ Order filled immediately on Somnia Shannon! ${shares.toLocaleString()} contracts @ ${price.toFixed(1)}¢`
        );
      } else if (result.isRested) {
        onOrderComplete?.(
          true,
          `Order placed as resting limit order on the book @ ${price.toFixed(1)}¢`
        );
      } else {
        onOrderComplete?.(
          true,
          `${tradeAction === "buy" ? "Bought" : "Sold"} ${shares.toLocaleString()} ${orderSide.toUpperCase()} contracts successfully!`
        );
      }
      setOrderAmount("");
      setOrderStatus(null);
    } catch (error: any) {
      console.error("DreamDEX trade error:", error);
      setOrderStatus(null);
      const msg = error?.reason || error?.message || "Trade submission failed.";
      onOrderComplete?.(false, msg);
    }
  };

  const walletInfo = evmAddress 
    ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` 
    : null;

  const chartMarkets = useMemo(() => {
    if (activeMarket && activeMarket.ticker) {
      return [
        {
          ticker: `${activeMarket.ticker}-yes`,
          name: "Up (Yes)",
          currentPrice: activeMarket.price_yes,
          color: "#5eae8b",
          tokenId: activeMarket.yes_token_id,
          marketId: activeMarket.marketId,
        },
        {
          ticker: `${activeMarket.ticker}-no`,
          name: "Down (No)",
          currentPrice: activeMarket.price_no,
          color: "#ef4444",
          tokenId: activeMarket.no_token_id,
          marketId: activeMarket.marketId,
        },
      ];
    }
    return group.markets.map((m) => ({
      ticker: m.ticker,
      name: getSubtitle(m, group.title),
      currentPrice: m.price_yes,
      tokenId: m.yes_token_id,
      marketId: m.marketId,
    }));
  }, [activeMarket, group.markets, group.title]);

  return (
    <div className={styles.page}>
      {/* Main Content Column */}
      <div className={styles.mainContent}>
        {/* Back Navigation */}
        <button className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to markets</span>
        </button>

        {/* Header with image and title */}
        <div className={styles.header}>
          <img
            src={group.image || resolveMarketIcon(group.ticker, group.title)}
            alt=""
            className={styles.headerImage}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/icons/nour.png";
            }}
          />
          <div className={styles.headerInfo} style={{ marginLeft: 0 }}>
            <h1 className={styles.title}>{formatMarketTitle(group.title)}</h1>
          </div>
        </div>

        {/* Price Chart */}
        <div className={styles.chartSection}>
          <PriceChart
            markets={chartMarkets}
            volume={group.totalVolume}
          />
        </div>

        {/* Outcome Table */}
        <div className={styles.outcomeTable}>
          <div className={styles.outcomeHeader}>
            <span>Outcome Window</span>
            <span>Probability</span>
            <span></span>
            <span></span>
          </div>
          {visibleMarkets.map((m) => {
            const optionName = getSubtitle(m, group.title);

            return (
              <div
                key={m.ticker}
                className={styles.outcomeRow}
                onClick={() => setSelectedMarket(m)}
              >
                <span className={styles.outcomeName}>{optionName}</span>
                <span className={styles.outcomeChance}>
                  {m.price_yes}%
                  <span className={`${styles.chanceChange} ${styles.up}`}>
                    <TrendingUp size={10} style={{ marginRight: 2 }} />
                  </span>
                </span>
                <button 
                  className="btn-yes"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMarket(m);
                    setOrderSide("yes");
                    setShowTradePanelMobile(true);
                  }}
                >
                  Up {m.price_yes}¢
                </button>
                <button 
                  className="btn-no"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMarket(m);
                    setOrderSide("no");
                    setShowTradePanelMobile(true);
                  }}
                >
                  Down {m.price_no}¢
                </button>
              </div>
            );
          })}
          {hasMoreOutcomes && (
            <button 
              className={styles.showMoreBtn}
              onClick={() => setShowAllOutcomes(!showAllOutcomes)}
            >
              {showAllOutcomes 
                ? "Show less" 
                : `Show all ${group.markets.length} outcomes`
              }
            </button>
          )}
        </div>
      </div>

      {/* Trade Panel - Sidebar (becomes modal on mobile) */}
      <div className={`${styles.tradePanel} ${showTradePanelMobile ? styles.tradePanelOpen : ''}`}>
        <button 
          className={styles.closePanelBtn}
          onClick={() => setShowTradePanelMobile(false)}
        >
          ×
        </button>
        <div className={styles.tradePanelHeader}>
          <div>
            <div className={styles.tradePanelTitle}>
              {group.title.length > 40 ? group.title.substring(0, 40) + "..." : group.title}
            </div>
            <div className={styles.tradePanelSubtitle}>
              {tradeAction === "buy" ? "Buy" : "Sell / Close"} {orderSide === "yes" ? "UP (YES)" : "DOWN (NO)"} • {getSubtitle(selectedMarket, group.title)}
            </div>
          </div>
        </div>

        {/* Position Context Banner if user holds contracts */}
        {heldPosition && (
          <div className={styles.positionBanner}>
            <div className={styles.positionBannerLeft}>
              <span className={`${styles.positionSideTag} ${heldPosition.side === "yes" ? styles.up : styles.down}`}>
                {heldPosition.side === "yes" ? "UP" : "DOWN"}
              </span>
              <div className={styles.positionBannerInfo}>
                <span className={styles.positionBannerTitle}>
                  You hold <strong>{heldPosition.contracts.toLocaleString()}</strong> contracts
                </span>
                <span className={styles.positionBannerSub}>
                  Entry: {(heldPosition.avg_price || 50).toFixed(1)}¢ · Mark: {price}¢
                </span>
              </div>
            </div>

            {tradeAction === "buy" ? (
              <button
                type="button"
                className={styles.positionBannerAction}
                onClick={() => {
                  setTradeAction("sell");
                  setOrderSide(heldPosition.side as "yes" | "no");
                  setInputType("shares");
                  setOrderAmount(heldPosition.contracts);
                }}
              >
                Close / Sell ↗
              </button>
            ) : (
              <button
                type="button"
                className={styles.positionBannerAction}
                onClick={() => {
                  setInputType("shares");
                  setOrderAmount(heldPosition.contracts);
                }}
              >
                Sell All (100%)
              </button>
            )}
          </div>
        )}

        {/* Buy/Sell Toggle */}
        <div className={styles.buySellToggle}>
          <button 
            className={`${styles.toggleBtn} ${tradeAction === "buy" ? styles.active : ""}`}
            onClick={() => setTradeAction("buy")}
          >
            Buy
          </button>
          <button 
            className={`${styles.toggleBtn} ${tradeAction === "sell" ? styles.active : ""}`}
            onClick={() => {
              setTradeAction("sell");
              if (heldPosition) {
                setOrderSide(heldPosition.side as "yes" | "no");
                setInputType("shares");
                if (!orderAmount) {
                  setOrderAmount(heldPosition.contracts);
                }
              } else {
                setInputType("shares");
              }
            }}
          >
            Sell / Close
          </button>
        </div>

        {/* Order Mode Toggle (Market vs Limit) */}
        <div className={styles.orderModeToggle}>
          <button
            type="button"
            className={`${styles.modeBtn} ${orderMode === "market" ? styles.modeBtnActive : ""}`}
            onClick={() => {
              setOrderMode("market");
              setCustomLimitPrice(null);
            }}
          >
            <Zap size={13} className={styles.modeZapIcon} />
            Market (Instant Fill)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${orderMode === "limit" ? styles.modeBtnActive : ""}`}
            onClick={() => {
              setOrderMode("limit");
              if (customLimitPrice === null) {
                setCustomLimitPrice(executableMarketPrice);
              }
            }}
          >
            <SlidersHorizontal size={13} />
            Limit
          </button>
        </div>

        {/* Yes (Up) / No (Down) Buttons */}
        <div className={styles.sideBtns}>
          <button
            className={`${styles.sideBtn} ${styles.yes} ${orderSide === "yes" ? styles.active : ""}`}
            onClick={() => setOrderSide("yes")}
          >
            Up (Yes) {orderMode === "market" && tradeAction === "buy" && liveBestAskYes ? `${liveBestAskYes}¢` : `${activeMarket.price_yes}¢`}
          </button>
          <button
            className={`${styles.sideBtn} ${styles.no} ${orderSide === "no" ? styles.active : ""}`}
            onClick={() => setOrderSide("no")}
          >
            Down (No) {orderMode === "market" && tradeAction === "buy" && liveBestAskNo ? `${liveBestAskNo}¢` : `${activeMarket.price_no}¢`}
          </button>
        </div>

        {/* Live Execution / Limit Selector */}
        {orderMode === "market" ? (
          <div className={styles.instantExecutionBanner}>
            <div className={styles.instantHeader}>
              <span className={styles.instantBadge}>
                <Zap size={11} className={styles.zapIcon} />
                Instant Fill @ {executableMarketPrice.toFixed(1)}¢
              </span>
              <span className={styles.poolLiquidityIndicator}>
                Live Book
              </span>
            </div>
            <div className={styles.instantDesc}>
              {tradeAction === "buy"
                ? `Matches resting asks on Somnia Shannon testnet immediately.`
                : `Matches resting bids on Somnia Shannon testnet immediately.`}
            </div>
          </div>
        ) : (
          <div className={styles.limitPriceRow}>
            <div className={styles.limitPriceHeader}>
              <span className={styles.limitLabel}>Limit Price</span>
              <span className={styles.orderbookSpread}>
                Orderbook: {liveBestBidYes !== null ? `${liveBestBidYes}¢` : "—"} / {liveBestAskYes !== null ? `${liveBestAskYes}¢` : "—"}
              </span>
            </div>
            <div className={styles.limitInputContainer}>
              <button
                type="button"
                className={styles.limitStepBtn}
                onClick={() => setCustomLimitPrice((prev) => Math.max(1, Math.round(((prev ?? executableMarketPrice) - 1) * 10) / 10))}
              >
                -
              </button>
              <div className={styles.limitInputWrapper}>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="99"
                  value={price}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) setCustomLimitPrice(Math.max(1, Math.min(99, Math.round(v * 10) / 10)));
                  }}
                  className={styles.limitInput}
                />
                <span className={styles.centSuffix}>¢</span>
              </div>
              <button
                type="button"
                className={styles.limitStepBtn}
                onClick={() => setCustomLimitPrice((prev) => Math.min(99, Math.round(((prev ?? executableMarketPrice) + 1) * 10) / 10))}
              >
                +
              </button>
            </div>
            {tradeAction === "buy" && (orderSide === "yes" ? liveBestAskYes : liveBestAskNo) && price < (orderSide === "yes" ? liveBestAskYes! : liveBestAskNo!) && (
              <div className={styles.restingWarning}>
                <Info size={12} />
                Price is below best ask ({(orderSide === "yes" ? liveBestAskYes : liveBestAskNo)}¢). Will rest on the orderbook.
              </div>
            )}
          </div>
        )}

        {/* Amount Input */}
        <div className={styles.amountSection}>
          <div className={styles.amountHeader}>
            <span className={styles.amountLabel}>
              {tradeAction === "sell" ? "Contracts to Sell" : inputType === "usd" ? "Amount (tUSDC)" : "Shares"}
            </span>
            {tradeAction === "buy" && (
              <button 
                className={styles.currencyToggle}
                onClick={() => setInputType(prev => prev === "usd" ? "shares" : "usd")}
              >
                Switch to {inputType === "usd" ? "shares" : "tUSDC"} ▾
              </button>
            )}
          </div>
          <div className={styles.inputContainer}>
            {inputType === "usd" && <span className={styles.currencyPrefix}>$</span>}
            <input
              type="text"
              value={orderAmount}
              placeholder="0"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                  setOrderAmount(val as any);
                }
              }}
              className={styles.amountInput}
            />
          </div>

          {/* Quick Percentage Fill Chips for Selling */}
          {tradeAction === "sell" && heldPosition && heldPosition.side === orderSide && (
            <div className={styles.quickPercentRow}>
              <span className={styles.quickPercentLabel}>Quick Fill:</span>
              {[25, 50, 75, 100].map((pct) => {
                const targetVal = pct === 100 
                  ? heldPosition.contracts 
                  : Math.max(1, Math.floor(heldPosition.contracts * (pct / 100)));
                const isActive = Number(orderAmount) === targetVal;
                return (
                  <button
                    key={pct}
                    type="button"
                    className={`${styles.quickPercentBtn} ${isActive ? styles.quickPercentActive : ""}`}
                    onClick={() => {
                      setInputType("shares");
                      setOrderAmount(targetVal);
                    }}
                  >
                    {pct === 100 ? "100% (MAX)" : `${pct}%`}
                  </button>
                );
              })}
            </div>
          )}

          {tradeAction === "buy" ? (
            <>
              <div className={styles.summaryRow}>
                <span>Est. Shares:</span>
                <span>{shares.toLocaleString()}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                <span>Total Cost:</span>
                <span>${cost.toFixed(2)} tUSDC</span>
              </div>
              {Number(orderAmount) > 0 && (
                <div className={`${styles.summaryRow} ${styles.profitRow}`}>
                  <span>Potential Payout:</span>
                  <span>+${expectedProfit.toFixed(2)} ({roi.toFixed(1)}% ROI)</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.summaryRow}>
                <span>Contracts to Sell:</span>
                <span>{shares.toLocaleString()}</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                <span>Payout to Wallet:</span>
                <span className={styles.proceedsValue}>${netSellProceeds.toFixed(2)} tUSDC</span>
              </div>
              {estSellPnl !== null && (
                <div className={styles.summaryRow} style={{ borderTop: "none", paddingTop: "4px" }}>
                  <span>Estimated Realized P&L:</span>
                  <span style={{ color: estSellPnl >= 0 ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                    {estSellPnl >= 0 ? "+" : ""}${estSellPnl.toFixed(2)} ({estSellPnl >= 0 ? "+" : ""}{estSellPnlPct?.toFixed(1)}%)
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Buy: Insufficient collateral balance */}
        {connected && tradeAction === "buy" && cost > 0 && collateralBalance < totalWithFee && (
          <div style={{ margin: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "#ef4444" }}>Insufficient collateral balance</span>
            <button
              type="button"
              onClick={() => navigate("/portfolio")}
              style={{ background: "transparent", border: "none", color: "var(--primary)", textDecoration: "underline", cursor: "pointer", fontSize: "12px", padding: 0 }}
            >
              Claim tUSDC in Portfolio ↗
            </button>
          </div>
        )}

        {/* Sell: Exceeds held contracts warning */}
        {connected && tradeAction === "sell" && heldPosition && heldPosition.side === orderSide && shares > heldPosition.contracts && (
          <div style={{ margin: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "#ef4444" }}>
              Exceeds held contracts ({heldPosition.contracts} available)
            </span>
          </div>
        )}

        {/* Submit Trade Button */}
        <button
          className={`${styles.tradeBtn} ${tradeAction === "sell" ? styles.sellBtn : ""}`}
          onClick={handleTrade}
          disabled={
            isMarketClosed ||
            !!orderStatus || 
            (connected && (!orderAmount || Number(orderAmount) <= 0)) ||
            (connected && tradeAction === "buy" && collateralBalance < totalWithFee) ||
            (connected && tradeAction === "sell" && !!heldPosition && heldPosition.side === orderSide && shares > heldPosition.contracts)
          }
        >
          {isMarketClosed ? "Trading Window Closed" :
           orderStatus || (
            !connected ? "Connect Wallet" : 
            (tradeAction === "buy" && collateralBalance < totalWithFee) ? "Insufficient tUSDC Balance" :
            (tradeAction === "sell" && !!heldPosition && heldPosition.side === orderSide && shares > heldPosition.contracts) ? `Max ${heldPosition.contracts} Contracts` :
            tradeAction === "sell" ? `SELL ${shares || 0} ${orderSide === "yes" ? "UP" : "DOWN"} · Payout $${netSellProceeds.toFixed(2)}` :
            `BUY ${orderSide === "yes" ? "UP" : "DOWN"} ($${totalWithFee.toFixed(2)})`
          )}
        </button>

        {walletInfo && (
          <div className={styles.walletInfo}>
            Somnia Testnet: {walletInfo}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradePage;
