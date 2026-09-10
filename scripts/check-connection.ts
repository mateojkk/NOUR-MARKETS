/**
 * Test Live Supabase Connection
 * Run with: npx tsx scripts/check-connection.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Simple zero-dependency .env reader
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, "$1");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), "usenour/.env"));

const url =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

console.log("=== Nour Supabase Live Connection Check ===");
console.log("Supabase URL:", url ? url : "(Not set)");
console.log("Supabase Key:", key ? `${key.slice(0, 8)}...${key.slice(-4)}` : "(Not set)");

if (!url || !key) {
  console.log("\n⚠️  Supabase credentials not found in environment.");
  console.log("Please add your credentials to your root .env or usenour/.env:");
  console.log("  SUPABASE_URL=https://your-project.supabase.co");
  console.log("  SUPABASE_ANON_KEY=your-anon-key");
  process.exit(1);
}

const client = createClient(url, key);

async function verify() {
  const tables = ["users", "sessions", "trades", "positions", "watchlist"];
  console.log("\nTesting table access:");

  let allOk = true;
  for (const table of tables) {
    const { data, error } = await client.from(table).select("*").limit(1);
    if (error) {
      console.error(`  ❌ Table '${table}' failed:`, error.message);
      allOk = false;
    } else {
      console.log(`  ✅ Table '${table}' connected successfully (${data?.length || 0} rows found)`);
    }
  }

  if (allOk) {
    console.log("\n🎉 All 5 tables are live, accessible, and ready for use!");
  }
}

verify().catch((err) => {
  console.error("Connection check failed:", err.message);
  process.exit(1);
});
