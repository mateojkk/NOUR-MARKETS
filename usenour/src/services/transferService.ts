/**
 * Transfer Service - Manages Deposit & Withdrawal history in Supabase Database.
 * All deposits and withdrawals persist directly to the database.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hlptdpjopyswucsvtere.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhscHRkcGpvcHlzd3Vjc3Z0ZXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTc5ODcsImV4cCI6MjEwNDYzMzk4N30.AaPbl_2_vViDio5ahWHUXf6zJD2lu_xwBVArg8qd0yE";

let _supabaseClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_supabaseClient) {
    _supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return _supabaseClient;
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
  transfer: Omit<TransferRecord, "id">
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
