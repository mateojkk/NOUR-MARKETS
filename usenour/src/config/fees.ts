

export const FEE_CONFIG = {
  /** Platform fee rate (1.5% = 0.015) */
  PLATFORM_FEE_RATE: 0.015,
  
  MIN_FEE_USD: 0.01,
  FEE_COLLECTION_WALLET: import.meta.env.VITE_FEE_WALLET || null,
} as const;


export function calculatePlatformFee(costUsd: number): number {
  const fee = costUsd * FEE_CONFIG.PLATFORM_FEE_RATE;
  return Math.max(fee, FEE_CONFIG.MIN_FEE_USD);
}

/**
 * Get total cost including platform fee
 */
export function getTotalWithFee(costUsd: number): number {
  return costUsd + calculatePlatformFee(costUsd);
}

export default FEE_CONFIG;
