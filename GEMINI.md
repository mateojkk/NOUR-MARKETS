# Project Guidelines & Architectural Rules for NOUR

## Critical Rule: NEVER USE LOCALSTORAGE FOR SERIOUS APPLICATION DATA

**STRICT PROHIBITION:**
Under NO circumstances should `localStorage`, `sessionStorage`, or client-side storage keys be used to store or manage critical business or financial data.

### Specifically Prohibited in localStorage:
1. **Financial Data**:
   - Balances, collateral, funding amounts, deposit history, withdrawal history, payout/redemption status.
2. **Trading Data**:
   - Trades, orders, positions, trade logs, portfolio P&L, contract ownership, performance statistics.
3. **Identity & User Data**:
   - User profiles, usernames, bios, verification status, credentials, user rankings.
4. **Market & Order State**:
   - Orderbook state, ledger logs, fills, settlements.

### Required Architecture:
- **Always persist to Supabase Database**:
  - Tables: `users`, `sessions`, `trades`, `positions`, `transfers`, `watchlist`.
  - Use the Supabase client (`getSupabaseClient()` from `src/services/supabaseClient.ts`) or serverless API routes in `/api/*`.
  - Ensure all database tables have appropriate RLS policies and indexes.
- **On-Chain Contracts**:
  - Always verify and track transactions on-chain (e.g. Somnia Shannon Testnet contracts for DreamDEX/tUSDC).
- **Client Cache Permitted ONLY For**:
  - Ephemeral, purely cosmetic UI preferences (e.g., light/dark theme toggle `nour-theme`).

