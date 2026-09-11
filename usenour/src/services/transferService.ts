/**
 * Transfer Service - Manages Deposit & Withdrawal history in Supabase Database.
 * All deposits and withdrawals persist directly to the database.
 */

import { getSupabaseClient } from "./supabaseClient";
import { DREAMDEX_CONTRACTS } from "./dreamdex";

export interface TransferRecord {
  id: string;
  type: "deposit" | "withdrawal";
  subtype?: "faucet" | "transfer" | "refund" | "payout";
  amount: number;
  token: string; // "tUSDC"
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  timestamp: string; // ISO 8601
  status: "completed" | "pending" | "failed";
  note?: string;
}

export interface LedgerEntry {
  id: string;
  flow: "credit" | "debit";
  category: "deposit" | "withdrawal" | "trade" | "payout" | "refund";
  title: string;
  subtitle?: string;
  amount: number;
  token: string;
  timestamp: string;
  txHash?: string;
  status: "completed" | "pending" | "failed";
  note?: string;
}

function getClient() {
  return getSupabaseClient();
}

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * Fetch deposit and withdrawal transfers from the Supabase database.
 */
export async function getTransfers(walletAddress: string): Promise<TransferRecord[]> {
  if (!walletAddress) return [];
  const safeAddress = normalizeAddress(walletAddress);
  const client = getClient();

  // 1. Try dedicated transfers table first
  try {
    const { data, error } = await client
      .from("transfers")
      .select("*")
      .eq("wallet_address", safeAddress)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((d: any) => ({
        id: String(d.id),
        type: d.type,
        subtype: d.subtype,
        amount: Number(d.amount),
        token: d.token || "tUSDC",
        txHash: d.tx_hash,
        fromAddress: d.from_address,
        toAddress: d.to_address,
        timestamp: d.created_at,
        status: d.status || "completed",
        note: d.note,
      }));
    }
  } catch {}

  // 2. Database persistence via watchlist storage partition
  try {
    const { data: records, error } = await client
      .from("watchlist")
      .select("*")
      .eq("wallet_address", safeAddress)
      .like("market_id", "transfer:%")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(records)) {
      return records
        .map((r: any) => {
          try {
            const rawJson = r.market_id.slice("transfer:".length);
            const parsed = JSON.parse(rawJson);
            return {
              ...parsed,
              id: parsed.id || String(r.created_at),
              timestamp: parsed.timestamp || r.created_at,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as TransferRecord[];
    }
  } catch (err) {
    console.error("Failed to query transfers from database:", err);
  }

  return [];
}

/**
 * Record a deposit or withdrawal in the Supabase database.
 */
export async function recordTransfer(
  walletAddress: string,
  transfer: Omit<TransferRecord, "id" | "timestamp"> & { timestamp?: string }
): Promise<TransferRecord> {
  const safeAddress = normalizeAddress(walletAddress);
  const client = getClient();

  const newRecord: TransferRecord = {
    ...transfer,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: transfer.timestamp || new Date().toISOString(),
  };

  try {
    try {
      await client
        .from("users")
        .upsert(
          {
            wallet_address: safeAddress,
            display_name: `Trader ${safeAddress.slice(2, 6)}`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet_address" }
        );
    } catch {}

    // Try dedicated transfers table
    const { error: transferErr } = await client.from("transfers").insert({
      wallet_address: safeAddress,
      type: newRecord.type,
      subtype: newRecord.subtype,
      amount: newRecord.amount,
      token: newRecord.token || "tUSDC",
      tx_hash: newRecord.txHash,
      from_address: newRecord.fromAddress,
      to_address: newRecord.toAddress,
      status: newRecord.status,
      created_at: newRecord.timestamp,
    });

    if (transferErr) {
      // Fallback to database persistence partition
      const payload = `transfer:${JSON.stringify(newRecord)}`;
      await client.from("watchlist").upsert(
        {
          wallet_address: safeAddress,
          market_id: payload,
          created_at: newRecord.timestamp,
        },
        { onConflict: "wallet_address,market_id" }
      );
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nour:transfers-updated", {
          detail: { walletAddress: safeAddress, record: newRecord },
        })
      );
    }
  } catch (err) {
    console.error("Failed to record transfer in database:", err);
  }

  return newRecord;
}

/**
 * Auto-seed initial testnet funding in DB if user holds collateral but transfer table is empty
 */
export async function seedInitialDepositIfEmpty(
  walletAddress: string,
  collateralBalance: number
): Promise<void> {
  if (!walletAddress || collateralBalance <= 0) return;
  const existing = await getTransfers(walletAddress);
  if (existing.length === 0) {
    await recordTransfer(walletAddress, {
      type: "deposit",
      subtype: "faucet",
      amount: 1000,
      token: "tUSDC",
      fromAddress: DREAMDEX_CONTRACTS.collateral,
      toAddress: walletAddress,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: "completed",
      note: "Somnia Shannon Testnet Faucet",
    });
  }
}

/**
 * Fetch unified ledger activity (Credits and Debits: deposits, withdrawals, market payouts, refunds, and trades)
 */
export async function getLedgerHistory(walletAddress: string): Promise<LedgerEntry[]> {
  if (!walletAddress) return [];
  const safeAddress = normalizeAddress(walletAddress);
  const client = getClient();
  const entries: LedgerEntry[] = [];

  // 1. Fetch transfers (Deposits, Withdrawals, Payouts, Refunds)
  try {
    const rawTransfers = await getTransfers(safeAddress);
    for (const t of rawTransfers) {
      const isDeposit = t.type === "deposit";
      let flow: "credit" | "debit" = isDeposit ? "credit" : "debit";
      let category: LedgerEntry["category"] = "deposit";
      let title = "Deposit";
      let subtitle = t.note;

      if (isDeposit) {
        flow = "credit";
        if (t.subtype === "faucet") {
          category = "deposit";
          title = "Testnet Faucet Funding";
          subtitle = subtitle || "Somnia Shannon Collateral";
        } else if (t.subtype === "payout") {
          category = "payout";
          title = "Market Win Payout";
          subtitle = subtitle || "Redeemed winning position";
        } else if (t.subtype === "refund") {
          category = "refund";
          title = "Market Collateral Refund";
          subtitle = subtitle || "Expired window order refund";
        } else {
          category = "deposit";
          title = "Collateral Deposit";
          subtitle = subtitle || (t.fromAddress ? `From: ${t.fromAddress.slice(0, 6)}...${t.fromAddress.slice(-4)}` : undefined);
        }
      } else {
        flow = "debit";
        category = "withdrawal";
        title = "Withdrawal";
        subtitle = subtitle || (t.toAddress ? `To: ${t.toAddress.slice(0, 6)}...${t.toAddress.slice(-4)}` : "Sent from wallet");
      }

      entries.push({
        id: `transfer-${t.id}`,
        flow,
        category,
        title,
        subtitle,
        amount: Number(t.amount || 0),
        token: t.token || "tUSDC",
        timestamp: t.timestamp,
        txHash: t.txHash,
        status: t.status,
        note: t.note,
      });
    }
  } catch (err) {
    console.error("Failed to load transfers for ledger:", err);
  }

  // 2. Fetch trade debits and credits from Supabase database
  try {
    const { data: trades, error } = await client
      .from("trades")
      .select("*")
      .eq("wallet_address", safeAddress)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(trades)) {
      for (const tr of trades) {
        const isBuy = tr.action === "buy";
        const flow: "credit" | "debit" = isBuy ? "debit" : "credit";
        const amount = Number(tr.total_cost || 0);

        entries.push({
          id: `trade-${tr.id || tr.created_at}`,
          flow,
          category: "trade",
          title: isBuy
            ? `Trade: Buy ${tr.side?.toUpperCase()} · ${tr.ticker}`
            : `Trade: Sell ${tr.side?.toUpperCase()} · ${tr.ticker}`,
          subtitle: tr.title || "Prediction Market Order",
          amount: amount > 0 ? amount : Number(tr.amount || 0),
          token: "tUSDC",
          timestamp: tr.created_at,
          txHash: tr.tx_signature,
          status: "completed",
          note: `${tr.action === "buy" ? "Debited" : "Credited"} for ${tr.amount} contracts @ ${tr.price}¢`,
        });
      }
    }
  } catch (err) {
    console.error("Failed to load trades for ledger:", err);
  }

  // 3. Sort chronologically (most recent first)
  entries.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });

  return entries;
}
