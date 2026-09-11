import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import userHandler from '../api/user.ts'

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

let localCachedMarkets: any[] | null = null;
let lastLocalCacheTime = 0;
const LOCAL_CACHE_TTL_MS = 15000;

function localApiDevPlugin() {
  return {
    name: 'local-api-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (pathname === '/api/markets') {
          const nowMs = Date.now();
          if (localCachedMarkets && nowMs - lastLocalCacheTime < LOCAL_CACHE_TTL_MS) {
            res.statusCode = 200;
            return res.end(JSON.stringify(localCachedMarkets));
          }

          const now = Math.floor(nowMs / 1000);

          let onchainMarkets: any[] = [];
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

              if (Array.isArray(rawList) && rawList.length > 0) {
                onchainMarkets = rawList.map((m: any) => {
                  const isLive = m.clobStatus === "Trading";
                  // DreamDEX BINARY markets quote on a 1e6 probability grid
                  // (testnet tUSDC) or a 1e18 grid (USDso). Normalize by grid
                  // magnitude — the two scales differ by ~1e12.
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

                  const secondsLeft = Math.max(0, Number(m.expiry || 0) - now);
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

                  const q = (m.question || "").trim();
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
                    expiry: Number(m.expiry || now + 300),
                    intervalSec,
                    tradingStart: Number(m.tradingStart || (m.expiry ? Number(m.expiry) - intervalSec : now)),
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
            // Indexer slow/unreachable — no fallback to demo listings anymore
          }

          // Live on-chain DreamDEX markets only — demo markets removed
          const combined = [
            ...onchainMarkets.filter((m) => m.active),
          ];

          const seen = new Set<string>();
          const finalMarkets: any[] = [];
          for (const item of combined) {
            const key = item.marketId || item.ticker;
            if (!seen.has(key)) {
              seen.add(key);
              finalMarkets.push(item);
            }
          }

          localCachedMarkets = finalMarkets;
          lastLocalCacheTime = nowMs;

          res.statusCode = 200;
          return res.end(JSON.stringify(finalMarkets));
        }

        if (pathname === '/api/timeseries') {
          // Real OHLC candles (60s) from the DreamDEX indexer — no synthetic paths
          const marketId = url.searchParams.get('marketId') || '';
          if (!marketId) {
            res.statusCode = 200;
            return res.end(JSON.stringify({ history: [], source: 'none' }));
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
            const resp = await fetch('https://dev.smk.somnia.host/v1/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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

          res.statusCode = 200;
          return res.end(JSON.stringify({ marketId, history, source: 'candles' }));
        }

        if (pathname === '/api/orderbook') {
          res.statusCode = 200;
          return res.end(JSON.stringify({
            symbol: url.searchParams.get('symbol') || 'BTC-15M-UP',
            bids: [[0.51, 1250], [0.50, 3400], [0.49, 5800]],
            asks: [[0.53, 1100], [0.54, 2900], [0.55, 6200]],
            spread: 0.02,
            timestamp: Date.now(),
          }));
        }

        if (pathname === '/api/faucet') {
          res.statusCode = 200;
          return res.end(JSON.stringify({
            chain: "Somnia Shannon Testnet",
            chainId: 50312,
            collateralToken: "tUSDC",
            collateralAddress: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
            decimals: 6,
            maxFaucetClaim: 10000,
          }));
        }

        if (pathname.startsWith('/api/user')) {
          let bodyStr = '';
          for await (const chunk of req) {
            bodyStr += chunk;
          }
          if (bodyStr) {
            try {
              req.body = JSON.parse(bodyStr);
            } catch {
              req.body = bodyStr;
            }
          }
          req.query = Object.fromEntries(url.searchParams.entries());
          await userHandler(req, res);
          return;
        }

        if (pathname === '/api/health') {
          res.statusCode = 200;
          return res.end(JSON.stringify({ status: "ok", network: "Somnia Shannon Testnet" }));
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiDevPlugin()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    allowedHosts: ['logical-wallaby.outray.app'],
  },
})
