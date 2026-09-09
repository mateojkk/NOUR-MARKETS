import type { VercelRequest, VercelResponse } from "@vercel/node";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const ticker = (req.query.ticker as string) || "MARKET";
  const interval = (req.query.interval as string) || "1d";
  const currentPriceParam = req.query.currentPrice as string | undefined;
  const parsedCurrentPrice = currentPriceParam ? parseFloat(currentPriceParam) : NaN;

  const isNo = ticker.toLowerCase().endsWith("-no") || ticker.toLowerCase().includes("down");
  const baseTicker = ticker.replace(/-yes$|-no$/, "");

  let pointsCount = 60;
  let stepMs = 1440000;
  if (interval === "1h" || interval === "1m") {
    pointsCount = 45;
    stepMs = 60000;
  } else if (interval === "1d" || interval === "1D") {
    pointsCount = 60;
    stepMs = 1440000;
  } else if (interval === "1w" || interval === "1W") {
    pointsCount = 70;
    stepMs = 8640000;
  } else if (interval === "max" || interval === "1M" || interval === "ALL") {
    pointsCount = 90;
    stepMs = 28800000;
  }

  const seed = hashString(`${baseTicker}-${interval}`);

  let s = seed + 12345;
  const prng = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let targetYesPrice = !isNaN(parsedCurrentPrice) && parsedCurrentPrice > 0 && parsedCurrentPrice < 100
    ? (isNo ? 100 - parsedCurrentPrice : parsedCurrentPrice)
    : (28 + (seed % 45));

  const now = Date.now();
  const vol = 0.8 + prng() * 1.2;
  const momentum = 0.65 + prng() * 0.2;

  const driftType = prng();
  let startPrice = targetYesPrice;
  if (driftType < 0.35) {
    startPrice = Math.max(12, Math.min(88, targetYesPrice + (prng() - 0.5) * 14));
  } else if (driftType < 0.7) {
    startPrice = Math.max(10, Math.min(85, targetYesPrice - 8 - prng() * 25));
  } else {
    startPrice = Math.max(15, Math.min(90, targetYesPrice + 8 + prng() * 25));
  }

  const W: number[] = [0];
  let velocity = 0;
  for (let i = 1; i <= pointsCount; i++) {
    const u1 = Math.max(1e-7, prng());
    const u2 = prng();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    velocity = velocity * momentum + z * Math.sqrt(1 - momentum * momentum) * vol;
    W.push(W[i - 1] + velocity);
  }

  const finalW = W[pointsCount];
  const history = [];

  for (let i = 0; i <= pointsCount; i++) {
    const fraction = i / pointsCount;
    const trend = startPrice + fraction * (targetYesPrice - startPrice);
    const fluctuation = W[i] - fraction * finalW;
    let p = Math.round((trend + fluctuation) * 10) / 10;
    p = Math.max(4, Math.min(96, p));

    if (i === pointsCount) {
      p = targetYesPrice;
    }

    const t = now - (pointsCount - i) * stepMs;
    const finalP = isNo ? 100 - p : p;

    history.push({
      t: Math.floor(t / 1000),
      p: Number((finalP / 100).toFixed(4)),
    });
  }

  return res.status(200).json({
    ticker,
    history,
  });
}
