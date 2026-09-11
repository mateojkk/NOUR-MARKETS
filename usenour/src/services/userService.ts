/**
 * User Service - API client for user profiles, trades, and stats
 */

import { API_BASE_URL } from "../config/api";
import logger from "../utils/logger";
import { authFetch } from "./auth";

const BACKEND_URL = API_BASE_URL;

// =============================================================================
// Types
// =============================================================================

export interface UserProfile {
  wallet_address: string;
  display_name: string;
  avatar_url: string;
}

export interface TradeRecord {
  ticker: string;
  title: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  amount: number;
  price: number;
  total_cost: number;
  platform: "dreamdex";
  tx_signature?: string;
  pnl?: number;
  platform_fee?: number; // NOUR platform fee in USD
}

export interface TradeRecordResponse extends TradeRecord {
  id: number;
  created_at: string;
}

export interface RankInfo {
  rank: string;
  title: string;
  score: number;
  progress: number;
  next_rank_at?: number | null;
  next_title?: string | null;
}

export interface UserStats {
  total_trades: number;
  total_volume: number;
  total_pnl: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  rank: RankInfo;
}

// =============================================================================
// Profile API
// =============================================================================

export async function getProfile(walletAddress: string): Promise<UserProfile | null> {
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${walletAddress}/profile`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    logger.error("Failed to fetch profile", error);
    return null;
  }
}

export async function updateProfile(
  walletAddress: string,
  data: { display_name?: string; avatar_url?: string }
): Promise<UserProfile | null> {
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${walletAddress}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    logger.error("Failed to update profile", error);
    return null;
  }
}

import { getSupabaseClient } from "./supabaseClient";

// =============================================================================
// Trades API (Database-backed via Supabase)
// =============================================================================

function derivePositionsFromTrades(trades: TradeRecordResponse[]): PositionRecord[] {
  const acc = new Map<string, {
    ticker: string; title: string; side: "yes" | "no";
    contracts: number; cost: number; realized: number;
  }>();
  for (const t of trades) {
    const key = `${t.ticker}:${t.side}`;
    const entry = acc.get(key) ?? {
      ticker: t.ticker, title: t.title, side: t.side,
      contracts: 0, cost: 0, realized: 0,
    };
    if (t.action === "buy") {
      entry.contracts += t.amount;
      entry.cost += t.price * t.amount;
    } else {
      const avg = entry.contracts > 0 ? entry.cost / entry.contracts : t.price;
      const closed = Math.min(t.amount, entry.contracts);
      entry.realized += (t.price - avg) * closed;
      entry.contracts = Math.max(0, entry.contracts - t.amount);
      entry.cost = entry.contracts > 0 ? avg * entry.contracts : 0;
    }
    acc.set(key, entry);
  }
  return [...acc.values()]
    .filter((p) => p.contracts > 0.0001 || Math.abs(p.realized) > 0.0001)
    .map((p) => ({
      ticker: p.ticker,
      title: p.title,
      side: p.side,
      contracts: p.contracts,
      avg_price: p.contracts > 0 ? p.cost / p.contracts : 0,
      realized_pnl: p.realized,
    }));
}

export async function getTrades(
  walletAddress: string,
  limit = 100
): Promise<TradeRecordResponse[]> {
  const safeAddress = walletAddress.trim().toLowerCase();
  try {
    const response = await authFetch(
      `${BACKEND_URL}/api/user/${safeAddress}/trades?limit=${limit}`
    );
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (error) {
    logger.warn("Backend trades API unavailable, querying Supabase database directly", error);
  }

  // Database-direct fallback via Supabase (Never localStorage)
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("trades")
      .select("*")
      .eq("wallet_address", safeAddress)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && Array.isArray(data)) {
      return data.map((d: any) => ({
        id: Number(d.id),
        ticker: d.ticker,
        title: d.title,
        side: d.side,
        action: d.action,
        amount: Number(d.amount),
        price: Number(d.price),
        total_cost: Number(d.total_cost),
        platform: d.platform || "dreamdex",
        tx_signature: d.tx_signature,
        pnl: d.pnl !== null && d.pnl !== undefined ? Number(d.pnl) : undefined,
        platform_fee: Number(d.platform_fee || 0),
        created_at: d.created_at,
      }));
    }
  } catch (err) {
    logger.error("Failed to query trades from Supabase database", err);
  }
  return [];
}

export async function recordTrade(
  walletAddress: string,
  trade: TradeRecord
): Promise<TradeRecordResponse | null> {
  const safeAddress = walletAddress.trim().toLowerCase();
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${safeAddress}/trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade),
    });
    if (response.ok) return await response.json();
  } catch (error) {
    logger.warn("Backend trade recording API unavailable, saving to Supabase database directly", error);
  }

  // Database-direct write via Supabase (Never localStorage)
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("trades")
      .insert({
        wallet_address: safeAddress,
        ticker: trade.ticker,
        title: trade.title,
        side: trade.side,
        action: trade.action,
        amount: trade.amount,
        price: trade.price,
        total_cost: trade.total_cost,
        platform: trade.platform || "dreamdex",
        tx_signature: trade.tx_signature,
        platform_fee: trade.platform_fee || 0,
        pnl: trade.pnl,
      })
      .select()
      .single();

    if (!error && data) {
      return {
        id: Number(data.id),
        ticker: data.ticker,
        title: data.title,
        side: data.side,
        action: data.action,
        amount: Number(data.amount),
        price: Number(data.price),
        total_cost: Number(data.total_cost),
        platform: data.platform || "dreamdex",
        tx_signature: data.tx_signature,
        pnl: data.pnl !== null && data.pnl !== undefined ? Number(data.pnl) : undefined,
        platform_fee: Number(data.platform_fee || 0),
        created_at: data.created_at,
      };
    }
  } catch (err) {
    logger.error("Failed to persist trade to Supabase database", err);
  }
  return null;
}

// =============================================================================
// Stats API
// =============================================================================

export async function getStats(walletAddress: string): Promise<UserStats | null> {
  const safeAddress = walletAddress.trim().toLowerCase();
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${safeAddress}/stats`);
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data === "object") {
        return {
          total_trades: data.total_trades || 0,
          total_volume: data.total_volume || 0,
          total_pnl: data.total_pnl || 0,
          win_rate: data.win_rate || 0,
          win_count: data.win_count || 0,
          loss_count: data.loss_count || 0,
          rank: data.rank || { rank: "R", title: "Rookie", score: 0, progress: 0 }
        };
      }
    }
  } catch (error) {
    logger.warn("Backend stats API unavailable, deriving from database trades", error);
  }

  // Derive stats from database trades
  const trades = await getTrades(safeAddress);
  if (trades.length === 0) return null;
  return {
    total_trades: trades.length,
    total_volume: trades.reduce((sum, t) => sum + (t.total_cost || 0), 0),
    total_pnl: trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
    win_rate: 0,
    win_count: 0,
    loss_count: 0,
    rank: { rank: "R", title: "Rookie", score: 0, progress: 0 },
  };
}

// =============================================================================
// Positions API
// =============================================================================

export interface PositionRecord {
  ticker: string;
  title: string;
  side: "yes" | "no";
  contracts: number;  // Net contracts held
  avg_price: number;  // Weighted average purchase price in cents
  realized_pnl: number;  // Realized P&L from sells
}

export async function getPositions(walletAddress: string): Promise<PositionRecord[]> {
  const safeAddress = walletAddress.trim().toLowerCase();
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${safeAddress}/positions`);
    if (response.ok) {
      const data = await response.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.positions)
          ? data.positions
          : [];
      if (list.length > 0) return list;
    }
  } catch (error) {
    logger.warn("Backend positions API unavailable, querying Supabase positions", error);
  }

  // Database-direct fallback via Supabase (Never localStorage)
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("positions")
      .select("*")
      .eq("wallet_address", safeAddress);

    if (!error && Array.isArray(data) && data.length > 0) {
      return data
        .filter((p: any) => Number(p.contracts) > 0.0001 || Math.abs(Number(p.realized_pnl)) > 0.0001)
        .map((p: any) => ({
          ticker: p.ticker,
          title: p.title,
          side: p.side,
          contracts: Number(p.contracts),
          avg_price: Number(p.avg_price),
          realized_pnl: Number(p.realized_pnl),
        }));
    }
  } catch (err) {
    logger.error("Failed to query positions from Supabase database", err);
  }

  // Fallback: derive positions from database trade history
  const dbTrades = await getTrades(safeAddress);
  return derivePositionsFromTrades(dbTrades);
}

export default {
  getProfile,
  updateProfile,
  getTrades,
  recordTrade,
  getStats,
  getPositions,
};
