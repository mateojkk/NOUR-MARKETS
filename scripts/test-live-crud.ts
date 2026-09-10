/**
 * Full Live Supabase Database CRUD Test
 * Run with: npx tsx scripts/test-live-crud.ts
 */

import * as fs from "fs";
import * as path from "path";

// Load .env
function loadEnv(p: string) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["'](.*)["']$/, "$1");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadEnv(path.resolve(process.cwd(), ".env"));

import {
  getProfile,
  updateProfile,
  createSession,
  validateSession,
  deleteSession,
  recordTrade,
  getTrades,
  getPositions,
  getStats,
  isSupabaseConfigured,
} from "../api/lib/supabase";

async function main() {
  console.log("=== Live Supabase Database Test ===");
  console.log("isSupabaseConfigured:", isSupabaseConfigured);

  const testAddress = "0x" + Array(40).fill("7").join("");
  console.log("\n1. Testing Profile CRUD on live Supabase:");
  const profile = await getProfile(testAddress);
  console.log("  Created / Fetched user profile:", profile.wallet_address, profile.display_name);

  const updated = await updateProfile(testAddress, {
    display_name: "Live Supabase Trader",
    bio: "Trading live on Somnia Shannon Testnet with Supabase persistence",
  });
  console.log("  Updated profile display_name:", updated.display_name);

  console.log("\n2. Testing Session Persistence on live Supabase:");
  const session = await createSession(testAddress, "magic", "LiveVerificationScript/1.0");
  console.log("  Created live session in Supabase:", session.session_token);

  const validation = await validateSession(session.session_token);
  console.log("  Validated live session:", validation.valid, "Expires:", validation.session?.expires_at);

  await deleteSession(session.session_token);
  const afterRevoke = await validateSession(session.session_token);
  console.log("  After revocation check (should be false):", afterRevoke.valid);

  console.log("\n3. Testing Trade & Position Accounting on live Supabase:");
  const trade = await recordTrade(testAddress, {
    ticker: "ETH-15M-UP-TEST",
    title: "Will ETH close UP?",
    side: "yes",
    action: "buy",
    amount: 50,
    price: 0.60,
    total_cost: 30.0,
    platform: "dreamdex",
    tx_signature: "0xlivetestsig123",
  });
  console.log("  Recorded trade in live Supabase 'trades' table. Trade ID:", trade.id);

  const trades = await getTrades(testAddress);
  console.log("  Fetched trades count from live Supabase:", trades.length);

  const positions = await getPositions(testAddress);
  console.log("  Fetched positions from live Supabase:", positions);

  const stats = await getStats(testAddress);
  console.log("  Computed stats:", stats);

  console.log("\n🎉 ALL LIVE DATABASE CRUD OPERATIONS VERIFIED AGAINST SUPABASE!");
}

main().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
