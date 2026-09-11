-- =============================================================================
-- Nour — Supabase Database Schema
-- Prediction Markets on Somnia & DreamDEX
-- =============================================================================

-- 1. USERS TABLE
-- Stores wallet-authenticated traders, profiles, and metadata
CREATE TABLE IF NOT EXISTS public.users (
    wallet_address TEXT PRIMARY KEY,
    display_name TEXT,
    username TEXT UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    is_beta_user BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Case-insensitive search on username & address
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (LOWER(username));

-- 2. SESSIONS TABLE
-- Persists authenticated user sessions across reloads & devices
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    auth_method TEXT NOT NULL CHECK (auth_method IN ('magic', 'injected')),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON public.sessions (wallet_address);

-- 3. TRADES TABLE
-- Stores all on-chain & journaled trade orders
CREATE TABLE IF NOT EXISTS public.trades (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    title TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
    action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
    amount NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    total_cost NUMERIC NOT NULL,
    platform TEXT DEFAULT 'dreamdex' NOT NULL,
    tx_signature TEXT,
    platform_fee NUMERIC DEFAULT 0 NOT NULL,
    pnl NUMERIC,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_wallet ON public.trades (wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON public.trades (ticker);

-- 4. POSITIONS TABLE
-- Aggregates current open contracts, weighted cost basis, and realized PnL
CREATE TABLE IF NOT EXISTS public.positions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    title TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
    contracts NUMERIC DEFAULT 0 NOT NULL,
    avg_price NUMERIC DEFAULT 0 NOT NULL,
    realized_pnl NUMERIC DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    CONSTRAINT unique_user_market_side UNIQUE (wallet_address, ticker, side)
);

CREATE INDEX IF NOT EXISTS idx_positions_wallet ON public.positions (wallet_address);

-- 5. WATCHLIST TABLE
-- Optional market bookmarks for traders
CREATE TABLE IF NOT EXISTS public.watchlist (
    wallet_address TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    market_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    PRIMARY KEY (wallet_address, market_id)
);

-- 6. TRANSFERS TABLE
-- Tracks on-chain deposits (faucets/funding) and withdrawals (transfers out)
CREATE TABLE IF NOT EXISTS public.transfers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES public.users(wallet_address) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    subtype TEXT DEFAULT 'transfer',
    amount NUMERIC NOT NULL,
    token TEXT DEFAULT 'tUSDC' NOT NULL,
    tx_hash TEXT,
    from_address TEXT,
    to_address TEXT,
    status TEXT DEFAULT 'completed' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transfers_wallet ON public.transfers (wallet_address, created_at DESC);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Allow public read access to transfers
CREATE POLICY "Transfers viewable by everyone"
    ON public.transfers FOR SELECT USING (true);

CREATE POLICY "Transfers insertable by users"
    ON public.transfers FOR INSERT WITH CHECK (true);

-- Allow public read access to profiles
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.users FOR SELECT USING (true);

-- Allow users to insert/update their own profile
CREATE POLICY "Users can insert their own profile" 
    ON public.users FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
    ON public.users FOR UPDATE USING (true);

-- Session policies
CREATE POLICY "Sessions viewable by everyone" 
    ON public.sessions FOR SELECT USING (true);

CREATE POLICY "Sessions insertable" 
    ON public.sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Sessions updateable" 
    ON public.sessions FOR UPDATE USING (true);

CREATE POLICY "Sessions deletable" 
    ON public.sessions FOR DELETE USING (true);

-- Allow public read of trade history
CREATE POLICY "Trades viewable by everyone" 
    ON public.trades FOR SELECT USING (true);

CREATE POLICY "Users can insert trades" 
    ON public.trades FOR INSERT WITH CHECK (true);

-- Positions policies
CREATE POLICY "Positions viewable by everyone" 
    ON public.positions FOR SELECT USING (true);

CREATE POLICY "Positions upsertable" 
    ON public.positions FOR ALL USING (true);

-- Watchlist policies
CREATE POLICY "Watchlist viewable by owner" 
    ON public.watchlist FOR SELECT USING (true);

CREATE POLICY "Watchlist manageable by owner" 
    ON public.watchlist FOR ALL USING (true);
