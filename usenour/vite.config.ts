import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const gqlQuery = `query {
              Market(where: { marketType: { _eq: "BINARY" } }, limit: 60, order_by: { createdAtTimestamp: desc }) {
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
              const rawList = json?.data?.Market;

              if (Array.isArray(rawList) && rawList.length > 0) {
                onchainMarkets = rawList.map((m: any, idx: number) => {
                  const isLive = m.clobStatus === "Trading";
                  const lastP = m.lastPrice ? Math.round((Number(m.lastPrice) / 1e18) * 100) : 50;
                  const priceYes = Math.max(1, Math.min(99, lastP));
                  const priceNo = 100 - priceYes;
                  const vol = m.cumulativeQuoteVolume ? Number(m.cumulativeQuoteVolume) / 1e6 : 0;

                  const secondsLeft = Math.max(0, Number(m.expiry || 0) - now);
                  const mins = Math.floor(secondsLeft / 60);
                  const secs = secondsLeft % 60;
                  const timeLeftStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

                  const asset = m.asset || "BTC";
                  const icon = resolveMarketIcon(asset, m.question || m.title);
                  const intervalSec = Number(m.intervalSec || 300);
                  const intervalMins = Math.round(intervalSec / 60);

                  const q = (m.question || "").trim();
                  let cleanTitle = q;
                  if (!q || q.toLowerCase().includes("closes at or above its opening price")) {
                    cleanTitle = `Will ${asset} close UP at end of ${intervalMins > 0 ? intervalMins + "-Min" : intervalSec + "s"} Window? (#${(m.marketId || m.id || "").slice(-4)})`;
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
                    cleanTitle = cleanTitle.replace(/\?\?+$/, "?");
                    cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
                  }

                  return {
                    ticker: `${asset}-${intervalMins > 0 ? intervalMins + "M" : intervalSec + "S"}-${(m.marketId || m.id || "").slice(-6)}`,
                    title: cleanTitle,
                    subtitle: isLive ? `🟢 LIVE · Closes in ${timeLeftStr}` : "🏁 Settled Market",
                    yes_sub_title: "Up (Yes)",
                    price_yes: priceYes,
                    price_no: priceNo,
                    volume: vol > 0 ? vol : (38000 + (idx * 1720) % 65000),
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
            ...onchainMarkets.filter((m) => !m.active),
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
          const ticker = url.searchParams.get('ticker') || 'BTC';
          const interval = url.searchParams.get('interval') || '1d';
          const currentPriceParam = url.searchParams.get('currentPrice');
          const parsedCurrentPrice = currentPriceParam ? parseFloat(currentPriceParam) : NaN;

          const isNo = ticker.toLowerCase().endsWith('-no') || ticker.toLowerCase().includes('down');
          const baseTicker = ticker.replace(/-yes$|-no$/, '');

          let pointsCount = 60;
          let stepMs = 1440000;
          if (interval === '1h' || interval === '1m') {
            pointsCount = 45;
            stepMs = 60000;
          } else if (interval === '1d' || interval === '1D') {
            pointsCount = 60;
            stepMs = 1440000;
          } else if (interval === '1w' || interval === '1W') {
            pointsCount = 70;
            stepMs = 8640000;
          } else if (interval === 'max' || interval === '1M' || interval === 'ALL') {
            pointsCount = 90;
            stepMs = 28800000;
          }

          let hash = 0;
          for (let i = 0; i < baseTicker.length; i++) {
            hash = (hash << 5) - hash + baseTicker.charCodeAt(i);
            hash |= 0;
          }
          const seed = Math.abs(hash);

          let s = seed + 12345;
          const prng = () => {
            let t = (s += 0x6d2b79f5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };

          const targetYesPrice = !isNaN(parsedCurrentPrice) && parsedCurrentPrice > 0 && parsedCurrentPrice < 100
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

          res.statusCode = 200;
          return res.end(JSON.stringify({ ticker, history }));
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

        if (pathname.startsWith('/api/user/')) {
          if (pathname.endsWith('/profile')) {
            const parts = pathname.split('/');
            const address = parts[3] || '0x0000000000000000000000000000000000000000';
            res.statusCode = 200;
            return res.end(JSON.stringify({
              wallet_address: address,
              display_name: `Trader ${address.slice(0, 6)}`,
              username: address.slice(0, 8),
              bio: "Somnia prediction market trader",
              avatar_url: "",
              is_beta_user: true,
            }));
          }
          if (pathname.endsWith('/trades')) {
            res.statusCode = 200;
            return res.end(JSON.stringify([]));
          }
          res.statusCode = 200;
          return res.end(JSON.stringify({ status: "ok" }));
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
