import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  return res.status(200).json({
    chain: "Somnia Shannon Testnet",
    chainId: 50312,
    collateralToken: "tUSDC",
    collateralAddress: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    decimals: 6,
    maxFaucetClaim: 10000,
    instructions: "Call faucet(uint256 amount) on the tUSDC contract directly on Somnia Shannon Testnet to receive testnet collateral.",
    gasFaucet: "https://cloud.google.com/application/web3/faucet/somnia/shannon",
    communityFaucet: "https://t.me/+XHq0F0JXMyhmMzM0",
  });
}
