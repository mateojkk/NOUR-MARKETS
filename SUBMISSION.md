# Somnia × DreamDEX Hackathon Submission: Nour

> **Project Name**: Nour  
> **Tagline**: The Next-Generation Prediction Market on Somnia & DreamDEX  
> **Target Network**: Somnia Shannon Testnet (Chain ID: `50312`)  
> **Repository**: [github.com/mateojkk/nour](https://github.com/mateojkk/nour)  
> **Live Demo**: Deployable with zero configuration on Vercel  

---

## 1. Executive Summary & Problem

Prediction markets are truth machines, but existing decentralized prediction venues suffer from severe friction:
1. **Slow execution and high latency**: Traditional L1s and L2s take multiple seconds (or minutes) to confirm orders, rendering high-frequency binary event contracts (like 5-minute or 15-minute price windows) frustrating to trade.
2. **Clunky Onboarding**: Users are forced to install specific browser wallet extensions, bridge assets across networks, and manage multiple gas tokens before placing their first trade.
3. **Fragmented Liquidity & Complex Settlement**: Users often struggle to understand complete set minting, order books, tick sizing, and how to claim their payouts once markets resolve.

### The Nour Solution
**Nour** is an institutional-grade, consumer-first prediction market trading platform built natively on **Somnia Layer 1** and powered by **DreamDEX Event Contracts**:
- **Sub-Second Responsiveness**: Leverages Somnia's ultra-fast EVM block times for instantaneous order matching and cancellation.
- **Frictionless Onboarding**: 1-click social authentication via Magic Link (Email or Google) plus support for standard Web3 wallets (MetaMask, Rabby, Injected).
- **Native Testnet Faucet**: Integrated 1-click claim button delivering 1,000 `tUSDC` testnet collateral directly in the app.
- **Complete Contract Lifecycle**: Direct support for Binary Pool orders (Buy Up / Buy Down, IOC taker, Post-Only maker), complete set minting/burning, and 1-click settlement redemption.
- **Vercel Serverless Monorepo**: Zero-maintenance, globally distributed serverless architecture that deploys instantly and scales indefinitely.

---

## 2. System Architecture

```
                                  +---------------------------+
                                  |     Nour Web App (Vite)   |
                                  | React 19 + Wagmi + Viem   |
                                  +-------------+-------------+
                                                |
                   +----------------------------+----------------------------+
                   |                                                         |
        [Vercel Serverless API]                                     [Direct Web3 / RPC]
  +--------------------------------+                       +----------------------------------+
  |  /api/markets                  |                       |  Somnia Shannon Testnet (50312)  |
  |  /api/timeseries               |                       |  RPC: dream-rpc.somnia.network   |
  |  /api/orderbook                |                       +-----------------+----------------+
  |  /api/faucet                   |                                         |
  +--------------------------------+                                         |
                                                                             v
                                                        +--------------------+--------------------+
                                                        |      DreamDEX Event Contracts Core      |
                                                        |-----------------------------------------|
                                                        | BinaryMarketsModule (0x3ecC...e388)     |
                                                        | MarketsCore         (0x2802...0294)     |
                                                        | BinarySettlement    (0xbF4a...Ed23)     |
                                                        | OutcomeToken6909    (0xB52c...55b9)     |
                                                        | OracleHub           (0xe40d...E32b)     |
                                                        | Collateral (tUSDC)  (0x70a8...5d8E)     |
                                                        +-----------------------------------------+
```

---

## 3. Key Technical Implementations

1. **Somnia Shannon Testnet Configuration**:
   - Chain ID: `50312`
   - RPC: `https://dream-rpc.somnia.network`
   - Native Currency: `STT`
   - Collateral: `tUSDC` (`0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E`) with 6 decimals.
2. **Tick & Lot Snapping**:
   - Quantizes probability prices to Somnia's 6-decimal testnet tick grid (`1,000` units = `0.001` probability), preventing `InvalidPrice` pool reverts.
3. **Strict Order Expiries**:
   - Calculates nanosecond timestamps (`expireTimestampNs`) ensuring limit and IOC orders never hang on dead windows.
4. **ERC-6909 Outcome Management**:
   - Handles multi-token Up (YES) and Down (NO) position balances on DreamDEX's shared ERC-6909 registry.
5. **1-Click Settlement**:
   - Validates finalized markets on-chain and triggers `BinarySettlement.redeem()` to swap winning outcome tokens 1:1 back into `tUSDC` collateral.

---

## 4. Judging Criteria Alignment

### Innovation & Originality (20%)
- Brings high-frequency binary prediction contracts into an ultra-clean, minimalist consumer interface.
- Solves the Web3 UX barrier by combining Magic Link frictionless login on Somnia with direct on-chain CLOB execution.

### Technical Implementation (25%)
- 100% compliant with DreamDEX Event Contracts specifications and CREATE3 contract addresses.
- Built as a modern Vercel Serverless Monorepo with TypeScript, Viem, Wagmi, and Ethers v6.
- Full cycle tested: Faucet → Order Placement → Balances → Settlement Redemption.

### User Experience & Design (20%)
- Premium dark-mode aesthetic with real-time multi-line charts, intuitive Buy Up / Buy Down controls, and live countdown timers to market expiry.
- Instant responsive feedback on desktop and mobile.

### Business & Ecosystem Impact (20%)
- Directly drives trading volume, active wallets, and transaction counts onto the Somnia blockchain.
- Demonstrates what high-throughput prediction markets look like when powered by Somnia's sub-second finality.

### Presentation & Demo (15%)
- Complete demo video script, storyboard, and testnet deployment instructions below.

---

## 5. 2–3 Minute Demo Video Script & Storyboard

### [0:00 - 0:30] Introduction & Problem
- **Visual**: Open on Nour's homepage displaying live Bitcoin & Ethereum price windows with live countdown timers.
- **Narrator**: "Welcome to Nour — the next-generation prediction market interface built specifically for Somnia and DreamDEX Event Contracts. Traditional prediction platforms are slow, complex, and clunky. Nour brings sub-second execution, crystal-clear probability pricing, and effortless onboarding to Somnia."

### [0:30 - 1:00] Frictionless Onboarding & Faucet
- **Visual**: Show 1-click login with Magic Link (Google/Email) or connecting MetaMask on Somnia Shannon Testnet. Click "Deposit / Faucet" and claim 1,000 free testnet `tUSDC`.
- **Narrator**: "Getting started takes five seconds. Users log in with Google or their Web3 wallet. If they need collateral, our integrated faucet claims 1,000 tUSDC directly on Somnia Shannon testnet with one click."

### [1:00 - 1:50] Real-Time Trading Experience
- **Visual**: Select a 15-minute Bitcoin window. View the live probability chart and outcome table. Enter 50 contracts, select "Buy Up (Yes)", review payout, and submit the order.
- **Narrator**: "Here is our flagship Bitcoin 15-minute window. We see the real-time probability curve and order depth. We select 'Up', enter 50 contracts, and submit. The transaction confirms in under a second on Somnia, recording our position in the DreamDEX binary pool with exact tick snapping and nanosecond expiry."

### [1:50 - 2:30] Portfolio & Settlement Redemption
- **Visual**: Navigate to the Portfolio tab. Show the active position, unrealized PnL, and the "Claim Payout" button for settled markets.
- **Narrator**: "In the portfolio, users track open positions and total value. Once a market window expires and resolves, Nour scans the settlement registry and enables one-click 1:1 redemption of winning tokens directly back to tUSDC."

### [2:30 - 3:00] Conclusion & Vision
- **Visual**: Show Vercel serverless deployment and GitHub repository.
- **Narrator**: "Built as a serverless monorepo ready for global scale, Nour proves that prediction markets can be as fast, clean, and accessible as modern trading apps. Check out our live testnet demo and GitHub repository. Thank you!"

---

## 6. Local Setup & Verification

```bash
# Clone the repository
git clone https://github.com/mateojkk/nour.git
cd nour

# Install dependencies
npm install

# Build for production
npm run build

# Run local development server
npm run dev
```

Built with ❤️ for Somnia & DreamDEX.
