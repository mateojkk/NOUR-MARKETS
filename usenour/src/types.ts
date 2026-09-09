// --- Market Types for Nour (Somnia DreamDEX Event Contracts) ---

export interface Market {
  ticker: string;
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  price_yes: number;
  price_no: number;
  volume: number;
  category: string;
  yes_bid?: number;
  no_bid?: number;
  image?: string;
  // DreamDEX Event Contract fields
  platform?: "dreamdex";
  marketId?: string;
  poolAddress?: string;
  yes_token_id?: string;
  no_token_id?: string;
  expiry?: number;
  intervalSec?: number;
  asset?: string;
  onchainStatus?: number; // 1 = Trading, 2 = Locked, 3 = Finalized
  description?: string;
  active?: boolean;
  closed?: boolean;
  end_date?: string;
  eventCategory?: string;
  eventTags?: string[];
}

export interface MarketGroup {
  ticker?: string;
  title: string;
  category?: string;
  totalVolume: number;
  markets: Market[];
  image?: string;
}

export interface MarketUpdate {
  ticker: string;
  price_yes: number;
  price_no: number;
  type?: string;
  title?: string;
}

export interface Position {
  marketId: string;
  ticker: string;
  title: string;
  side: "yes" | "no";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  poolAddress?: string;
  outcomeTokenId?: string;
  isSettled?: boolean;
  canRedeem?: boolean;
  won?: boolean;
}

// --- Helper Functions ---

export const getSubtitle = (m: Market, parentTitle?: string): string => {
  const safeString = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === 'string' && val.length > 1 && val !== '[' && val !== '{') return val;
    if (typeof val === 'object') {
      return val.name || val.label || val.title || null;
    }
    return null;
  };
  
  const yesSubTitle = safeString(m.yes_sub_title);
  if (yesSubTitle && yesSubTitle !== "Yes" && yesSubTitle !== "No") return yesSubTitle;
  
  const subtitle = safeString(m.subtitle);
  if (subtitle && subtitle !== "Yes" && subtitle !== "No") return subtitle;
  
  if (m.title && m.title.length > 1 && m.title !== parentTitle) return m.title;
  if (yesSubTitle) return yesSubTitle;
  
  return "Yes";
};

export const formatVolume = (vol: number): string => {
  if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
};

export function formatMarketTitle(title: string): string {
  if (!title) return "";
  let str = title.trim();
  str = str.replace(/^Pricefeed test:\s*/i, "");

  // Convert raw unix timestamps like 'at unix time 1788858900' to human-readable date/time
  str = str.replace(/(?:at\s+)?(?:unix\s+time|timestamp|time)\s*:?\s*(\d{9,11})\??/gi, (_m, ts) => {
    try {
      const d = new Date(Number(ts) * 1000);
      const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      return `by ${dateStr}, ${timeStr} UTC?`;
    } catch {
      return _m;
    }
  });

  // Format raw strike numbers like 'at or above 2479.72' -> 'at or above $2,479.72'
  str = str.replace(/at or above (\d+(?:\.\d+)?)/gi, (_m, p) => {
    const n = Number(p);
    return "at or above " + (n >= 1 ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$" + p);
  });

  str = str.replace(/\?\?+$/, "?");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const DEFAULT_MARKET_ICON = "/icons/nour.png";

export const ASSET_ICONS: Record<string, string> = {
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

export function resolveMarketIcon(asset?: string, title?: string): string {
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
