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
          const windows = [
            { asset: "BTC", intervalSec: 300, name: "5-Minute Window", icon: "/icons/btc.svg", title: "Bitcoin UP at 5-Min Close?" },
            { asset: "BTC", intervalSec: 900, name: "15-Minute Window", icon: "/icons/btc.svg", title: "Bitcoin UP at 15-Min Close?" },
            { asset: "BTC", intervalSec: 3600, name: "1-Hour Window", icon: "/icons/btc.svg", title: "Bitcoin UP at 1-Hour Close?" },
            { asset: "BTC", intervalSec: 86400, name: "Daily Window", icon: "/icons/btc.svg", title: "Bitcoin UP at Daily Close?" },
            { asset: "ETH", intervalSec: 300, name: "5-Minute Window", icon: "/icons/eth.svg", title: "Ethereum UP at 5-Min Close?" },
            { asset: "ETH", intervalSec: 900, name: "15-Minute Window", icon: "/icons/eth.svg", title: "Ethereum UP at 15-Min Close?" },
            { asset: "ETH", intervalSec: 3600, name: "1-Hour Window", icon: "/icons/eth.svg", title: "Ethereum UP at 1-Hour Close?" },
            { asset: "ETH", intervalSec: 86400, name: "Daily Window", icon: "/icons/eth.svg", title: "Ethereum UP at Daily Close?" },
            { asset: "SOL", intervalSec: 300, name: "5-Minute Window", icon: "/icons/sol.svg", title: "Solana UP at 5-Min Close?" },
            { asset: "SOL", intervalSec: 900, name: "15-Minute Window", icon: "/icons/sol.svg", title: "Solana UP at 15-Min Close?" },
            { asset: "SOL", intervalSec: 3600, name: "1-Hour Window", icon: "/icons/sol.svg", title: "Solana UP at 1-Hour Close?" },
            { asset: "SOMI", intervalSec: 300, name: "5-Minute Window", icon: "/icons/somnia.svg", title: "Somnia (SOMI) UP at 5-Min Close?" },
            { asset: "SOMI", intervalSec: 900, name: "15-Minute Window", icon: "/icons/somnia.svg", title: "Somnia (SOMI) UP at 15-Min Close?" },
            { asset: "SOMI", intervalSec: 3600, name: "1-Hour Window", icon: "/icons/somnia.svg", title: "Somnia (SOMI) UP at 1-Hour Close?" },
            { asset: "BNB", intervalSec: 900, name: "15-Minute Window", icon: "/icons/bnb.svg", title: "BNB UP at 15-Min Close?" },
            { asset: "XRP", intervalSec: 900, name: "15-Minute Window", icon: "/icons/xrp.svg", title: "XRP UP at 15-Min Close?" },
          ];

          const rolling = windows.map((w, index) => {
            const currentWindowStart = Math.floor(now / w.intervalSec) * w.intervalSec;
            const expiry = currentWindowStart + w.intervalSec;
            const secondsLeft = Math.max(1, expiry - now);

            const seed = (currentWindowStart + index * 97) % 100;
            const baseProb = 46 + (seed % 10);
            const priceYes = Math.min(95, Math.max(5, baseProb));
            const priceNo = 100 - priceYes;

            const poolSuffix = (index + 1).toString().padStart(4, "0");
            const poolAddress = `0x3ecc694cef705358864a646142ac17a90e29${poolSuffix}`;
            const marketId = `0x${(index + 100).toString(16).padStart(64, "0")}`;

            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            const timeLeftStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

            return {
              ticker: `${w.asset}-${w.intervalSec / 60}M-${expiry}`,
              title: w.title,
              subtitle: `${w.name} (Closes in ${timeLeftStr})`,
              yes_sub_title: "Up (Yes)",
              price_yes: priceYes,
              price_no: priceNo,
              volume: 54200 + seed * 1420,
              category: "Crypto",
              platform: "dreamdex",
              image: w.icon,
              marketId,
              poolAddress,
              yes_token_id: `${(index + 1) * 2 - 1}`,
              no_token_id: `${(index + 1) * 2}`,
              expiry,
              intervalSec: w.intervalSec,
              asset: w.asset,
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Somnia", "DreamDEX", "Event Contracts", w.asset],
              description: `Predict whether ${w.asset} price will settle at or above its opening price at the end of this ${w.name.toLowerCase()} on Somnia Shannon Testnet.`,
            };
          });

          const ecosystem = [
            {
              ticker: "SOMNIA-TPS-400K",
              title: "Will Somnia reach 400,000+ Peak TPS on Shannon Testnet?",
              subtitle: "Shannon Testnet Milestone",
              yes_sub_title: "Yes",
              price_yes: 74,
              price_no: 26,
              volume: 182400,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/somnia.svg",
              marketId: `0x${(201).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290201",
              yes_token_id: "201",
              no_token_id: "202",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 90,
              intervalSec: 86400 * 90,
              asset: "SOMI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Somnia", "DreamDEX", "High TPS", "Milestone"],
              description: "Resolves to Yes if Somnia Shannon Testnet achieves a peak throughput of 400,000+ transactions per second.",
            },
            {
              ticker: "SOMNIA-MAINNET-2026",
              title: "Will Somnia Network launch Mainnet in 2026?",
              subtitle: "Network Roadmap",
              yes_sub_title: "Yes",
              price_yes: 88,
              price_no: 12,
              volume: 245000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/somnia.svg",
              marketId: `0x${(202).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290202",
              yes_token_id: "203",
              no_token_id: "204",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 120,
              intervalSec: 86400 * 120,
              asset: "SOMI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Somnia", "Mainnet", "L1"],
              description: "Resolves to Yes if Somnia genesis mainnet block is produced and public access is opened prior to Dec 31, 2026.",
            },
            {
              ticker: "DREAMDEX-VOL-10M",
              title: "Will DreamDEX surpass $10M Weekly Volume on Somnia?",
              subtitle: "DeFi Volume Milestone",
              yes_sub_title: "Yes",
              price_yes: 62,
              price_no: 38,
              volume: 98300,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/somnia.svg",
              marketId: `0x${(203).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290203",
              yes_token_id: "205",
              no_token_id: "206",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 30,
              intervalSec: 86400 * 30,
              asset: "DREAM",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["DreamDEX", "Somnia", "DeFi", "Volume"],
              description: "Resolves to Yes if cumulative 7-day rolling trading volume on DreamDEX Event Contracts exceeds $10,000,000.",
            },
            {
              ticker: "SOMNIA-1B-TXS",
              title: "Will Somnia Testnet reach 1 Billion Total Transactions?",
              subtitle: "Stress-Test Milestone",
              yes_sub_title: "Yes",
              price_yes: 79,
              price_no: 21,
              volume: 134000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/somnia.svg",
              marketId: `0x${(204).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290204",
              yes_token_id: "207",
              no_token_id: "208",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 60,
              intervalSec: 86400 * 60,
              asset: "SOMI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Somnia", "Transactions", "StressTest"],
              description: "Resolves to Yes if Shannon Testnet cumulative transaction count exceeds 1,000,000,000.",
            },
            {
              ticker: "SOMNIA-GAMING-PARTNER",
              title: "Will Somnia announce a Major AAA Gaming Studio Partnership?",
              subtitle: "Gaming Ecosystem",
              yes_sub_title: "Yes",
              price_yes: 71,
              price_no: 29,
              volume: 112000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/somnia.svg",
              marketId: `0x${(205).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290205",
              yes_token_id: "209",
              no_token_id: "210",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 90,
              intervalSec: 86400 * 90,
              asset: "SOMI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Somnia", "Gaming", "Partnership"],
              description: "Resolves to Yes if Somnia officially announces an integrated deployment with a recognized gaming studio.",
            },
            {
              ticker: "SOMI-500M-MCAP",
              title: "Will SOMI Initial Market Cap surpass $500M at TGE?",
              subtitle: "Token Generation Event",
              yes_sub_title: "Yes",
              price_yes: 65,
              price_no: 35,
              volume: 168000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/somnia.svg",
              marketId: `0x${(206).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290206",
              yes_token_id: "211",
              no_token_id: "212",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 150,
              intervalSec: 86400 * 150,
              asset: "SOMI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Somnia", "TGE", "Valuation"],
              description: "Resolves to Yes if SOMI circulating market cap exceeds $500M within 24 hours of exchange listing.",
            },
            {
              ticker: "BTC-100K-2026",
              title: "Will Bitcoin hit $100,000 before 2027?",
              subtitle: "Crypto Price Target",
              yes_sub_title: "Yes",
              price_yes: 67,
              price_no: 33,
              volume: 389000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/btc.svg",
              marketId: `0x${(207).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290207",
              yes_token_id: "213",
              no_token_id: "214",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 180,
              intervalSec: 86400 * 180,
              asset: "BTC",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Bitcoin", "Target", "Macro"],
              description: "Resolves to Yes if BTC/USD trades at or above $100,000 on major oracle feeds before January 1, 2027.",
            },
            {
              ticker: "BTC-ATH-Q4",
              title: "Will Bitcoin reach a new All-Time High in Q4 2026?",
              subtitle: "Market Cycle Target",
              yes_sub_title: "Yes",
              price_yes: 59,
              price_no: 41,
              volume: 215000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/btc.svg",
              marketId: `0x${(208).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290208",
              yes_token_id: "215",
              no_token_id: "216",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 115,
              intervalSec: 86400 * 115,
              asset: "BTC",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Bitcoin", "ATH", "BullRun"],
              description: "Resolves to Yes if Bitcoin establishes a new all-time high price before end of Q4 2026.",
            },
            {
              ticker: "ETH-3500-2026",
              title: "Will Ethereum break above $3,500 in 2026?",
              subtitle: "Ethereum Price Milestone",
              yes_sub_title: "Yes",
              price_yes: 54,
              price_no: 46,
              volume: 198000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/eth.svg",
              marketId: `0x${(209).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290209",
              yes_token_id: "217",
              no_token_id: "218",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 100,
              intervalSec: 86400 * 100,
              asset: "ETH",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Ethereum", "Price", "Target"],
              description: "Resolves to Yes if ETH/USD prints at or above $3,500 on oracle feeds in 2026.",
            },
            {
              ticker: "SOL-ETF-SEC",
              title: "Will a Solana Spot ETF be approved by the US SEC in 2026?",
              subtitle: "Regulatory Approval",
              yes_sub_title: "Yes",
              price_yes: 43,
              price_no: 57,
              volume: 175000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/sol.svg",
              marketId: `0x${(210).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290210",
              yes_token_id: "219",
              no_token_id: "220",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 140,
              intervalSec: 86400 * 140,
              asset: "SOL",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Solana", "ETF", "SEC"],
              description: "Resolves to Yes if the US SEC formally approves a spot Solana ETF application.",
            },
            {
              ticker: "SOL-FLIP-ETH-DEX",
              title: "Will Solana flip Ethereum in 24h DEX volume in 2026?",
              subtitle: "DEX Market Share Battle",
              yes_sub_title: "Yes",
              price_yes: 68,
              price_no: 32,
              volume: 146000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/sol.svg",
              marketId: `0x${(211).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290211",
              yes_token_id: "221",
              no_token_id: "222",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 80,
              intervalSec: 86400 * 80,
              asset: "SOL",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Solana", "Ethereum", "DEX"],
              description: "Resolves to Yes if 24-hour decentralized exchange volume on Solana exceeds Ethereum mainnet.",
            },
            {
              ticker: "TOTAL-CRYPTO-4T",
              title: "Will Total Crypto Market Cap exceed $4 Trillion in 2026?",
              subtitle: "Global Market Capitalization",
              yes_sub_title: "Yes",
              price_yes: 51,
              price_no: 49,
              volume: 230000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/btc.svg",
              marketId: `0x${(212).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290212",
              yes_token_id: "223",
              no_token_id: "224",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 160,
              intervalSec: 86400 * 160,
              asset: "TOTAL",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["MarketCap", "Total", "Macro"],
              description: "Resolves to Yes if aggregate cryptocurrency market cap exceeds $4,000,000,000,000.",
            },
            {
              ticker: "FED-RATE-CUT",
              title: "Will the Federal Reserve cut interest rates at next FOMC?",
              subtitle: "Macro Economic Policy",
              yes_sub_title: "Yes",
              price_yes: 58,
              price_no: 42,
              volume: 142000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/fed.svg",
              marketId: `0x${(213).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290213",
              yes_token_id: "225",
              no_token_id: "226",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 45,
              intervalSec: 86400 * 45,
              asset: "USD",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["FOMC", "Macro", "Interest Rates"],
              description: "Resolves to Yes if the FOMC announces a rate cut in the federal funds rate.",
            },
            {
              ticker: "US-CPI-25",
              title: "Will US CPI Year-over-Year Inflation drop below 2.5%?",
              subtitle: "Inflation Print Target",
              yes_sub_title: "Yes",
              price_yes: 47,
              price_no: 53,
              volume: 119000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/fed.svg",
              marketId: `0x${(214).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290214",
              yes_token_id: "227",
              no_token_id: "228",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 60,
              intervalSec: 86400 * 60,
              asset: "CPI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Inflation", "CPI", "Macro"],
              description: "Resolves to Yes if official Bureau of Labor Statistics headline CPI YoY prints below 2.5%.",
            },
            {
              ticker: "OPENAI-GPT5-2026",
              title: "Will OpenAI publicly release GPT-5 before end of 2026?",
              subtitle: "Frontier AI Release",
              yes_sub_title: "Yes",
              price_yes: 63,
              price_no: 37,
              volume: 285000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/openai.svg",
              marketId: `0x${(215).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290215",
              yes_token_id: "229",
              no_token_id: "230",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 110,
              intervalSec: 86400 * 110,
              asset: "AI",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["OpenAI", "GPT-5", "Tech"],
              description: "Resolves to Yes if OpenAI provides public API or ChatGPT access to a designated GPT-5 model.",
            },
            {
              ticker: "NVDA-4T-2026",
              title: "Will Nvidia Market Cap surpass $4 Trillion in 2026?",
              subtitle: "AI Semiconductor Target",
              yes_sub_title: "Yes",
              price_yes: 57,
              price_no: 43,
              volume: 310000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/nvidia.svg",
              marketId: `0x${(216).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290216",
              yes_token_id: "231",
              no_token_id: "232",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 130,
              intervalSec: 86400 * 130,
              asset: "NVDA",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Nvidia", "Stocks", "MarketCap"],
              description: "Resolves to Yes if NVDA market capitalization closes above $4,000,000,000,000 on NASDAQ.",
            },
            {
              ticker: "GTA6-DELAY-2026",
              title: "Will Grand Theft Auto VI release date be delayed past 2026?",
              subtitle: "Gaming Entertainment",
              yes_sub_title: "Yes",
              price_yes: 36,
              price_no: 64,
              volume: 188000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/gta6.svg",
              marketId: `0x${(217).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290217",
              yes_token_id: "233",
              no_token_id: "234",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 160,
              intervalSec: 86400 * 160,
              asset: "GTA6",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Gaming", "GTA6", "Rockstar"],
              description: "Resolves to Yes if Rockstar Games or Take-Two announces a release date shift beyond calendar year 2026.",
            },
            {
              ticker: "WEB3-GAME-1M-DAU",
              title: "Will a Web3 Game reach 1M Daily Active Players in 2026?",
              subtitle: "On-Chain Gaming Milestone",
              yes_sub_title: "Yes",
              price_yes: 64,
              price_no: 36,
              volume: 147000,
              category: "Crypto",
              platform: "dreamdex",
              image: "/icons/gaming.svg",
              marketId: `0x${(218).toString(16).padStart(64, "0")}`,
              poolAddress: "0x3ecC694Cef705358864a646142ac17A90E290218",
              yes_token_id: "235",
              no_token_id: "236",
              expiry: Math.floor(Date.now() / 1000) + 86400 * 170,
              intervalSec: 86400 * 170,
              asset: "GAMING",
              onchainStatus: 1,
              active: true,
              closed: false,
              eventCategory: "Crypto",
              eventTags: ["Web3", "Gaming", "DAU", "MassAdoption"],
              description: "Resolves to Yes if an on-chain Web3 title registers 1,000,000+ daily active on-chain wallets.",
            },
          ];

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
            // Silently fall back to baseline rolling & ecosystem contracts if indexer is slow
          }

          const combined = [
            ...onchainMarkets.filter((m) => m.active),
            ...rolling,
            ...ecosystem,
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
