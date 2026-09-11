import { useState, useEffect, useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Droplets,
  ExternalLink,
  CheckCircle2,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import {
  getTransfers,
  seedInitialDepositIfEmpty,
  type TransferRecord,
} from "../services/transferService";
import { SOMNIA_EXPLORER_URL } from "../services/dreamdex";
import styles from "./TransferHistory.module.css";

interface TransferHistoryProps {
  walletAddress: string | null;
  collateralBalance?: number;
  onOpenDeposit?: () => void;
  onOpenWithdraw?: () => void;
}

type FilterType = "all" | "deposit" | "withdrawal";

export default function TransferHistory({
  walletAddress,
  collateralBalance = 0,
  onOpenDeposit,
  onOpenWithdraw,
}: TransferHistoryProps) {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTransfers = async () => {
    if (!walletAddress) {
      setTransfers([]);
      return;
    }
    setLoading(true);
    try {
      await seedInitialDepositIfEmpty(walletAddress, collateralBalance);
      const data = await getTransfers(walletAddress);
      setTransfers(data);
    } catch (err) {
      console.error("Failed to load transfers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();

    const handleUpdate = () => {
      loadTransfers();
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

  const filteredTransfers = useMemo(() => {
    if (filter === "all") return transfers;
    return transfers.filter((t) => t.type === filter);
  }, [transfers, filter]);

  // Financial summary metrics
  const totalDeposited = useMemo(
    () =>
      transfers
        .filter((t) => t.type === "deposit" && t.status === "completed")
        .reduce((sum, t) => sum + t.amount, 0),
    [transfers]
  );

  const totalWithdrawn = useMemo(
    () =>
      transfers
        .filter((t) => t.type === "withdrawal" && t.status === "completed")
        .reduce((sum, t) => sum + t.amount, 0),
    [transfers]
  );

  const formatDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoDate;
    }
  };

  const truncateAddress = (addr?: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className={styles.container}>
      {/* Overview Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total Deposited</span>
          <span className={`${styles.statValue} ${styles.positive}`}>
            +${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className={styles.statUnit}>tUSDC</span>
          </span>
        </div>

        <div className={styles.statDivider} />

        <div className={styles.statItem}>
          <span className={styles.statLabel}>Total Withdrawn</span>
          <span className={`${styles.statValue} ${styles.negative}`}>
            -${totalWithdrawn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className={styles.statUnit}>tUSDC</span>
          </span>
        </div>

        <div className={styles.statDivider} />

        <div className={styles.statItem}>
          <span className={styles.statLabel}>Net Funding</span>
          <span className={styles.statValue}>
            ${(totalDeposited - totalWithdrawn).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className={styles.statUnit}>tUSDC</span>
          </span>
        </div>

        <div className={styles.quickActions}>
          {onOpenDeposit && (
            <button className={styles.actionBtnDeposit} onClick={onOpenDeposit}>
              <ArrowDownToLine size={14} />
              <span>Deposit</span>
            </button>
          )}
          {onOpenWithdraw && (
            <button className={styles.actionBtnWithdraw} onClick={onOpenWithdraw}>
              <ArrowUpFromLine size={14} />
              <span>Withdraw</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Controls Header */}
      <div className={styles.header}>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filter === "all" ? styles.active : ""}`}
            onClick={() => setFilter("all")}
          >
            All Transfers ({transfers.length})
          </button>
          <button
            className={`${styles.filterTab} ${filter === "deposit" ? styles.active : ""}`}
            onClick={() => setFilter("deposit")}
          >
            Deposits ({transfers.filter((t) => t.type === "deposit").length})
          </button>
          <button
            className={`${styles.filterTab} ${filter === "withdrawal" ? styles.active : ""}`}
            onClick={() => setFilter("withdrawal")}
          >
            Withdrawals ({transfers.filter((t) => t.type === "withdrawal").length})
          </button>
        </div>

        <button className={styles.refreshBtn} onClick={loadTransfers} title="Reload history">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Transfer List or Empty State */}
      {loading ? (
        <div className={styles.emptyState}>
          <RefreshCw size={24} className="spinning" style={{ color: "var(--primary)" }} />
          <p style={{ marginTop: "8px" }}>Loading transfers from database...</p>
        </div>
      ) : filteredTransfers.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            <ArrowDownToLine size={32} />
          </div>
          <h4>No {filter !== "all" ? filter : ""} transfers found</h4>
          <p>
            {filter === "all"
              ? "You haven't made any deposits or withdrawals yet. Claim free testnet tUSDC or fund your wallet to get started."
              : `You have no ${filter} records in your history.`}
          </p>
          <div className={styles.emptyActions}>
            {onOpenDeposit && (
              <button className={styles.emptyCtaDeposit} onClick={onOpenDeposit}>
                <Droplets size={15} />
                <span>Deposit / Claim 1,000 tUSDC</span>
              </button>
            )}
            {onOpenWithdraw && (
              <button className={styles.emptyCtaWithdraw} onClick={onOpenWithdraw}>
                <ArrowUpFromLine size={15} />
                <span>Withdraw tUSDC</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.transferList}>
          {filteredTransfers.map((item) => {
            const isDeposit = item.type === "deposit";
            const isFaucet = item.subtype === "faucet";

            return (
              <div key={item.id} className={styles.transferCard}>
                <div className={styles.leftGroup}>
                  <div className={`${styles.iconWrap} ${isDeposit ? styles.iconDeposit : styles.iconWithdraw}`}>
                    {isDeposit ? (
                      isFaucet ? <Droplets size={16} /> : <ArrowDownLeft size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </div>

                  <div className={styles.infoCol}>
                    <div className={styles.titleRow}>
                      <span className={styles.transferTitle}>
                        {isDeposit
                          ? isFaucet
                            ? "Testnet Faucet Collateral"
                            : "Collateral Deposit"
                          : item.toAddress
                          ? `Withdrawal to ${truncateAddress(item.toAddress)}`
                          : "Collateral Withdrawal"}
                      </span>
                      <span className={`${styles.typeBadge} ${isDeposit ? styles.badgeDeposit : styles.badgeWithdraw}`}>
                        {item.type.toUpperCase()}
                      </span>
                    </div>

                    <div className={styles.metaRow}>
                      <span className={styles.dateText}>{formatDate(item.timestamp)}</span>
                      <span className={styles.bullet}>•</span>
                      <span className={styles.networkText}>Somnia Shannon</span>
                      {item.txHash && (
                        <>
                          <span className={styles.bullet}>•</span>
                          <a
                            href={`${SOMNIA_EXPLORER_URL}/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.explorerLink}
                            title="View on Somnia Explorer"
                          >
                            <span>Tx: {item.txHash.slice(0, 8)}...</span>
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
                  <div className={`${styles.amountText} ${isDeposit ? styles.amountDeposit : styles.amountWithdraw}`}>
                    {isDeposit ? "+" : "-"}${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className={styles.amountToken}> {item.token}</span>
                  </div>

                  <div className={styles.statusBadge}>
                    <CheckCircle2 size={12} className={styles.statusIcon} />
                    <span>Completed</span>
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
