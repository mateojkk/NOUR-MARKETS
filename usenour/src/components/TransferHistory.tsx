import { useState, useEffect, useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Droplets,
  ExternalLink,
  ArrowDownToLine,
  RefreshCw,
  Copy,
  Check,
  Trophy,
  RotateCcw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  getLedgerHistory,
  seedInitialDepositIfEmpty,
  type LedgerEntry,
} from "../services/transferService";
import { SOMNIA_EXPLORER_URL } from "../services/dreamdex";
import styles from "./TransferHistory.module.css";

interface TransferHistoryProps {
  walletAddress: string | null;
  collateralBalance?: number;
}

type FilterType = "all" | "credit" | "debit";

export default function TransferHistory({
  walletAddress,
  collateralBalance = 0,
}: TransferHistoryProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (!walletAddress) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      await seedInitialDepositIfEmpty(walletAddress, collateralBalance);
      const data = await getLedgerHistory(walletAddress);
      setEntries(data);
    } catch (err) {
      console.error("Failed to load ledger history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();

    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener("nour:transfers-updated", handleUpdate);
    return () => {
      window.removeEventListener("nour:transfers-updated", handleUpdate);
    };
  }, [walletAddress, collateralBalance]);

  const handleCopyTx = (txHash: string) => {
    navigator.clipboard.writeText(txHash);
    setCopiedTx(txHash);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const filteredEntries = useMemo(() => {
    if (filter === "all") return entries;
    return entries.filter((e) => e.flow === filter);
  }, [entries, filter]);

  const formatTimestamp = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoDate;
    }
  };

  const getRelativeTime = (isoDate: string) => {
    try {
      const diffMs = Date.now() - new Date(isoDate).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  };

  const getEntryIcon = (entry: LedgerEntry) => {
    if (entry.category === "payout") return <Trophy size={16} />;
    if (entry.category === "refund") return <RotateCcw size={16} />;
    if (entry.category === "trade") {
      return entry.flow === "debit" ? <TrendingDown size={16} /> : <TrendingUp size={16} />;
    }
    if (entry.flow === "credit") {
      return entry.title.includes("Faucet") ? <Droplets size={16} /> : <ArrowDownLeft size={16} />;
    }
    return <ArrowUpRight size={16} />;
  };

  return (
    <div className={styles.container}>
      {/* Controls Header */}
      <div className={styles.header}>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === "all" ? styles.active : ""}`}
            onClick={() => setFilter("all")}
          >
            All Activity ({entries.length})
          </button>
          <button
            className={`${styles.filterTab} ${filter === "credit" ? styles.active : ""}`}
            onClick={() => setFilter("credit")}
          >
            Credits (+) ({entries.filter((e) => e.flow === "credit").length})
          </button>
          <button
            className={`${styles.filterTab} ${filter === "debit" ? styles.active : ""}`}
            onClick={() => setFilter("debit")}
          >
            Debits (-) ({entries.filter((e) => e.flow === "debit").length})
          </button>
        </div>

        <div className={styles.headerRight}>
          <button className={styles.refreshBtn} onClick={loadHistory} title="Reload activity ledger">
            <RefreshCw size={14} className={loading ? "spinning" : ""} />
          </button>
        </div>
      </div>

      {/* Ledger List or Empty State */}
      {loading && entries.length === 0 ? (
        <div className={styles.emptyState}>
          <RefreshCw size={24} className="spinning" style={{ color: "var(--primary)" }} />
          <p style={{ marginTop: "8px" }}>Loading account activity from database...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            <ArrowDownToLine size={28} />
          </div>
          <h4>No {filter !== "all" ? `${filter} ` : ""}activity recorded</h4>
          <p>
            {filter === "all"
              ? "No deposits, withdrawals, or trades found for this wallet yet."
              : `You have no ${filter} transactions in your account history.`}
          </p>
        </div>
      ) : (
        <div className={styles.transferList}>
          {filteredEntries.map((item) => {
            const isCredit = item.flow === "credit";
            const relTime = getRelativeTime(item.timestamp);

            return (
              <div key={item.id} className={styles.transferCard}>
                <div className={styles.leftGroup}>
                  <div className={`${styles.iconWrap} ${isCredit ? styles.iconCredit : styles.iconDebit}`}>
                    {getEntryIcon(item)}
                  </div>

                  <div className={styles.infoCol}>
                    <div className={styles.titleRow}>
                      <span className={styles.transferTitle}>{item.title}</span>
                      <span className={`${styles.flowBadge} ${isCredit ? styles.badgeCredit : styles.badgeDebit}`}>
                        {isCredit ? "+ CREDIT" : "- DEBIT"}
                      </span>
                    </div>

                    {item.subtitle && (
                      <div className={styles.subtitleText}>{item.subtitle}</div>
                    )}

                    <div className={styles.metaRow}>
                      <span className={styles.dateText}>{formatTimestamp(item.timestamp)}</span>
                      {relTime && (
                        <>
                          <span className={styles.bullet}>•</span>
                          <span className={styles.relTimeText}>{relTime}</span>
                        </>
                      )}
                      {item.txHash && (
                        <>
                          <span className={styles.bullet}>•</span>
                          <a
                            href={`${SOMNIA_EXPLORER_URL}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.explorerLink}
                            title="View on Somnia Shannon Explorer"
                          >
                            <span>Tx: {item.txHash.slice(0, 6)}...{item.txHash.slice(-4)}</span>
                            <ExternalLink size={11} />
                          </a>
                          <button
                            className={styles.copyHashBtn}
                            onClick={() => handleCopyTx(item.txHash!)}
                            title="Copy Transaction Hash"
                          >
                            {copiedTx === item.txHash ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.rightGroup}>
                  <div className={`${styles.amountText} ${isCredit ? styles.amountCredit : styles.amountDebit}`}>
                    {isCredit ? "+" : "-"}${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className={styles.amountToken}> {item.token}</span>
                  </div>
                  <div className={styles.flowSubtext}>
                    {isCredit ? "Funds Added" : "Funds Removed"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
