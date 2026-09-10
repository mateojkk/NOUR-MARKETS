import { decodeErrorResult, isHex, type Hex } from "viem";

export const SOMNIA_ERRORS_ABI = [
  { type: "error", name: "ImmediateOrCancelNoFill", inputs: [] },
  {
    type: "error",
    name: "ERC20InsufficientAllowance",
    inputs: [
      { name: "spender", type: "address" },
      { name: "allowance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  {
    type: "error",
    name: "ERC20InsufficientBalance",
    inputs: [
      { name: "sender", type: "address" },
      { name: "balance", type: "uint256" },
      { name: "needed", type: "uint256" },
    ],
  },
  { type: "error", name: "InsufficientPermission", inputs: [] },
  { type: "error", name: "OrderExpiryBeyondMarket", inputs: [] },
  { type: "error", name: "OrderAlreadyExpired", inputs: [] },
  { type: "error", name: "UseBinaryPlacement", inputs: [] },
  { type: "error", name: "FillOrKillNotFillable", inputs: [] },
  { type: "error", name: "PostOnlyWouldCross", inputs: [] },
  { type: "error", name: "SelfMatchCancelTaker", inputs: [] },
  { type: "error", name: "PriceNotAlignedToTickSize", inputs: [] },
  { type: "error", name: "PriceOutOfBounds", inputs: [] },
  { type: "error", name: "InvalidPrice", inputs: [] },
  {
    type: "error",
    name: "InvalidPrice",
    inputs: [
      { name: "price", type: "uint256" },
      { name: "tickSize", type: "uint256" },
    ],
  },
  { type: "error", name: "ZeroOrder", inputs: [] },
  {
    type: "error",
    name: "ExpiredOrderMustBeCancelled",
    inputs: [{ name: "orderId", type: "uint128" }],
  },
  { type: "error", name: "InsufficientMarginForOrder", inputs: [] },
  { type: "error", name: "TooManyRestingOrders", inputs: [] },
  { type: "error", name: "CannotStoreZeroOrder", inputs: [] },
  { type: "error", name: "BooksNotEmpty", inputs: [] },
  { type: "error", name: "PoolBooksNotEmpty", inputs: [] },
  { type: "error", name: "CloseNotCaptured", inputs: [] },
  { type: "error", name: "CloseAlreadyCaptured", inputs: [] },
  { type: "error", name: "CaptureTooEarly", inputs: [] },
  { type: "error", name: "CaptureStepsExhausted", inputs: [] },
  { type: "error", name: "FailedCall", inputs: [] },
] as const;

export interface DecodedRevert {
  errorName?: string;
  args?: readonly unknown[];
  reason?: string;
  data?: Hex;
}

function findRevertData(value: unknown): Hex | undefined {
  const seen = new Set<unknown>();
  let node: any = value;
  for (let depth = 0; node != null && depth < 10; depth += 1) {
    if (seen.has(node)) break;
    seen.add(node);
    const rec = node as Record<string, unknown>;
    for (const key of ["data", "raw"] as const) {
      const candidate = rec[key];
      if (typeof candidate === "string" && isHex(candidate)) return candidate as Hex;
      if (candidate != null && typeof candidate === "object") {
        const inner = (candidate as any).data;
        if (typeof inner === "string" && isHex(inner)) return inner as Hex;
      }
    }
    node = rec.cause ?? rec.error;
  }
  return undefined;
}

function findRevertReason(value: unknown): string | undefined {
  const seen = new Set<unknown>();
  let node: any = value;
  for (let depth = 0; node != null && depth < 10; depth += 1) {
    if (seen.has(node)) break;
    seen.add(node);
    const rec = node as Record<string, unknown>;
    for (const key of ["reason", "shortMessage", "message"] as const) {
      const candidate = rec[key];
      if (typeof candidate === "string" && candidate.length > 0) {
        const cleaned = candidate.replace(/^(execution reverted:?|reverted:?)\s*/i, "").trim();
        if (cleaned && cleaned.toLowerCase() !== "execution reverted") {
          return cleaned;
        }
      }
    }
    node = rec.cause ?? rec.error;
  }
  return undefined;
}

export function decodeRevert(caught: unknown): DecodedRevert {
  const data = findRevertData(caught);
  if (data && data !== "0x") {
    try {
      const decoded = decodeErrorResult({
        abi: SOMNIA_ERRORS_ABI,
        data,
      });
      return {
        errorName: decoded.errorName,
        args: decoded.args as readonly unknown[] | undefined,
        data,
      };
    } catch {
      // Revert signature not in this list, return raw data
    }
  }

  const reason = findRevertReason(caught);
  return { reason, data };
}
