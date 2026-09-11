/**
 * Supabase Client & Database Service for Nour
 * Prediction Markets on Somnia & DreamDEX
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Auto-load .env files if running in Node and variables are not already in process.env
function tryLoadEnv() {
  if (typeof process === "undefined" || !process.cwd) return;
  const files = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "usenour/.env"),
    path.resolve(process.cwd(), "../.env"),
  ];
  for (const f of files) {
    try {
      if (fs.existsSync(f)) {
        const lines = fs.readFileSync(f, "utf-8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const k = trimmed.slice(0, eq).trim();
            const v = trimmed.slice(eq + 1).trim().replace(/^["'](.*)["']$/, "$1");
            if (!process.env[k]) process.env[k] = v;
          }
        }
      }
    } catch {}
  }
}
tryLoadEnv();

// =============================================================================
// Environment & Client Initialization
// =============================================================================

export function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://hlptdpjopyswucsvtere.supabase.co"
  );
}

export function getSupabaseKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhscHRkcGpvcHlzd3Vjc3Z0ZXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTc5ODcsImV4cCI6MjEwNDYzMzk4N30.AaPbl_2_vViDio5ahWHUXf6zJD2lu_xwBVArg8qd0yE"
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  return Boolean(url && key && url.startsWith("https://"));
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!_supabase) {
    _supabase = createClient(getSupabaseUrl(), getSupabaseKey(), {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

// =============================================================================
// Interfaces
// =============================================================================

export interface UserRow {
  wallet_address: string;
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_beta_user: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TradeRow {
  id?: number;
  wallet_address: string;
  ticker: string;
  title: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  amount: number;
  price: number;
  total_cost: number;
  platform: "dreamdex";
  tx_signature?: string;
  platform_fee?: number;
  pnl?: number;
  created_at?: string;
}

export interface PositionRow {
  id?: number;
  wallet_address: string;
  ticker: string;
  title: string;
  side: "yes" | "no";
  contracts: number;
  avg_price: number;
  realized_pnl: number;
  updated_at?: string;
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

export interface SessionRow {
  id?: string;
  wallet_address: string;
  session_token: string;
  auth_method: "magic" | "injected";
  user_agent?: string;
  created_at?: string;
  last_active_at?: string;
  expires_at: string;
}

// =============================================================================
// In-Memory Fallback Store (Used when Supabase credentials are not set)
// =============================================================================

const memoryUsers = new Map<string, UserRow>();
const memoryTrades = new Map<string, TradeRow[]>();
const memoryPositions = new Map<string, PositionRow[]>();
const memorySessions = new Map<string, SessionRow>();

function normalizeAddress(address: string): string {
  return (address || "").trim().toLowerCase();
}

function computeRank(tradesCount: number, volume: number): RankInfo {
  const score = Math.round(tradesCount * 10 + volume * 0.05);
  if (score >= 500) {
    return { rank: "M", title: "Master", score, progress: 100, next_rank_at: null, next_title: null };
  }
  if (score >= 200) {
    return { rank: "E", title: "Expert", score, progress: Math.min(100, Math.round(((score - 200) / 300) * 100)), next_rank_at: 500, next_title: "Master" };
  }
  if (score >= 50) {
    return { rank: "P", title: "Pro", score, progress: Math.min(100, Math.round(((score - 50) / 150) * 100)), next_rank_at: 200, next_title: "Expert" };
  }
  return { rank: "R", title: "Rookie", score, progress: Math.min(100, Math.round((score / 50) * 100)), next_rank_at: 50, next_title: "Pro" };
}

// =============================================================================
// User Profiles
// =============================================================================

export async function getProfile(rawAddress: string): Promise<UserRow> {
  const address = normalizeAddress(rawAddress);
  const defaultProfile: UserRow = {
    wallet_address: address,
    display_name: `Trader ${address.slice(0, 6)}`,
    username: address.slice(0, 8),
    bio: "Somnia prediction market trader",
    avatar_url: "",
    is_beta_user: true,
  };

  const client = getSupabase();
  if (client) {
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("wallet_address", address)
      .maybeSingle();

    if (data && !error) {
      return data as UserRow;
    }

    // Auto-create default profile if it doesn't exist yet
    if (!data && !error) {
      const { data: created } = await client
        .from("users")
        .insert({
          ...defaultProfile,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (created) return created as UserRow;
    }
  }

  // Fallback to memory
  if (!memoryUsers.has(address)) {
    memoryUsers.set(address, defaultProfile);
  }
  return memoryUsers.get(address)!;
}

export async function updateProfile(
  rawAddress: string,
  updates: Partial<Omit<UserRow, "wallet_address" | "created_at">>
): Promise<UserRow> {
  const address = normalizeAddress(rawAddress);
  const client = getSupabase();

  const cleanUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }
  cleanUpdates.updated_at = new Date().toISOString();

  if (client) {
    // Ensure row exists first
    await getProfile(address);

    const { data, error } = await client
      .from("users")
      .update(cleanUpdates)
      .eq("wallet_address", address)
      .select()
      .maybeSingle();

    if (data && !error) {
      return data as UserRow;
    }
  }

  // Fallback to memory
  const existing = await getProfile(address);
  const updated: UserRow = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  memoryUsers.set(address, updated);
  return updated;
}

export async function getPublicProfileByUsername(username: string): Promise<{
  display_name: string;
  username: string | null;
  bio: string | null;
  avatar_url: string;
  rank: string;
  title: string;
  score: number;
  total_trades: number;
} | null> {
  const cleanUsername = (username || "").trim().toLowerCase();
  const client = getSupabase();

  let user: UserRow | null = null;
  if (client) {
    const { data } = await client
      .from("users")
      .select("*")
      .ilike("username", cleanUsername)
      .maybeSingle();
    if (data) user = data as UserRow;
  }

  if (!user) {
    for (const u of memoryUsers.values()) {
      if ((u.username || "").toLowerCase() === cleanUsername) {
        user = u;
        break;
      }
    }
  }

  if (!user) return null;

  const stats = await getStats(user.wallet_address);
  return {
    display_name: user.display_name,
    username: user.username,
    bio: user.bio,
    avatar_url: user.avatar_url || "",
    rank: stats.rank.rank,
    title: stats.rank.title,
    score: stats.rank.score,
    total_trades: stats.total_trades,
  };
}

// =============================================================================
// Trades & Positions
// =============================================================================

export async function getTrades(rawAddress: string, limit = 100): Promise<TradeRow[]> {
  const address = normalizeAddress(rawAddress);
  const client = getSupabase();

  if (client) {
    const { data, error } = await client
      .from("trades")
      .select("*")
      .eq("wallet_address", address)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data && !error) {
      return data as TradeRow[];
    }
  }

  return (memoryTrades.get(address) || []).slice(0, limit);
}

export async function recordTrade(rawAddress: string, trade: Omit<TradeRow, "wallet_address">): Promise<TradeRow> {
  const address = normalizeAddress(rawAddress);
  // Ensure user profile exists
  await getProfile(address);

  const client = getSupabase();
  const now = new Date().toISOString();

  const tradeRecord: TradeRow = {
    ...trade,
    wallet_address: address,
    created_at: now,
  };

  if (client) {
    const { data: inserted, error } = await client
      .from("trades")
      .insert(tradeRecord)
      .select()
      .maybeSingle();

    if (inserted && !error) {
      await updatePositionAfterTrade(address, tradeRecord);
      return inserted as TradeRow;
    }
  }

  // Memory fallback
  const list = memoryTrades.get(address) || [];
  const memoryRecord: TradeRow = {
    ...tradeRecord,
    id: Date.now(),
  };
  list.unshift(memoryRecord);
  memoryTrades.set(address, list);

  await updatePositionAfterTrade(address, memoryRecord);
  return memoryRecord;
}

export async function getPositions(rawAddress: string): Promise<PositionRow[]> {
  const address = normalizeAddress(rawAddress);
  const client = getSupabase();

  if (client) {
    const { data, error } = await client
      .from("positions")
      .select("*")
      .eq("wallet_address", address)
      .gt("contracts", 0);

    if (data && !error) {
      return data as PositionRow[];
    }
  }

  return (memoryPositions.get(address) || []).filter((p) => p.contracts > 0);
}

async function updatePositionAfterTrade(address: string, trade: TradeRow): Promise<void> {
  const client = getSupabase();
  const ticker = trade.ticker;
  const side = trade.side;
  const action = trade.action;
  const amount = Number(trade.amount);
  const price = Number(trade.price);

  let existing: PositionRow | null = null;

  if (client) {
    const { data } = await client
      .from("positions")
      .select("*")
      .eq("wallet_address", address)
      .eq("ticker", ticker)
      .eq("side", side)
      .maybeSingle();
    if (data) existing = data as PositionRow;
  } else {
    const list = memoryPositions.get(address) || [];
    existing = list.find((p) => p.ticker === ticker && p.side === side) || null;
  }

  let contracts = Number(existing?.contracts || 0);
  let avgPrice = Number(existing?.avg_price || 0);
  let realizedPnl = Number(existing?.realized_pnl || 0);

  if (action === "buy") {
    const totalCost = contracts * avgPrice + amount * price;
    contracts += amount;
    avgPrice = contracts > 0 ? Math.round((totalCost / contracts) * 10000) / 10000 : price;
  } else {
    // Sell closes contracts
    const closed = Math.min(amount, contracts);
    const avg = contracts > 0 ? avgPrice : price;
    realizedPnl = Math.round((realizedPnl + ((price - avg) * closed) / 100) * 10000) / 10000;
    contracts = Math.max(0, contracts - amount);
    if (contracts <= 0) {
      avgPrice = 0;
    }
  }

  const positionUpdate: PositionRow = {
    wallet_address: address,
    ticker,
    title: trade.title,
    side,
    contracts,
    avg_price: avgPrice,
    realized_pnl: realizedPnl,
    updated_at: new Date().toISOString(),
  };

  if (client) {
    await client
      .from("positions")
      .upsert(positionUpdate, { onConflict: "wallet_address,ticker,side" });
  } else {
    const list = memoryPositions.get(address) || [];
    const idx = list.findIndex((p) => p.ticker === ticker && p.side === side);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...positionUpdate };
    } else {
      list.push(positionUpdate);
    }
    memoryPositions.set(address, list);
  }
}

// =============================================================================
// User Stats
// =============================================================================

export async function getStats(rawAddress: string): Promise<UserStats> {
  const address = normalizeAddress(rawAddress);
  const trades = await getTrades(address, 1000);
  const positions = await getPositions(address);

  const totalTrades = trades.length;
  const totalVolume = trades.reduce((sum, t) => sum + Number(t.total_cost || 0), 0);
  const realizedPnl = positions.reduce((sum, p) => sum + Number(p.realized_pnl || 0), 0);
  const tradePnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const totalPnl = realizedPnl + tradePnl;

  let winCount = 0;
  let lossCount = 0;
  for (const t of trades) {
    if (t.pnl !== undefined && t.pnl !== null) {
      if (t.pnl > 0) winCount++;
      else if (t.pnl < 0) lossCount++;
    }
  }

  const winRate = winCount + lossCount > 0 ? Math.round((winCount / (winCount + lossCount)) * 100) : 0;
  const rank = computeRank(totalTrades, totalVolume);

  return {
    total_trades: totalTrades,
    total_volume: Math.round(totalVolume * 100) / 100,
    total_pnl: Math.round(totalPnl * 100) / 100,
    win_count: winCount,
    loss_count: lossCount,
    win_rate: winRate,
    rank,
  };
}

// =============================================================================
// User Sessions
// =============================================================================

export async function createSession(
  rawAddress: string,
  authMethod: "magic" | "injected",
  userAgent?: string
): Promise<SessionRow> {
  const address = normalizeAddress(rawAddress);
  await getProfile(address);

  const client = getSupabase();
  const now = new Date();
  const sessionToken = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const sessionData: SessionRow = {
    wallet_address: address,
    session_token: sessionToken,
    auth_method: authMethod,
    user_agent: userAgent || "",
    created_at: now.toISOString(),
    last_active_at: now.toISOString(),
    expires_at: expiresAt,
  };

  if (client) {
    const { data, error } = await client
      .from("sessions")
      .insert(sessionData)
      .select()
      .maybeSingle();

    if (data && !error) {
      return data as SessionRow;
    }
  }

  // Memory fallback
  memorySessions.set(sessionToken, sessionData);
  return sessionData;
}

export async function validateSession(sessionToken: string): Promise<{ valid: boolean; session?: SessionRow }> {
  if (!sessionToken) return { valid: false };

  const client = getSupabase();
  let session: SessionRow | null = null;

  if (client) {
    const { data } = await client
      .from("sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .maybeSingle();
    if (data) session = data as SessionRow;
  } else {
    session = memorySessions.get(sessionToken) || null;
  }

  if (!session) return { valid: false };

  const isExpired = new Date(session.expires_at).getTime() < Date.now();
  if (isExpired) {
    await deleteSession(sessionToken);
    return { valid: false };
  }

  // Update last active time
  const now = new Date().toISOString();
  session.last_active_at = now;

  if (client) {
    await client
      .from("sessions")
      .update({ last_active_at: now })
      .eq("session_token", sessionToken);
  } else {
    memorySessions.set(sessionToken, session);
  }

  return { valid: true, session };
}

export async function deleteSession(sessionToken: string): Promise<boolean> {
  if (!sessionToken) return true;

  const client = getSupabase();
  if (client) {
    await client.from("sessions").delete().eq("session_token", sessionToken);
  }
  memorySessions.delete(sessionToken);
  return true;
}

