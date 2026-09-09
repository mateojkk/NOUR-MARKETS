import type { VercelRequest, VercelResponse } from "@vercel/node";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const marketId = (req.query.marketId as string) || "";
  if (!marketId) {
    return res.status(200).json({ history: [], source: "none" });
  }

  let history: Array<{ t: number; p: number }> = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const gql = `query ($mid: String!) {
      Candle(where: { market_id: {_eq: $mid}, intervalSeconds: {_eq: 60} }, limit: 720, order_by: { bucketStart: asc }) {
        bucketStart
        closePrice
      }
    }`;
    const resp = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gql, variables: { mid: marketId } }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const json: any = await resp.json().catch(() => null);
      const candles = json?.data?.Candle || [];
      history = candles.map((c: any) => {
        const close = Number(c.closePrice);
        // Binary markets quote on the 1e6 probability grid (591000 = 0.591);
        // other venues use 1e18 denominated prices
        const p = close > 5000000 ? close / 1e18 : close / 1e6;
        return {
          t: Number(c.bucketStart),
          p: Math.max(0.01, Math.min(0.99, p)),
        };
      });
    }
  } catch {
    // Indexer unavailable — return empty history; client seeds a live point
  }

  return res.status(200).json({
    marketId,
    history,
    source: history.length > 0 ? "candles" : "seed",
  });
}
