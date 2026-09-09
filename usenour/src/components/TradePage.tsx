import React, { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import type { Market, MarketGroup } from "../types";
import { getSubtitle, formatMarketTitle, resolveMarketIcon } from "../types";
import { recordTrade } from "../services/userService";
import { calculatePlatformFee } from "../config/fees";
import { placeDreamDexOrder, DREAMDEX_CONTRACTS } from "../services/dreamdex";
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
  const [searchParams] = useSearchParams();
  const { address, connected, collateralBalance, walletProvider, refreshBalance } = useEvmWallet();
  const evmAddress = address || null;

  // Read action and side from URL params
  const urlAction = searchParams.get("action") as "buy" | "sell" | null;
  const urlSide = searchParams.get("side") as "yes" | "no" | null;

  const [selectedMarket, setSelectedMarket] = useState<Market>(group.markets[0] || ({} as Market));
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

  // Derive active price based on outcome side
  const price = orderSide === "yes" ? selectedMarket.price_yes : selectedMarket.price_no;
  
  // Calculate cost and shares
  const cost = inputType === "usd" 
    ? Number(orderAmount) || 0
    : (Number(orderAmount) || 0) * (price / 100);
    
  const shares = inputType === "shares"
    ? Number(orderAmount) || 0
    : Math.floor((Number(orderAmount) || 0) / (price / 100));
  
  const platformFee = calculatePlatformFee(cost);
  const totalWithFee = cost + platformFee;
  
  const potentialReturn = shares; // Each winning contract pays 1 tUSDC
  const expectedProfit = Math.max(0, potentialReturn - totalWithFee);
  const roi = totalWithFee > 0 ? (expectedProfit / totalWithFee) * 100 : 0;

  const handleTrade = async () => {
    if (!connected || !walletProvider) {
      onOrderComplete?.(false, "Please connect your wallet first");
      return;
    }
    if (shares <= 0) {
      onOrderComplete?.(false, "Please enter a valid trade amount");
      return;
    }

    const poolAddress = selectedMarket.poolAddress || DREAMDEX_CONTRACTS.binaryMarketsModule;
    setOrderStatus("Submitting to Somnia...");

    try {
      const result = await placeDreamDexOrder({
        walletProvider,
        poolAddress,
        side: orderSide,
        action: tradeAction,
        priceProb: price / 100,
        contractsAmount: shares,
        orderType: "ioc",
      });

      // Record trade locally
      if (evmAddress) {
        await recordTrade(evmAddress, {
          ticker: selectedMarket.ticker,
          title: group.title,
          side: orderSide,
          action: tradeAction,
          amount: shares,
          price: price,
          total_cost: totalWithFee,
          platform: "dreamdex",
          tx_signature: result.txHash,
          platform_fee: platformFee,
        }).catch(() => {});
      }

      await refreshBalance();
      setOrderStatus(null);
      onOrderComplete?.(
        true,
        `Executed on Somnia Shannon! ${tradeAction.toUpperCase()} ${shares} ${orderSide.toUpperCase()} at ${price}¢ (Tx: ${result.txHash.slice(0, 10)}...)`
      );
      setOrderAmount("");
    } catch (error: any) {
      console.error("DreamDEX trade error:", error);
      setOrderStatus(null);
      const msg = error?.reason || error?.message || "Trade submission failed. Check your tUSDC balance.";
      onOrderComplete?.(false, msg);
    }
  };

  const walletInfo = evmAddress 
    ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` 
    : null;

  const chartMarkets = useMemo(() => {
    if (selectedMarket) {
      return [
        {
          ticker: `${selectedMarket.ticker}-yes`,
          name: "Up (Yes)",
          currentPrice: selectedMarket.price_yes,
          color: "#5eae8b",
          tokenId: selectedMarket.yes_token_id,
          marketId: selectedMarket.marketId,
        },
        {
          ticker: `${selectedMarket.ticker}-no`,
          name: "Down (No)",
          currentPrice: selectedMarket.price_no,
          color: "#ef4444",
          tokenId: selectedMarket.no_token_id,
          marketId: selectedMarket.marketId,
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
  }, [selectedMarket, group.markets, group.title]);

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
              {tradeAction === "buy" ? "Buy" : "Sell"} {orderSide === "yes" ? "UP (YES)" : "DOWN (NO)"} • {getSubtitle(selectedMarket, group.title)}
            </div>
          </div>
        </div>

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
            onClick={() => setTradeAction("sell")}
          >
            Sell
          </button>
        </div>

        {/* Yes (Up) / No (Down) Buttons */}
        <div className={styles.sideBtns}>
          <button
            className={`${styles.sideBtn} ${styles.yes} ${orderSide === "yes" ? styles.active : ""}`}
            onClick={() => setOrderSide("yes")}
          >
            Up (Yes) {selectedMarket.price_yes}¢
          </button>
          <button
            className={`${styles.sideBtn} ${styles.no} ${orderSide === "no" ? styles.active : ""}`}
            onClick={() => setOrderSide("no")}
          >
            Down (No) {selectedMarket.price_no}¢
          </button>
        </div>

        {/* Amount Input */}
        <div className={styles.amountSection}>
          <div className={styles.amountHeader}>
            <span className={styles.amountLabel}>
              {inputType === "usd" ? "Amount (tUSDC)" : "Shares"}
            </span>
            <button 
              className={styles.currencyToggle}
              onClick={() => setInputType(prev => prev === "usd" ? "shares" : "usd")}
            >
              Switch to {inputType === "usd" ? "shares" : "tUSDC"} ▾
            </button>
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
          <div className={styles.summaryRow}>
             <span>Est. {inputType === "usd" ? "Shares" : "Cost"}:</span>
             <span>{inputType === "usd" ? shares : `$${cost.toFixed(2)}`}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.feeRow}`}>
             <span>Platform Fee (1.5%):</span>
             <span>${platformFee.toFixed(2)}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.totalRow}`}>
             <span>Total:</span>
             <span>${totalWithFee.toFixed(2)} tUSDC</span>
          </div>

          {tradeAction === "buy" && Number(orderAmount) > 0 && (
            <div className={`${styles.summaryRow} ${styles.profitRow}`}>
               <span>Potential Payout:</span>
               <span>+${expectedProfit.toFixed(2)} ({roi.toFixed(1)}% ROI)</span>
            </div>
          )}
        </div>

        {/* Insufficient Balance Notice if needed */}
        {connected && cost > 0 && collateralBalance < cost && (
          <div style={{ margin: "12px 0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "#ef4444" }}>Insufficient balance</span>
            <button
              type="button"
              onClick={() => navigate("/portfolio")}
              style={{ background: "transparent", border: "none", color: "var(--primary)", textDecoration: "underline", cursor: "pointer", fontSize: "12px", padding: 0 }}
            >
              Claim tUSDC in Portfolio ↗
            </button>
          </div>
        )}

        {/* Submit Trade Button */}
        <button
          className={styles.tradeBtn}
          onClick={handleTrade}
          disabled={
            !!orderStatus || 
            (connected && (!orderAmount || Number(orderAmount) <= 0)) ||
            (connected && tradeAction === "buy" && collateralBalance < cost)
          }
        >
          {orderStatus || (
            !connected ? "Connect Wallet" : 
            (tradeAction === "buy" && collateralBalance < cost) ? "Insufficient tUSDC Balance" :
            `${tradeAction.toUpperCase()} ${orderSide === "yes" ? "UP" : "DOWN"}`
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
