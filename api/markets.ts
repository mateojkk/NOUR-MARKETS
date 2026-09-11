import type { VercelRequest, VercelResponse } from "@vercel/node";

interface MarketItem {
  ticker: string;
  title: string;
  subtitle: string;
  yes_sub_title: string;
  price_yes: number;
  price_no: number;
  volume: number;
  category: string;
  platform: string;
  image: string;
  marketId: string;
  poolAddress: string;
  marketAddress?: string;
  yes_token_id: string;
  no_token_id: string;
  expiry: number;
  intervalSec: number;
  asset: string;
  onchainStatus: number;
  active: boolean;
  closed: boolean;
  eventCategory: string;
  eventTags: string[];
  description: string;
}

// In-memory cache for fast responses
let cachedMarkets: MarketItem[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

const ASSET_ICONS: Record<string, string> = {
  BTC: "/icons/btc.svg",
  ETH: "/icons/eth.svg",
  SOL: "/icons/sol.svg",
  SOMI: "/icons/somnia.svg",
  SOMNIA: "/icons/somnia.svg",
  DREAM: "/icons/dream.svg",
  DREAMDEX: "/icons/dream.svg",
  USDC: "/icons/usdc.svg",
  USD: "/icons/usdc.svg",
  OPENAI: "/icons/openai.svg",
  AI: "/icons/openai.svg",
  NVDA: "/icons/nvidia.svg",
  NVIDIA: "/icons/nvidia.svg",
  BNB: "/icons/bnb.svg",
  XRP: "/icons/xrp.svg",
  FED: "/icons/fed.svg",
  FOMC: "/icons/fed.svg",
  CPI: "/icons/fed.svg",
  GTA6: "/icons/gta6.svg",
  GTA: "/icons/gta6.svg",
  GAMING: "/icons/gaming.svg",
  GAME: "/icons/gaming.svg",
  TOTAL: "/icons/btc.svg",
};

const DEFAULT_MARKET_ICON = "/icons/nour.png";

function resolveMarketIcon(asset?: string, title?: string): string {
  const normAsset = (asset || "").trim().toUpperCase();
  if (normAsset && ASSET_ICONS[normAsset]) {
    return ASSET_ICONS[normAsset];
  }
  const t = (title || "").toLowerCase();
  if (t.includes("bitcoin") || t.includes("btc")) return ASSET_ICONS.BTC;
  if (t.includes("ethereum") || t.includes("eth")) return ASSET_ICONS.ETH;
  if (t.includes("solana") || t.includes("sol")) return ASSET_ICONS.SOL;
  if (t.includes("somnia") || t.includes("somi")) return ASSET_ICONS.SOMI;
  if (t.includes("openai") || t.includes("gpt-5") || t.includes("chatgpt")) return ASSET_ICONS.OPENAI;
  if (t.includes("nvidia") || t.includes("nvda")) return ASSET_ICONS.NVDA;
  if (t.includes("bnb") || t.includes("binance")) return ASSET_ICONS.BNB;
  if (t.includes("xrp") || t.includes("ripple")) return ASSET_ICONS.XRP;
  if (t.includes("fed") || t.includes("fomc") || t.includes("cpi") || t.includes("inflation") || t.includes("interest rate")) return ASSET_ICONS.FED;
  if (t.includes("gta") || t.includes("grand theft auto")) return ASSET_ICONS.GTA6;
  if (t.includes("game") || t.includes("gaming")) return ASSET_ICONS.GAMING;
  return DEFAULT_MARKET_ICON;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const nowMs = Date.now();
  if (cachedMarkets && nowMs - lastCacheTime < CACHE_TTL_MS) {
    return res.status(200).json(cachedMarkets);
  }

  const nowSec = Math.floor(nowMs / 1000);

  // Live On-Chain DreamDEX Markets Fetcher (strictly real on-chain)
  let onchainMarkets: MarketItem[] = [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const gqlQuery = `query {
      trading: Market(where: { marketType: { _eq: "BINARY" }, clobStatus: { _eq: "Trading" } }, limit: 200, order_by: { expiry: asc }) {
        id
        marketId
        poolAddress
        marketAddress
        asset
        question
        clobStatus
        lastPrice
        expiry
        intervalSec
        tradingStart
        cumulativeQuoteVolume
        yesTokenId
        noTokenId
      }
      finalized: Market(where: { marketType: { _eq: "BINARY" }, clobStatus: { _eq: "Finalized" } }, limit: 100, order_by: { expiry: desc }) {
        id
        marketId
        poolAddress
        marketAddress
        asset
        question
        clobStatus
        lastPrice
        expiry
        intervalSec
        tradingStart
        cumulativeQuoteVolume
        yesTokenId
        noTokenId
      }
    }`;

    const resp = await fetch("https://dev.smk.somnia.host/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: gqlQuery }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const json: any = await resp.json().catch(() => null);
      const tradingList = Array.isArray(json?.data?.trading) ? json.data.trading : [];
      const finalizedList = Array.isArray(json?.data?.finalized) ? json.data.finalized : [];
      const rawList = [...tradingList, ...finalizedList];

      if (rawList.length > 0) {
        onchainMarkets = rawList.map((m: any) => {
          const isLive = m.clobStatus === "Trading";
          const rawLast = Number(m.lastPrice);
          const lastP = rawLast > 0
            ? Math.round((rawLast > 1e12 ? rawLast / 1e18 : rawLast / 1e6) * 100)
            : 50;
          const priceYes = Math.max(1, Math.min(99, lastP));
          const priceNo = 100 - priceYes;
          const rawVol = Number(m.cumulativeQuoteVolume);
          const vol = rawVol > 0
            ? (rawVol > 1e12 ? rawVol / 1e18 : rawVol / 1e6)
            : 0;

          const secondsLeft = Math.max(0, Number(m.expiry || 0) - nowSec);
          let timeLeftStr = `${secondsLeft}s`;
          if (secondsLeft >= 86400) {
            const days = Math.floor(secondsLeft / 86400);
            const remHours = Math.floor((secondsLeft % 86400) / 3600);
            timeLeftStr = remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
          } else if (secondsLeft >= 3600) {
            const hours = Math.floor(secondsLeft / 3600);
            const remMins = Math.floor((secondsLeft % 3600) / 60);
            timeLeftStr = remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
          } else if (secondsLeft >= 60) {
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            timeLeftStr = `${mins}m ${secs}s`;
          }

          const asset = m.asset || "BTC";
          const icon = resolveMarketIcon(asset, m.question || m.title);
          const intervalSec = Number(m.intervalSec || 300);
          let windowStr = `${intervalSec}s`;
          let tickerDuration = `${intervalSec}S`;
          if (intervalSec >= 86400) {
            const days = Math.round(intervalSec / 86400);
            windowStr = `${days}-Day`;
            tickerDuration = `${days}D`;
          } else if (intervalSec >= 3600) {
            const hours = Math.round(intervalSec / 3600);
            windowStr = `${hours}-Hour`;
            tickerDuration = `${hours}H`;
          } else if (intervalSec >= 60) {
            const mins = Math.round(intervalSec / 60);
            windowStr = `${mins}-Min`;
            tickerDuration = `${mins}M`;
          }

          let q = (m.question || "").trim();
          let cleanTitle = q;
          if (!q || q.toLowerCase().includes("closes at or above its opening price")) {
            cleanTitle = `Will ${asset} close UP at end of ${windowStr} Window?`;
          } else {
            cleanTitle = q.replace(/^Pricefeed test:\s*/i, "");
            cleanTitle = cleanTitle.replace(/(?:at\s+)?(?:unix\s+time|timestamp|time)\s*:?\s*(\d{9,11})\??/gi, (_m: string, ts: string) => {
              try {
                const d = new Date(Number(ts) * 1000);
                const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
                const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                return `by ${dateStr}, ${timeStr} UTC?`;
              } catch {
                return _m;
              }
            });
            cleanTitle = cleanTitle.replace(/at or above (\d+(?:\.\d+)?)/gi, (_m: string, p: string) => {
              const n = Number(p);
              return "at or above " + (n >= 1 ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$" + p);
            });
            cleanTitle = cleanTitle.replace(/\s*\(#[a-f0-9]+\)/gi, "");
            cleanTitle = cleanTitle.replace(/\?\?+$/, "?");
            cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
          }

          return {
            ticker: `${asset}-${tickerDuration}-${(m.marketId || m.id || "").slice(-6)}`,
            title: cleanTitle,
            subtitle: isLive ? `🟢 LIVE · Closes in ${timeLeftStr}` : "🏁 Settled Market",
            yes_sub_title: "Up (Yes)",
            price_yes: priceYes,
            price_no: priceNo,
            volume: vol,
            category: "Crypto",
            platform: "dreamdex",
            image: icon,
            marketId: m.marketId || m.id,
            poolAddress: m.poolAddress,
            marketAddress: m.marketAddress,
            yes_token_id: String(m.yesTokenId || "1"),
            no_token_id: String(m.noTokenId || "2"),
            expiry: Number(m.expiry || nowSec + 300),
            intervalSec,
            tradingStart: Number(m.tradingStart || (m.expiry ? Number(m.expiry) - intervalSec : nowSec)),
            asset,
            onchainStatus: isLive ? 1 : 4,
            active: isLive,
            closed: !isLive,
            eventCategory: "Crypto",
            eventTags: ["Somnia", "DreamDEX", asset, m.clobStatus || "Trading"],
            description: m.question || `Official DreamDEX on-chain event contract on Somnia Shannon Testnet.`,
          };
        });
      }
    }
  } catch {
    // Indexer unreachable
  }

  // De-duplicate by ticker/marketId
  const seen = new Set<string>();
  const finalMarkets: MarketItem[] = [];
  for (const item of onchainMarkets) {
    const key = item.marketId || item.ticker;
    if (!seen.has(key)) {
      seen.add(key);
      finalMarkets.push(item);
    }
  }

  cachedMarkets = finalMarkets;
  lastCacheTime = nowMs;

  return res.status(200).json(finalMarkets);
}
