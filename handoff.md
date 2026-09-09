# Nour — Project Handoff Documentation

**Project**: Nour (Next-Gen Prediction Markets on Somnia & DreamDEX)  
**Date**: September 9, 2026  
**Status**: Build Passing (`npm run build` & `npm run lint` with 0 errors)  
**Chain**: Somnia Shannon Testnet (Chain ID: `50312`)  

---

## 1. Executive Summary

Nour is an orderbook and AMM-based prediction market frontend built on top of **Somnia Shannon Testnet** and **DreamDEX** contracts. It is structured as a monorepo with the main application living inside `usenour/`.

The application has been streamlined and strictly scoped:
- **Authentication**: Supports **only** two methods:
  1. **Passwordless Email** (via Magic SDK).
  2. **Browser / Web3 Wallet** (MetaMask, Rabby, or any injected EIP-1193 wallet on Somnia Shannon testnet).
- **All unrequested features removed**: Google OAuth, social logins, and mock/demo accounts were completely eliminated from the codebase.
- **Zero Build / Lint Errors**: Production build (`tsc -b && vite build`) and lint (`eslint .`) are fully green.

---

## 2. Authentication System & Recent Fixes

### A. The Two Active Login Methods
1. **Continue with Email (`LoginPage.tsx` & `EvmWalletContext.tsx`)**:
   - Calls `connect(email)` in `EvmWalletContext`.
   - Authenticates via Magic SDK (`pk_live_443734F1DC292B55`).
   - Obtains an EVM wallet address on Somnia Shannon testnet.
2. **Connect Browser Wallet**:
   - Calls `connectInjected()` in `EvmWalletContext`.
   - Connects directly to MetaMask / Rabby using Wagmi’s `injected({ shimDisconnect: true })`.

---

### B. Why "Magic: No Login Methods Configured 😥" Occurred & How It Was Fixed
- **Root Cause**: In `@magiclabs/wagmi-connector`, if `enableEmailLogin` is set to `false` and the Magic API key does not have third-party OAuth providers (e.g., Google) configured in the Magic Developer Dashboard, the connector checks:
  ```javascript
  ${!props.enableEmailLogin && providers?.length === 0 ? "<div>No Login Methods Configured 😥</div>" : ""}
  ```
  This threw the error box on the screen.
- **Resolution**:
  - In `usenour/src/main.tsx`, `dedicatedWalletConnector` is configured with `enableEmailLogin: true` and no unconfigured `oauthOptions`.
  - Removed all `OAuthExtension` references.

---

### C. Auto-Connecting Wallet Fix (MetaMask popping up unexpectedly)
- **Root Cause**: Wagmi was automatically triggering reconnect routines on page load.
- **Resolution**:
  - In `usenour/src/main.tsx`, `<WagmiProvider config={wagmiConfig} reconnectOnMount={false}>` was added.
  - In `usenour/src/contexts/EvmWalletContext.tsx`, wallet sessions are only restored if the user explicitly established a session previously (tracked via `localStorage.getItem("nour_connected_wallet")`).

---

### D. Custom UI vs. Magic Widget for Email Code (OTP)
#### Why did Magic’s widget appear?
When calling `magic.auth.loginWithMagicLink({ email })` without disabling the pre-built UI (`showUI: true` is the default in Magic SDK), Magic loads an internal iframe modal over the screen. Because modern Magic keys enforce numeric passcode (OTP) verification, Magic renders its own white popup asking for the 6-digit code.

#### How to replace the Magic widget with 100% Custom In-App UI:
Magic SDK provides headless authentication via `loginWithEmailOTP`:
```typescript
// 1. Trigger code delivery WITHOUT showing Magic UI
const handle = magic.auth.loginWithEmailOTP({ email, showUI: false });

// 2. When Magic sends the code, switch Nour UI to the OTP input screen
handle.on("email-otp-sent", () => {
  setStep("enter-code");
});

// 3. When the user inputs the 6-digit code in Nour custom input:
handle.emit("verify-email-otp", userEnteredCode);

// 4. Handle invalid code in custom UI:
handle.on("invalid-email-otp", () => {
  setError("Invalid code. Please re-enter.");
});

// 5. Awaiting the handle finishes the login and returns the DID token:
await handle;
```
*Note: If implementing this custom screen, use the existing styles in `login.css` (`.login-email-input`, `.login-submit-btn`, `.login-back-btn`).*

---

## 3. Network & Smart Contract Integration

### Somnia Shannon Testnet Configuration
- **Chain ID**: `50312`
- **RPC URL**: `https://50312.rpc.thirdweb.com` (Fallback: `https://dream-rpc.somnia.network`)
- **Block Explorer**: `https://shannon-explorer.somnia.network`
- **Currency**: `STT` (Somnia Testnet Token, 18 decimals)

### Core Deployed Addresses (`usenour/src/services/dreamdex.ts`)
| Contract | Address |
| :--- | :--- |
| **Collateral Token (tUSDC)** | `0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E` (6 decimals) |
| **Binary Markets Module** | `0x3ecC694Cef705358864a646142ac17A90E29e388` |
| **Markets Core** | `0x2802504314685D89bF6C992CA5a8e7cC78bc0294` |
| **Binary Settlement** | `0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23` |
| **Outcome Token (ERC6909)** | `0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9` |
| **Oracle Hub** | `0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b` |
| **Collateral Router** | `0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C` |

### Faucet & Collateral Balances
- `claimTestnetFaucet(provider, 1000)` calls `tUSDC.faucet(parseUnits("1000", 6))`.
- Claiming works directly through the connected provider (MetaMask or Magic RPC provider).
- Collateral balance is read via Viem `publicClient.readContract({ address: tUSDC, abi: TUSDC_ABI, functionName: "balanceOf", args: [address] })`.

---

## 4. Key Files & Structure

```
nour/
├── package.json               # Monorepo root
├── handoff.md                 # This file
├── DREAMDEX_FEEDBACK_REPORT.md# Protocol test feedback
├── SUBMISSION.md              # Hackathon / deployment submission doc
└── usenour/                   # React frontend
    ├── .env                   # Environment variables (Magic key & RPC)
    ├── package.json           # Dependencies (Vite, React 19, Wagmi, Magic)
    ├── vite.config.ts         # Vite build configuration
    └── src/
        ├── main.tsx           # Wagmi provider, Somnia chain config, Magic connector
        ├── App.tsx            # Main routes and routing guards
        ├── contexts/
        │   ├── EvmWalletContext.tsx # Central auth & wallet state (Magic + Injected)
        │   └── ProfileContext.tsx   # User profile & preferences
        ├── components/
        │   ├── LoginPage.tsx        # Login interface (Email Magic Link & Web3 Wallet)
        │   ├── TradePage.tsx        # Prediction market trading interface
        │   ├── PriceChart.tsx       # Market probability & price charts
        │   ├── Portfolio.tsx        # Open positions & history
        │   ├── AuthButton.tsx       # Header wallet button & dropdown
        │   └── WalletActions.tsx    # Faucet & collateral management modal
        ├── services/
        │   ├── dreamdex.ts          # Viem contract interactions (orders, settlement, faucet)
        │   ├── auth.ts              # Session token & address storage
        │   └── userService.ts       # Backend user profile & settings
        └── styles/
            ├── login.css            # Scoped login screen styling
            └── index.css            # Global CSS custom properties & layout
```

---

## 5. Development & Verification Commands

All commands can be run from the root or inside `usenour/`:

```bash
# Run local development server
npm run dev --prefix usenour

# Run ESLint (must pass with 0 errors)
npm run lint --prefix usenour

# Run TypeScript check & production build
npm run build --prefix usenour
```

---

## 6. Checklist for the Next 24 Hours / Launch

- [x] Clean, 2-method authentication interface (Magic Email + Browser Wallet).
- [x] No unrequested features or mock demo accounts.
- [x] Resolved "No Login Methods Configured" Magic issue.
- [x] Resolved unexpected MetaMask popup on initial page load.
- [x] 0 build errors, 0 lint errors.
- [x] Custom in-app 6-digit code entry implemented: headless `magic.auth.loginWithEmailOTP({ showUI: false })` in `EvmWalletContext.tsx` (`startEmailLogin` / `verifyEmailOtp` / `cancelEmailLogin`), custom OTP screen in `LoginPage.tsx` (6 boxes, paste support, auto-submit, resend, error states), styles in `login.css` (`.login-otp-*`, `.login-resend-btn`). No Magic popup widget.
- [x] Faucet flow hardened & verified: `claimTestnetFaucet` auto-switches/adds Somnia Shannon (50312), checks STT gas balance with faucet guidance, caps claim at 10,000 tUSDC, and maps wallet rejections / insufficient gas to friendly errors.
- [ ] Ensure testnet faucet has sufficient test STT for gas and tUSDC for liquidity on target testnet markets. *(ops task — needs a funded wallet; frontend flow is ready)*
