<div align="center">
  <img src="usenour/src/assets/logo nour .png" height="72" alt="NOUR" />
  <h3>prediction markets on Somnia.</h3>
  <p>
    <a href="https://github.com/mateojkk/nour"><img src="https://img.shields.io/badge/chain-Somnia%20Shannon%20Testnet-afd9c6?style=flat-square" /></a>
    <a href="https://github.com/mateojkk/nour"><img src="https://img.shields.io/badge/protocol-DreamDEX%20Event%20Contracts-afd9c6?style=flat-square" /></a>
    <a href="https://github.com/mateojkk/nour"><img src="https://img.shields.io/badge/build-passing-22c55e?style=flat-square" /></a>
  </p>
</div>

---

**Nour** is a consumer-first, institutional-grade prediction market exchange built natively on **Somnia Layer 1** and powered by **DreamDEX Event Contracts**. Trade rolling 5-minute and 15-minute binary crypto windows — *Will ETH close UP?* — with sub-second on-chain execution, passwordless login, and crystal-clear settlement.

Built for the **Somnia × DreamDEX Event Contracts Hackathon**.

---

## features

| | |
|---|---|
| ⚡ **Sub-second execution** | High-frequency binary trading on 5m, 15m rolling windows via Somnia's ultra-fast EVM finality |
| 📊 **Real on-chain markets only** | Every card is a live DreamDEX event contract from the indexer — zero synthetic data |
| 📖 **On-chain CLOB trading** | Direct Buy UP / Buy DOWN against the DreamDEX binary pool (taker IOC + maker post-only) |
| ✉️ **Passwordless email login** | Custom in-app 6-digit OTP via Magic SDK — no browser extension, no password |
| 🦊 **Web3 wallet support** | MetaMask, Rabby, any injected EIP-1193 wallet on Somnia Shannon Testnet |
| 🚰 **Integrated testnet faucet** | 1-click claim of 1,000 tUSDC collateral directly inside the app |
| 🏆 **Automated settlement** | 1-click on-chain `BinarySettlement.redeem()` — 1:1 winning token → tUSDC |
| 💹 **Real-time price charts** | Live OHLC candle history + live order book top-of-book polling every 3.5s |
| 🌙 **Minimalist dark UI** | Inter font · asphalt & mint palette · full mobile responsiveness |

---

## architecture

```
┌─────────────────────────────────────────────┐
│           Nour Web App (React 19 + Vite)    │
│         Wagmi · Viem · Magic SDK · Ethers   │
└──────────────────┬──────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
  Vercel Serverless        Direct Web3 RPC
  ─────────────────        ───────────────
  /api/markets             Somnia Shannon
  /api/timeseries          Testnet (50312)
  /api/orderbook                │
  /api/faucet                   │
                    ┌───────────┘
                    │
        DreamDEX Event Contracts
        ────────────────────────
        BinaryMarketsModule
        MarketsCore
        BinarySettlement
        OutcomeToken6909 (ERC-6909)
        OracleHub
        Collateral (tUSDC)
```

---

## deployed contracts — Somnia Shannon Testnet (`chainId: 50312`)

| Contract | Address |
|---|---|
| BinaryMarketsModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| MarketsCore | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| BinarySettlement | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| OutcomeToken6909 | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| OracleHub | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| Collateral (tUSDC) | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` |

---

## tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite (Rolldown), TypeScript |
| Styling | Pure CSS, Inter 300/500, CSS custom properties |
| Charts | Recharts (OHLC candles), custom SVG sparklines |
| Web3 | Viem, Wagmi, Ethers v6, Magic SDK |
| Auth | Magic `loginWithEmailOTP` (headless, custom OTP UI) |
| Backend | Vercel Serverless Functions (Node 20) |
| Database | Supabase (positions, trades, transfers, user profiles) |
| Blockchain | Somnia Shannon Testnet, DreamDEX `@somnia-chain/markets-sdk` |

---

## quickstart

```bash
git clone https://github.com/mateojkk/nour.git
cd nour
npm install

# dev
npm run dev --prefix usenour

# build
npm run build --prefix usenour
```

Deploys to Vercel with zero configuration.

---

## user flow

```
Sign in (email OTP or wallet)
        ↓
Claim tUSDC from faucet (1-click)
        ↓
Browse live 5m / 15m markets
        ↓
Select UP or DOWN · enter amount · place order
        ↓
Order executes on Somnia in < 1 second
        ↓
Track open P&L in Portfolio
        ↓
Window resolves → 1-click claim winning payout
```

---

## monorepo structure

```
nour/
├── api/                  # Vercel Serverless Functions
│   ├── markets.ts        # DreamDEX market feed
│   ├── timeseries.ts     # OHLC candle data
│   ├── orderbook.ts      # Order book snapshots
│   └── faucet.ts         # tUSDC faucet relay
├── usenour/              # React frontend
│   ├── src/
│   │   ├── components/   # TradePage, Portfolio, MarketCard, …
│   │   ├── contexts/     # EvmWalletContext, ProfileContext
│   │   ├── hooks/        # useMarketData, useMarketWebSocket
│   │   ├── services/     # dreamdex.ts, transferService.ts, userService.ts
│   │   └── styles/       # variables.css, base.css, cards.css
│   └── vite.config.ts
└── demo/                 # Remotion animated demo video
    └── src/NourDemo.tsx
```

---

> *prediction markets are truth machines. nour is the interface for that truth.*

**build. predict. trade.**
