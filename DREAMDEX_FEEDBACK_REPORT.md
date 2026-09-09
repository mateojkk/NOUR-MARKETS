# Developer Feedback Report: DreamDEX Event Contracts & SDK

**Prepared by**: The Nour Team  
**Event**: Somnia × DreamDEX Event Contracts Hackathon  
**Target Surface**: `@somnia-chain/markets-sdk`, DreamDEX Core Contracts & Developer Documentation  

---

## 1. Executive Summary

Building Nour on top of DreamDEX Event Contracts and Somnia Shannon Testnet was a powerful experience. The architecture of a unified CLOB where Up and Down share a single book, combined with CREATE3 contract address parity across testnet and mainnet, is an exceptional design.

During development, we identified several ergonomic opportunities and subtle friction points. This report provides constructive, actionable feedback for the Somnia and DreamDEX core engineering teams.

---

## 2. Key Highlights & Commendations

1. **CREATE3 Deterministic Deployments**:
   - Having identical addresses across Testnet (`50312`) and Mainnet (`5031`) for `BinaryMarketsModule`, `MarketsCore`, and `BinarySettlement` significantly reduces deployment and configuration drift.
2. **One Book, Two Sides Primitive**:
   - The mathematical elegance of $P(\text{Down}) = 1 - P(\text{Up})$ and pairing opposite buyers without requiring pre-minted inventory is one of the best mechanisms in Web3 prediction markets.
3. **On-Demand Testnet Collateral Faucet**:
   - Implementing `faucet(uint256 amount)` directly on the testnet collateral contract (`tUSDC`) eliminates the need for external web faucets or Discord bot queues.

---

## 3. Areas for Improvement & Recommendations

### 3.1. Decimal Discrepancy & Conversion Pitfalls
* **Observation**: Testnet uses `tUSDC` with 6 decimals ($10^6$), while Mainnet uses `USDso` with 18 decimals ($10^{18}$). 
* **Impact**: Developers hardcoding price scales or contract lot sizes hit `InvalidPrice` or misprice orders by a factor of $10^{12}$ when moving between environments.
* **Recommendation**: 
  - Add built-in scaling utilities to `@somnia-chain/markets-sdk`: e.g. `exchange.scaleProbability(prob)` and `exchange.scaleContracts(amount)` that dynamically query the collateral token's decimals.

### 3.2. Tick & Lot Quantization Below SDK 0.28.0
* **Observation**: As highlighted in the docs, converting float probabilities with standard `.toFixed(18)` causes binary floating-point representations (e.g. `0.05` → `0.050000000000000003`) to fall off the pool's tick grid, triggering `InvalidPrice` reverts.
* **Impact**: Developers not using the latest SDK versions waste significant debugging time because testnet (6 decimals) hides this bug while mainnet (18 decimals) reverts.
* **Recommendation**:
  - Export standalone pure helper functions from the SDK (`snapToTick(price, tickSize)` and `snapToLot(amount, lotSize)`) so frontend and backend developers can quantize numbers safely without instantiating the full exchange object.

### 3.3. Indexer Sync Latency vs. On-Chain State
* **Observation**: The indexer can lag the chain by several seconds. Relying on indexer state for market status can lead to submitting orders to a window that just transitioned from `Trading` (1) to `Locked` (2).
* **Impact**: Orders revert or fail silently.
* **Recommendation**:
  - Provide a lightweight multicall batch reader in the client: `getMarketsOnchainBatch(marketIds[])` to check status, pool address, and expiry in a single RPC round-trip before executing batches.

### 3.4. Settled Market Visibility & History
* **Observation**: `loadMarkets()` purposefully skips finalized binary markets, requiring developers to query `listBinaryMarkets({ status: "Finalized" })` or `listPastBinaryMarkets()`.
* **Impact**: New builders often fail to implement the redemption step because settled markets vanish from the main markets list.
* **Recommendation**:
  - Emphasize the redemption lifecycle prominently in starter templates and add a dedicated `exchange.findRedeemableWinnings(account)` helper that automatically checks finalized windows and claims payouts in a single call.

---

## 4. Conclusion

DreamDEX Event Contracts provide a world-class foundation for on-chain prediction markets. By refining decimal helper utilities and streamlining settled market scanning, DreamDEX will offer the smoothest developer onboarding experience in Web3.

Thank you to the Somnia and DreamDEX teams for organizing this hackathon!
