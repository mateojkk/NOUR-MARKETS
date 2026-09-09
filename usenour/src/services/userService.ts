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

// =============================================================================
// Trades API
// =============================================================================

// Local fallback: in local dev there is no backend behind /api/user/*, so
// trades are mirrored into localStorage to keep the dashboard functional.
const LOCAL_TRADES_PREFIX = "nour-local-trades-";
const LOCAL_TRADES_CAP = 200;

function localTradesKey(walletAddress: string): string {
  return `${LOCAL_TRADES_PREFIX}${walletAddress.toLowerCase()}`;
}

function readLocalTrades(walletAddress: string): TradeRecordResponse[] {
  try {
    const raw = localStorage.getItem(localTradesKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalTrade(walletAddress: string, trade: TradeRecord): TradeRecordResponse {
  const record: TradeRecordResponse = {
    ...trade,
    id: Date.now(),
    created_at: new Date().toISOString(),
  };
  const list = readLocalTrades(walletAddress);
  list.unshift(record);
  try {
    localStorage.setItem(localTradesKey(walletAddress), JSON.stringify(list.slice(0, LOCAL_TRADES_CAP)));
  } catch {}
  return record;
}

// Derive open positions from the local trade history (buy adds contracts at
// cost, sell reduces the position and books realized P&L).
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
  try {
    const response = await authFetch(
      `${BACKEND_URL}/api/user/${walletAddress}/trades?limit=${limit}`
    );
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (error) {
    logger.warn("Backend trades unavailable, using local trade history", error);
  }
  return readLocalTrades(walletAddress);
}

export async function recordTrade(
  walletAddress: string,
  trade: TradeRecord
): Promise<TradeRecordResponse | null> {
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${walletAddress}/trades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(trade),
    });
    if (response.ok) return await response.json();
  } catch (error) {
    logger.warn("Backend trade recording unavailable, saving locally", error);
  }
  // Fallback: persist locally so the dashboard keeps working without a backend
  try {
    return saveLocalTrade(walletAddress, trade);
  } catch {
    return null;
  }
}

// =============================================================================
// Stats API
// =============================================================================

export async function getStats(walletAddress: string): Promise<UserStats | null> {
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${walletAddress}/stats`);
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
    logger.warn("Backend stats unavailable, deriving from local trades", error);
  }
  // Fallback: derive basic stats from the local trade history
  const trades = readLocalTrades(walletAddress);
  if (trades.length === 0) return null;
  return {
    total_trades: trades.length,
    total_volume: trades.reduce((sum, t) => sum + (t.total_cost || 0), 0),
    total_pnl: 0,
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
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${walletAddress}/positions`);
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
    logger.warn("Backend positions unavailable, deriving from local trades", error);
  }
  // Fallback: derive positions from the local trade history
  return derivePositionsFromTrades(readLocalTrades(walletAddress));
}

export default {
  getProfile,
  updateProfile,
  getTrades,
  recordTrade,
  getStats,
  getPositions,
};
