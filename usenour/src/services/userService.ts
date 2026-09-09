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

export async function getTrades(
  walletAddress: string,
  limit = 100
): Promise<TradeRecordResponse[]> {
  try {
    const response = await authFetch(
      `${BACKEND_URL}/api/user/${walletAddress}/trades?limit=${limit}`
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    logger.error("Failed to fetch trades", error);
    return [];
  }
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
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    logger.error("Failed to record trade", error);
    return null;
  }
}

// =============================================================================
// Stats API
// =============================================================================

export async function getStats(walletAddress: string): Promise<UserStats | null> {
  try {
    const response = await authFetch(`${BACKEND_URL}/api/user/${walletAddress}/stats`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object") return null;
    return {
      total_trades: data.total_trades || 0,
      total_volume: data.total_volume || 0,
      total_pnl: data.total_pnl || 0,
      win_rate: data.win_rate || 0,
      win_count: data.win_count || 0,
      loss_count: data.loss_count || 0,
      rank: data.rank || { rank: "R", title: "Rookie", score: 0, progress: 0 }
    };
  } catch (error) {
    logger.error("Failed to fetch stats", error);
    return null;
  }
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
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.positions)) return data.positions;
    return [];
  } catch (error) {
    logger.error("Failed to fetch positions", error);
    return [];
  }
}

export default {
  getProfile,
  updateProfile,
  getTrades,
  recordTrade,
  getStats,
  getPositions,
};
