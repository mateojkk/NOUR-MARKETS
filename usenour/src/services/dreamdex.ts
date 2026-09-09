import { createPublicClient, http, parseAbi, parseUnits, formatUnits, type Address } from "viem";
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
  "function cancelOrder(uint256 orderId) external",
  "function getBookLevels(bool isBid) view returns (uint256[] prices, uint256[] quantities)",
  "function marketExpiryNs() view returns (uint64)",
]);

export const BINARY_SETTLEMENT_ABI = parseAbi([
  "function redeem(bytes32 marketId, address pool, uint256 outcomeIdx, uint256 amount) external returns (uint256 payout)",
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
  priceProb: number; // 0..1 (e.g. 0.54)
  contractsAmount: number;
  orderType?: "ioc" | "post_only" | "limit";
}

export async function placeDreamDexOrder({
  walletProvider,
  poolAddress,
  side,
  priceProb,
  contractsAmount,
  orderType = "ioc",
}: PlaceOrderParams): Promise<{ txHash: string; orderId: string }> {
  const { ethers } = await import("ethers");
  const safePoolAddress = ethers.getAddress(poolAddress.toLowerCase());
  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  // Pre-flight: ensure the market's pool contract actually exists on-chain.
  // Demo/synthetic listings have fabricated pool addresses — sending an order
  // to them would revert and burn gas. Direct users to 🟢 LIVE markets.
  const poolCode = await somniaClient.getCode({ address: safePoolAddress as Address });
  if (!poolCode || poolCode === "0x") {
    throw new Error(
      "This market's trading pool is not live on-chain (demo listing). Please trade a market marked 🟢 LIVE."
    );
  }
  // 1. Approve Collateral to the POOL if needed.
  // Per the DreamDEX SDK, order escrow pulls collateral msg.sender -> pool,
  // so the approval must target the pool (approving the module does nothing here).
  const collateralContract = new ethers.Contract(
    DREAMDEX_CONTRACTS.collateral,
    [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
    ],
    signer
  );

  const costEst = contractsAmount * (priceProb);
  const rawCost = parseUnits((costEst * 1.05).toFixed(6), DREAMDEX_CONTRACTS.collateralDecimals);

  const currentAllowance = await collateralContract.allowance(userAddress, safePoolAddress);
  if (currentAllowance < rawCost) {
    const maxApprove = ethers.MaxUint256;
    const approveTx = await collateralContract.approve(safePoolAddress, maxApprove);
    await approveTx.wait();
  }

  // 2. Encode parameters
  // side: 0 = BUY_YES (Up), 2 = BUY_NO (Down)
  const sideCode = side === "yes" ? 0 : 2;
  const rawPrice = snapPrice(priceProb);
  const rawQuantity = snapQuantity(contractsAmount);
  
  // orderType: 2 = IOC (taker, must cross), 3 = PostOnly (maker), 0 = LIMIT
  const typeCode = orderType === "ioc" ? 2 : orderType === "post_only" ? 3 : 0;

  // Pool contract with safe checksummed address
  const poolContract = new ethers.Contract(
    safePoolAddress,
    [
      // Matches the DreamDEX binary pool ABI exactly (markets-sdk 0.29.0).
      // A shorter/older 5-arg encoding hits an unknown selector and reverts.
      "function placeBinaryOrder(uint8 kind, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k, uint64 userData) payable returns (bool success, uint128 id)",
      "function marketExpiryNs() view returns (uint64)",
    ],
    signer
  );

  // v2 order-expiry rule (per the SDK): every order must satisfy
  // 0 < expireNs <= pool.marketExpiryNs — a fixed "now + 5 min" reverts with
  // OrderExpiryBeyondMarket on windows with less time left. Default to the
  // pool's own market expiry, exactly like the SDK does.
  let expireNs: bigint;
  try {
    const poolExpiryNs: bigint = await poolContract.marketExpiryNs();
    expireNs = poolExpiryNs;
  } catch {
    expireNs = getExpiryNanoseconds(900); // 15 min safety cap fallback
  }

  try {
    const tx = await poolContract.placeBinaryOrder(sideCode, rawPrice, rawQuantity, expireNs, typeCode, 0, ethers.ZeroAddress, 0, 0);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      orderId: `order-${receipt.hash}`,
    };
  } catch (err: any) {
    // Surface the real on-chain reason — never fake success. The dashboard and
    // explorer must reflect only transactions that actually landed.
    if (err?.code === "ACTION_REJECTED" || err?.message?.includes("user rejected")) {
      throw new Error("Transaction rejected in wallet");
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

  const rawAmount = parseUnits(amount.toString(), DREAMDEX_CONTRACTS.collateralDecimals);
  const tx = await moduleContract.mintCompleteSets(safePoolAddress, rawAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// 5. Redeem Winning Position after Settlement (1:1 Payout)
export async function redeemWinningPosition(
  walletProvider: any,
  marketId: string,
  poolAddress: string,
  outcomeIdx: 0 | 1,
  amount: number
): Promise<string> {
  const { ethers } = await import("ethers");
  const safePoolAddress = ethers.getAddress(poolAddress.toLowerCase());
  const provider = new ethers.BrowserProvider(walletProvider);
  const signer = await provider.getSigner();

  const settlementContract = new ethers.Contract(
    DREAMDEX_CONTRACTS.binarySettlement,
    ["function redeem(bytes32 marketId, address pool, uint256 outcomeIdx, uint256 amount) external returns (uint256)"],
    signer
  );

  const rawAmount = parseUnits(amount.toString(), DREAMDEX_CONTRACTS.collateralDecimals);
  const tx = await settlementContract.redeem(marketId, safePoolAddress, outcomeIdx, rawAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}
