import { useState, useEffect } from "react";
import { History } from "lucide-react";
import { getTrades, type TradeRecordResponse } from "../services/userService";
import styles from "./TradeHistory.module.css";

interface TradeHistoryProps {
  walletAddress: string | null;
}

export default function TradeHistory({ walletAddress }: TradeHistoryProps) {
  const [trades, setTrades] = useState<TradeRecordResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      fetchTrades();
    }
  }, [walletAddress]);

  const fetchTrades = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const data = await getTrades(walletAddress);
      setTrades(data);
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return <div className={styles.loadingState}>Loading trades...</div>;
  }

  return (
    <div className={styles.historyContainer}>
      <div className={styles.historyHeader}>
        <h3 className={styles.historyTitle}>Trade History</h3>
      </div>

      {trades.length === 0 ? (
        <div className={styles.emptyState}>
          <History size={32} />
          <p>No trades yet</p>
        </div>
      ) : (
        <div className={styles.tradesList}>
          {trades.map((trade) => (
            <div key={trade.id} className={styles.tradeCard}>
              <div className={styles.tradeInfo}>
                <div className={styles.tradeTitle}>
                  {trade.title || trade.ticker}
                </div>
                <div className={styles.tradeMeta}>
                  <span className={styles.tradePlatform}>{trade.platform}</span>
                  <span>•</span>
                  <span>{formatDate(trade.created_at)}</span>
                  <span>•</span>
                  <span className={`${styles.tradeSide} ${styles[trade.side]}`}>
                    {trade.side}
                  </span>
                </div>
              </div>
              <div className={styles.tradeDetails}>
                <div className={styles.tradeAmount}>
                  {trade.action === "buy" ? "-" : "+"}${trade.total_cost.toFixed(2)}
                </div>
                {(trade.pnl ?? 0) !== 0 && (
                  <div
                    className={`${styles.tradePnl} ${
                      (trade.pnl ?? 0) >= 0 ? styles.positive : styles.negative
                    }`}
                  >
                    {(trade.pnl ?? 0) >= 0 ? "+" : ""}${(trade.pnl ?? 0).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
