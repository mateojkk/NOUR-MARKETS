# nour

the future of prediction markets on Somnia.

### what is nour?
nour is a next-gen prediction market platform built for speed, clarity, and sub-second execution on **Somnia Layer 1**, powered by **DreamDEX Event Contracts**.

Built for the **Somnia × DreamDEX Event Contracts Hackathon**.

### features
- **Sub-second execution**: high-frequency binary prediction trading on live DreamDEX Event Contracts (5m, 15m, 1h rolling windows) powered by Somnia's ultra-fast finality.
- **Real on-chain markets only**: live markets are served straight from the DreamDEX indexer — no demo or synthetic listings.
- **On-chain CLOB trading**: direct interaction with DreamDEX Event Contracts (Buy Up / Buy Down, maker post-only & taker IOC).
- **Passwordless email login (6-digit code) + Web3 wallet support** (MetaMask, Rabby, Injected) — no social OAuth.
- **Integrated testnet faucet**: 1-click testnet `tUSDC` minting directly in the UI.
- **Automated settlement**: claim 1:1 payouts for winning positions after market expiry.
- **Real-time price charts**: live OHLC candle history from the DreamDEX indexer.
- **Minimalist, premium dark-mode interface**: institutional-grade charts, group series views, and real-time order flow.

### tech stack
- **Architecture**: Vercel Serverless Monorepo
- **Frontend**: React 19 + Vite (Rolldown) + TypeScript + Recharts + Lucide Icons
- **Web3 & Contracts**: Viem + Wagmi + Ethers v6 + Magic SDK (EVM)
- **Blockchain**: Somnia Shannon Testnet (`chainId: 50312`)
- **Protocol**: DreamDEX Event Contracts (`BinaryMarketsModule`, `BinarySettlement`, `OutcomeToken6909`)
- **Serverless API**: Vercel Serverless Functions (`/api/markets`, `/api/timeseries`, `/api/orderbook`, `/api/faucet`)

### deployed contracts (Somnia Shannon Testnet)
| Contract | Address |
| --- | --- |
| BinaryMarketsModule | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| MarketsCore | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| BinarySettlement | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| OutcomeToken6909 | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| OracleHub | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| Collateral (tUSDC) | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` |

### quickstart

```bash
# Clone repository
git clone https://github.com/mateojkk/nour.git
cd nour

# Install dependencies
npm install

# Run locally
npm run dev

# Build for Vercel
npm run build
```

### philosophical note
prediction markets are truth machines. nour is the interface for that truth.

---
build. predicted. trade.
