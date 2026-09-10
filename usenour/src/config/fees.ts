

export const FEE_CONFIG = {
  /** Platform fee rate (0% - zero fees) */
  PLATFORM_FEE_RATE: 0,
  MIN_FEE_USD: 0,
  FEE_COLLECTION_WALLET: null,
} as const;

export function calculatePlatformFee(costUsd = 0): number {
  void costUsd;
  return 0;
}

/**
 * Get total cost including platform fee
 */
export function getTotalWithFee(costUsd: number): number {
  return costUsd;
}

export default FEE_CONFIG;
