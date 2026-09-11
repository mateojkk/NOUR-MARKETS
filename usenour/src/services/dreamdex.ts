import { createPublicClient, http, parseAbi, parseUnits, formatUnits, type Address } from "viem";
import { decodeRevert } from "./revertDecoder";
import type { Market, MarketGroup } from "../types";

// --- Somnia Shannon Testnet Constants ---
export const SOMNIA_CHAIN_ID = 50312;
export const SOMNIA_RPC_URL = import.meta.env.VITE_SOMNIA_RPC_URL || "https://50312.rpc.thirdweb.com";
export const SOMNIA_EXPLORER_URL = "https://shannon-explorer.somnia.network";

// Core deployed contract addresses (CREATE3, identical testnet and mainnet)
export const DREAMDEX_CONTRACTS = {
  binaryMarketsModule: "0x3ecC694Cef705358864a646142ac17A90E29e388" as Address,
  marketsCore: "0x2802504314685D89bF6C992CA5a8e7cC78bc0294" as Address,
  binarySettlement: "0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23" as Address,
  outcomeToken6909: "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9" as Address,
  oracleHub: "0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b" as Address,
  collateralRouter: "0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C" as Address,
  // Collateral token on Shannon testnet: tUSDC (6 decimals)
  collateral: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E" as Address,
  collateralDecimals: 6,
};

// Common ABIs
export const TUSDC_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function faucet(uint256 amount) external",
]);

export const ERC6909_ABI = parseAbi([
  "function balanceOf(address owner, uint256 id) view returns (uint256)",
  "function isOperator(address owner, address spender) view returns (bool)",
  "function setOperator(address spender, bool approved) returns (bool)",
]);

export const BINARY_MODULE_ABI = parseAbi([
  "function getMarket(bytes32 marketId) view returns (address pool, address collateral, uint64 expiry, uint8 status, uint256 yesTokenId, uint256 noTokenId)",
  "function mintCompleteSets(address pool, uint256 amount) external",
  "function burnCompleteSets(address pool, uint256 amount) external",
]);

export const BINARY_POOL_ABI = parseAbi([
  "function placeBinaryOrder(uint8 side, uint256 price, uint256 quantity, uint64 expireNs, uint8 orderType) external returns (uint256 orderId)",
  "function cancelOrder(uint128 orderId) external",
  "function getBookLevels(bool isBid) view returns (uint256[] prices, uint256[] quantities)",
  "function marketExpiryNs() view returns (uint64)",
]);

export const BINARY_SETTLEMENT_ABI = parseAbi([
  "function finalizeAndRedeem(address pool, uint256 outcomeTokenId, uint256 amount, address recipient) external",
  "function redeem(uint256 outcomeTokenId, uint256 amount, address recipient) external",
  "function isMarketSettled(bytes32 marketId) view returns (bool isSettled, uint8 winningOutcome)",
]);

// Public client for Somnia Shannon Testnet
export const somniaClient = createPublicClient({
  transport: http(SOMNIA_RPC_URL),
});

// Helper: Snap price and quantity to Somnia testnet lot/tick grid
export const TESTNET_SCALE = 10n ** 6n; // 1e6
export const TESTNET_TICK = 1000n; // 0.001 probability in 1e6 units
export const TESTNET_LOT = 1000n; // 0.001 contracts

export function snapPrice(prob: number): bigint {
  // prob is 0..1 (e.g. 0.54)
  const clamped = Math.max(0.01, Math.min(0.99, prob));
  const raw = BigInt(Math.round(clamped * 1_000_000));
  return (raw / TESTNET_TICK) * TESTNET_TICK;
}

export function snapQuantity(amount: number): bigint {
  const raw = BigInt(Math.floor(amount * 1_000_000));
  return (raw / TESTNET_LOT) * TESTNET_LOT;
}

// Generate nanoseconds timestamp
export function getExpiryNanoseconds(secondsFromNow = 300): bigint {
  const futureSeconds = BigInt(Math.floor(Date.now() / 1000) + secondsFromNow);
  return futureSeconds * 1_000_000_000n;
}


// Group markets into series (e.g. Bitcoin Event Contracts & Ethereum Event Contracts)
export function groupEventContracts(markets: Market[]): MarketGroup[] {
  const groups: Record<string, MarketGroup> = {};

  markets.forEach((m) => {
    const assetName = m.asset === "BTC" ? "Bitcoin (BTC)" : "Ethereum (ETH)";
    const groupTitle = `${assetName} Price Windows`;

    if (!groups[groupTitle]) {
      groups[groupTitle] = {
        title: groupTitle,
        category: "Crypto",
        totalVolume: 0,
        markets: [],
        image: m.image,
      };
    }
    groups[groupTitle].markets.push(m);
    groups[groupTitle].totalVolume += m.volume;
  });

  return Object.values(groups).map((g) => {
    g.markets.sort((a, b) => (a.intervalSec || 0) - (b.intervalSec || 0));
    return g;
  });
}

// --- On-Chain Operations ---

// 1. Claim Testnet Collateral (tUSDC) via Faucet
export async function claimTestnetFaucet(walletProvider: any, amount = 1000): Promise<string> {
  if (!walletProvider) throw new Error("Wallet provider required to claim faucet");

  // Step 1: Ensure connected to Somnia Shannon Testnet (Chain ID 50312 / 0xc488)
  if (typeof walletProvider.request === "function") {
    const hexChainId = "0x" + Number(SOMNIA_CHAIN_ID).toString(16);
    try {
      await walletProvider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await walletProvider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChainId,
                chainName: "Somnia Shannon Testnet",
                nativeCurrency: {
                  name: "STT",
                  symbol: "STT",
                  decimals: 18,
                },
                rpcUrls: ["https://dream-rpc.somnia.network", "https://50312.rpc.thirdweb.com"],
                blockExplorerUrls: [SOMNIA_EXPLORER_URL],
              },
            ],
          });
        } catch {
          // Continue if user already has chain
        }
      }
    }
  }

  // Step 2: Use browser provider / signer
  const { ethers } = await import("ethers");
  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Step 3: Check native gas (STT) balance to provide clear guidance if 0 STT
  try {
    const gasBalance = await somniaClient.getBalance({ address: userAddress as Address });
    if (gasBalance === 0n) {
      throw new Error("You need Somnia Testnet STT for gas. Claim free STT at https://cloud.google.com/application/web3/faucet/somnia/shannon first, then mint your tUSDC!");
    }
  } catch (balanceErr: any) {
    if (balanceErr?.message?.includes("Somnia Testnet STT")) {
      throw balanceErr;
    }
  }

  // Step 4: Call faucet(uint256) on tUSDC contract (10,000 tUSDC max per claim)
  const claimUnits = parseUnits(Math.min(10000, amount).toString(), DREAMDEX_CONTRACTS.collateralDecimals);
  const contract = new ethers.Contract(
    DREAMDEX_CONTRACTS.collateral,
    ["function faucet(uint256 amount) external"],
    signer
  );

  try {
    const tx = await contract.faucet(claimUnits);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (err: any) {
    if (err?.code === "ACTION_REJECTED" || err?.message?.includes("user rejected") || err?.message?.includes("User rejected")) {
      throw new Error("Transaction rejected in wallet");
    }
    if (err?.message?.includes("insufficient funds") || err?.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Insufficient STT gas. Claim free STT at https://cloud.google.com/application/web3/faucet/somnia/shannon");
    }
    throw new Error(err?.reason || err?.message || "Faucet claim failed");
  }
}

// 2. Fetch User tUSDC Balance
export async function getCollateralBalance(address: string): Promise<number> {
  try {
    const balance = await somniaClient.readContract({
      address: DREAMDEX_CONTRACTS.collateral,
      abi: TUSDC_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    });
    return parseFloat(formatUnits(balance, DREAMDEX_CONTRACTS.collateralDecimals));
  } catch (err) {
    console.error("Failed to read collateral balance:", err);
    return 0;
  }
}

// 3. Place an Order on DreamDEX Event Contracts
export interface PlaceOrderParams {
  walletProvider: any;
  poolAddress: string;
  side: "yes" | "no"; // yes = Up, no = Down
  action?: "buy" | "sell"; // BUY = kind 0/2, SELL = kind 1/3
  priceProb: number; // 0..1 (e.g. 0.54)
  contractsAmount: number;
  orderType?: "ioc" | "post_only" | "limit";
}

export async function placeDreamDexOrder({
  walletProvider,
  poolAddress,
  side,
  action = "buy",
  priceProb,
  contractsAmount,
  orderType = "limit",
}: PlaceOrderParams): Promise<{ txHash: string; orderId: string }> {
  const { ethers } = await import("ethers");
  const safePoolAddress = ethers.getAddress(poolAddress.toLowerCase());

  // Prevent routing order to the module singleton if a pool address is missing
  if (safePoolAddress.toLowerCase() === DREAMDEX_CONTRACTS.binaryMarketsModule.toLowerCase()) {
    throw new Error("This market does not have an active binary trading pool on Somnia.");
  }

  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Pre-flight: ensure the market's pool contract actually exists on-chain.
  const poolCode = await somniaClient.getCode({ address: safePoolAddress as Address });
  if (!poolCode || poolCode === "0x") {
    throw new Error(
      "This market's trading pool is not live on-chain (demo listing). Please trade a market marked 🟢 LIVE."
    );
  }

  // 1. Calculate prices and costs
  // The Somnia BinaryPool contract ALWAYS expects the YES-side probability / limit price
  // regardless of whether buying or selling YES or NO (per Somnia SDK tradeAbi.js).
  const clampedProb = Math.max(0.01, Math.min(0.99, priceProb));
  const yesPriceProb = side === "yes" ? clampedProb : Math.max(0.01, Math.min(0.99, 1 - clampedProb));
  const outcomePrice = side === "yes" ? yesPriceProb : 1 - yesPriceProb;

  const rawPrice = snapPrice(yesPriceProb);
  const rawQuantity = snapQuantity(contractsAmount);

  // kind: 0 = BUY_YES, 1 = SELL_YES, 2 = BUY_NO, 3 = SELL_NO
  const baseSide = side === "yes" ? 0 : 2;
  const sideCode = action === "sell" ? baseSide + 1 : baseSide;

  // orderType: 0 = LIMIT (NormalOrder, fills matching liquidity & rests remainder), 2 = IOC, 3 = PostOnly
  const typeCode = orderType === "ioc" ? 2 : orderType === "post_only" ? 3 : 0;

  // Collateral contract
  const collateralContract = new ethers.Contract(
    DREAMDEX_CONTRACTS.collateral,
    [
      "function balanceOf(address owner) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
    ],
    signer
  );

  const costEst = contractsAmount * outcomePrice;
  const rawCost = parseUnits((costEst * 1.05).toFixed(6), DREAMDEX_CONTRACTS.collateralDecimals);

  // Outcome token singleton for SELL operations
  const outcomeContract = new ethers.Contract(
    DREAMDEX_CONTRACTS.outcomeToken6909,
    [
      "function balanceOf(address owner, uint256 id) view returns (uint256)",
      "function isOperator(address owner, address spender) view returns (bool)",
      "function setOperator(address spender, bool approved) returns (bool)",
    ],
    signer
  );

  // Pool contract with safe checksummed address
  const poolContract = new ethers.Contract(
    safePoolAddress,
    [
      "function placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k, uint64 userData) payable returns (bool success, uint128 id)",
      "function marketExpiryNs() view returns (uint64)",
      "function getBinaryPoolParams() view returns (tuple(address collateralToken, address market, address outcomeToken, uint256 yesId, uint256 noId, uint256 oneCollateral, uint256 setBacking, address feeRecipient, uint256 makerFeeBpsTimes1k, uint256 takerFeeBpsTimes1k, uint256 maxBuilderFeeBpsTimes1k, uint256 settlementFeeBpsTimes1k, address settlement, uint64 marketNonce, bool finalized))",
    ],
    signer
  );

  if (action === "buy") {
    // Pre-flight balance check: Ensure user has enough testnet collateral
    try {
      const balance: bigint = await collateralContract.balanceOf(userAddress);
      if (balance < rawCost) {
        const balFmt = parseFloat(formatUnits(balance, DREAMDEX_CONTRACTS.collateralDecimals)).toFixed(2);
        const needFmt = parseFloat(formatUnits(rawCost, DREAMDEX_CONTRACTS.collateralDecimals)).toFixed(2);
        throw new Error(
          `Insufficient tUSDC balance (have $${balFmt}, need $${needFmt}). Claim free testnet collateral from the faucet in the top right.`
        );
      }
    } catch (balErr: any) {
      if (balErr?.message?.includes("Insufficient tUSDC")) throw balErr;
    }

    // Ensure allowance to the pool
    const currentAllowance: bigint = await collateralContract.allowance(userAddress, safePoolAddress);
    if (currentAllowance < rawCost) {
      try {
        const maxApprove = ethers.MaxUint256;
        const approveTx = await collateralContract.approve(safePoolAddress, maxApprove);
        await approveTx.wait();
      } catch (err: any) {
        if (err?.code === "ACTION_REJECTED" || err?.message?.includes("user rejected") || err?.message?.includes("User rejected")) {
          throw new Error("Transaction rejected in wallet");
        }
        throw new Error("Collateral approval was not confirmed");
      }
    }
  } else {
    // action === "sell"
    // Authorize pool as operator on the ERC6909 singleton
    try {
      const granted: boolean = await outcomeContract.isOperator(userAddress, safePoolAddress);
      if (!granted) {
        const opTx = await outcomeContract.setOperator(safePoolAddress, true);
        await opTx.wait();
      }
    } catch (err: any) {
      if (err?.code === "ACTION_REJECTED" || err?.message?.includes("user rejected") || err?.message?.includes("User rejected")) {
        throw new Error("Transaction rejected in wallet");
      }
      throw new Error("Failed to authorize the pool to move your outcome tokens");
    }

    // Pre-flight check: Check user's outcome token balance
    try {
      const poolParams = await poolContract.getBinaryPoolParams();
      const tokenId = side === "yes" ? poolParams.yesId : poolParams.noId;
      const tokenBal: bigint = await outcomeContract.balanceOf(userAddress, tokenId);
      if (tokenBal < rawQuantity) {
        const balFmt = parseFloat(formatUnits(tokenBal, 6)).toFixed(2);
        throw new Error(
          `You only hold ${balFmt} on-chain ${side.toUpperCase()} contracts for this market. Cannot sell ${contractsAmount}.`
        );
      }
    } catch (chkErr: any) {
      if (chkErr?.message?.includes("Cannot sell")) throw chkErr;
    }
  }

  // Order expiry: 0 < expireNs <= pool.marketExpiryNs
  let expireNs: bigint;
  try {
    const poolExpiryNs: bigint = await poolContract.marketExpiryNs();
    const nowNs = BigInt(Date.now()) * 1_000_000n;
    if (poolExpiryNs <= nowNs) {
      throw new Error("This market window has already closed and is awaiting settlement.");
    }
    expireNs = poolExpiryNs;
  } catch (expErr: any) {
    if (expErr?.message?.includes("closed")) throw expErr;
    expireNs = getExpiryNanoseconds(900);
  }

  // Estimate gas with a generous safety margin for Somnia testnet
  let gasLimit = 800000n;
  try {
    const estGas: bigint = await poolContract.placeBinaryOrder.estimateGas(
      sideCode,
      rawPrice,
      rawQuantity,
      expireNs,
      typeCode,
      0,
      ethers.ZeroAddress,
      0,
      0
    );
    gasLimit = (estGas * 130n) / 100n;
  } catch (estErr: any) {
    // If estimation fails due to a custom contract revert, decode it immediately
    const decoded = decodeRevert(estErr);
    if (decoded?.errorName) {
      switch (decoded.errorName) {
        case "ImmediateOrCancelNoFill":
          throw new Error("No immediate matching order found on the order book at this price. Try a Limit order.");
        case "ERC20InsufficientAllowance":
          throw new Error("Collateral allowance is insufficient for this order.");
        case "ERC20InsufficientBalance":
        case "InsufficientBalance":
          throw new Error("Insufficient tUSDC balance on Somnia Shannon. Please claim faucet tokens to continue.");
        case "InsufficientPermission":
          throw new Error("Pool is not approved to transfer outcome tokens.");
        case "OrderExpiryBeyondMarket":
          throw new Error("Order expiry exceeds the market close time.");
        case "OrderAlreadyExpired":
          throw new Error("This market trading window has already closed.");
        default:
          throw new Error(`Somnia contract reverted: ${decoded.errorName}`);
      }
    }
    gasLimit = 1000000n;
  }

  try {
    const tx = await poolContract.placeBinaryOrder(
      sideCode,
      rawPrice,
      rawQuantity,
      expireNs,
      typeCode,
      0,
      ethers.ZeroAddress,
      0,
      0,
      { gasLimit }
    );
    const receipt = await tx.wait();
    let extractedOrderId = `order-${receipt.hash}`;
    const BINARY_ORDER_PLACED = "0x74d63d9f1c4826854a227aa41c4a51723497a608aa14aa50e8153744f081d4e6";
    const ORDER_RESTED = "0xd90f62f61ee2f606b132cfdfd883ddd079228b6fd6bffd9d7cf848daf824639d";
    const log = receipt.logs.find((l: any) => l.topics[0] === BINARY_ORDER_PLACED || l.topics[0] === ORDER_RESTED);
    if (log && log.topics[1]) {
      extractedOrderId = BigInt(log.topics[1]).toString();
    }
    return {
      txHash: receipt.hash,
      orderId: extractedOrderId,
    };
  } catch (err: any) {
    if (err?.code === "ACTION_REJECTED" || err?.message?.includes("user rejected") || err?.message?.includes("User rejected")) {
      throw new Error("Transaction rejected in wallet");
    }

    const decoded = decodeRevert(err);
    if (decoded?.errorName) {
      switch (decoded.errorName) {
        case "ImmediateOrCancelNoFill":
          throw new Error("No immediate matching order found on the order book at this price. Try a Limit order.");
        case "ERC20InsufficientAllowance":
          throw new Error("Collateral allowance is insufficient for this order.");
        case "ERC20InsufficientBalance":
        case "InsufficientBalance":
          throw new Error("Insufficient tUSDC balance on Somnia Shannon. Please claim faucet tokens to continue.");
        case "InsufficientPermission":
          throw new Error("Pool is not approved to transfer outcome tokens.");
        case "OrderExpiryBeyondMarket":
          throw new Error("Order expiry exceeds the market close time.");
        case "OrderAlreadyExpired":
          throw new Error("This market trading window has already closed.");
        default:
          throw new Error(`Somnia contract reverted: ${decoded.errorName}`);
      }
    }

    throw new Error(err?.reason || err?.shortMessage || err?.message || "Order failed on Somnia Shannon");
  }
}

// 4. Mint Complete Sets (1 tUSDC -> 1 Up + 1 Down)
export async function mintCompleteSets(walletProvider: any, poolAddress: string, amount: number): Promise<string> {
  const { ethers } = await import("ethers");
  const safePoolAddress = ethers.getAddress(poolAddress.toLowerCase());
  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();

  const moduleContract = new ethers.Contract(
    DREAMDEX_CONTRACTS.binaryMarketsModule,
    ["function mintCompleteSets(address pool, uint256 amount) external"],
    signer
  );

  const rawAmount = parseUnits(Number(amount).toFixed(DREAMDEX_CONTRACTS.collateralDecimals), DREAMDEX_CONTRACTS.collateralDecimals);
  const tx = await moduleContract.mintCompleteSets(safePoolAddress, rawAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// 5. Redeem Winning Position after Settlement (1:1 Payout via finalizeAndRedeem)
export async function redeemWinningPosition(
  walletProvider: any,
  param1: string, // poolAddress OR marketId
  param2: string, // outcomeTokenId OR poolAddress
  param3: any,    // amount OR outcomeIdx
  param4?: any,   // recipientAddress OR amount
  param5?: string // recipientAddress
): Promise<string> {
  const { ethers } = await import("ethers");
  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();

  let poolAddress: string;
  let outcomeTokenId: string = "";
  let amount: number;
  let recipient: string;

  // Check if called with new signature (poolAddress, outcomeTokenId, amount, recipient)
  // or legacy signature (marketId, poolAddress, outcomeIdx, amount, recipient)
  if (ethers.isAddress(param1)) {
    poolAddress = param1;
    outcomeTokenId = String(param2);
    amount = Number(param3);
    recipient = param4 ? ethers.getAddress(String(param4).toLowerCase()) : signerAddress;
  } else {
    poolAddress = param2;
    amount = Number(param4);
    recipient = param5 ? ethers.getAddress(String(param5).toLowerCase()) : signerAddress;
    const outcomeIdx = Number(param3) === 1 ? 1 : 0;

    // Fetch token IDs from Hasura if not provided directly
    try {
      const safePool = ethers.getAddress(poolAddress.toLowerCase());
      const q = `query { Market(where: { poolAddress: { _ilike: "${safePool}" } }, limit: 1) { yesTokenId noTokenId } }`;
      const res = await fetch("https://dev.smk.somnia.host/v1/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      const m = data?.data?.Market?.[0];
      if (m) {
        outcomeTokenId = outcomeIdx === 1 ? m.noTokenId : m.yesTokenId;
      }
    } catch (_) {}
  }

  const safePoolAddress = ethers.getAddress(poolAddress.toLowerCase());

  if (!outcomeTokenId) {
    throw new Error("Cannot redeem: on-chain outcome token ID could not be determined.");
  }

  // Check on-chain balance first to avoid cryptic require(false) reverts
  const erc6909 = new ethers.Contract(
    DREAMDEX_CONTRACTS.outcomeToken6909,
    ["function balanceOf(address owner, uint256 id) view returns (uint256)"],
    signer
  );

  const onchainBal: bigint = await erc6909.balanceOf(signerAddress, BigInt(outcomeTokenId));
  if (onchainBal === 0n) {
    throw new Error(
      "You hold 0 on-chain outcome contracts for this market. Your order may have expired unfilled and the collateral was already refunded to your wallet."
    );
  }

  let rawAmount = parseUnits(
    Number(amount).toFixed(DREAMDEX_CONTRACTS.collateralDecimals),
    DREAMDEX_CONTRACTS.collateralDecimals
  );
  if (rawAmount > onchainBal) {
    rawAmount = onchainBal;
  }

  const settlementContract = new ethers.Contract(
    DREAMDEX_CONTRACTS.binarySettlement,
    [
      "function finalizeAndRedeem(address pool, uint256 outcomeTokenId, uint256 amount, address recipient) external",
      "function redeem(uint256 outcomeTokenId, uint256 amount, address recipient) external",
    ],
    signer
  );

  const tx = await settlementContract.finalizeAndRedeem(
    safePoolAddress,
    BigInt(outcomeTokenId),
    rawAmount,
    recipient
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

// 6. Cancel Open / Resting Limit Order on CLOB (100% Collateral Refund)
export async function cancelDreamDexOrder(
  walletProvider: any,
  poolAddress: string,
  orderId: string | bigint
): Promise<string> {
  const { ethers } = await import("ethers");
  const safePoolAddress = ethers.getAddress(poolAddress.toLowerCase());
  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();

  const poolContract = new ethers.Contract(
    safePoolAddress,
    ["function cancelOrder(uint128 orderId) external"],
    signer
  );

  let gasLimit = 500000n;
  try {
    const est = await poolContract.cancelOrder.estimateGas(BigInt(orderId));
    gasLimit = (est * 130n) / 100n;
  } catch (estErr) {
    console.warn("cancelOrder gas estimation fallback to 500k:", estErr);
  }

  const tx = await poolContract.cancelOrder(BigInt(orderId), { gasLimit });
  const receipt = await tx.wait();
  return receipt.hash;
}

// 7. Extract real on-chain orderId from a placement transaction receipt
export async function getOrderIdFromTx(txHash: string): Promise<string | null> {
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(SOMNIA_RPC_URL);
  const BINARY_ORDER_PLACED = "0x74d63d9f1c4826854a227aa41c4a51723497a608aa14aa50e8153744f081d4e6";
  const ORDER_RESTED = "0xd90f62f61ee2f606b132cfdfd883ddd079228b6fd6bffd9d7cf848daf824639d";
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return null;
    const log = receipt.logs.find(
      (l) => l.topics[0] === BINARY_ORDER_PLACED || l.topics[0] === ORDER_RESTED
    );
    if (log && log.topics[1]) {
      return BigInt(log.topics[1]).toString();
    }
  } catch (err) {
    console.error("Failed to extract orderId from tx:", err);
  }
  return null;
}
