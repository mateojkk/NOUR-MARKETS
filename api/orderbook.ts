import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "s-maxage=2, stale-while-revalidate=5");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { symbol = "BTC-15M-UP" } = req.query;

  // Generate realistic CLOB depth around current probability (e.g. 0.52)
  const midProb = 0.52;
  const bids = [
    [midProb - 0.01, 1250],
    [midProb - 0.02, 3400],
    [midProb - 0.03, 5800],
    [midProb - 0.05, 12000],
    [midProb - 0.08, 25000],
  ];

  const asks = [
    [midProb + 0.01, 1100],
    [midProb + 0.02, 2900],
    [midProb + 0.03, 6200],
    [midProb + 0.05, 14500],
    [midProb + 0.08, 28000],
  ];

  return res.status(200).json({
    symbol,
    bids,
    asks,
    spread: 0.02,
    timestamp: Date.now(),
  });
}
