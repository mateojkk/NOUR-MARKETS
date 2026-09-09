import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";

  if (url.includes("/profile")) {
    const address = (req.query.address as string) || "0x0000000000000000000000000000000000000000";
    return res.status(200).json({
      wallet_address: address,
      display_name: `Trader ${address.slice(0, 6)}`,
      username: address.slice(0, 8),
      bio: "Somnia prediction market trader",
      avatar_url: "",
      is_beta_user: true,
    });
  }

  if (url.includes("/trades") || url.includes("/positions")) {
    return res.status(200).json([]);
  }

  if (url.includes("/stats")) {
    return res.status(200).json({
      total_trades: 0,
      total_volume: 0,
      total_pnl: 0,
      win_rate: 0,
      win_count: 0,
      loss_count: 0,
      rank: { rank: "R", title: "Rookie", score: 0, progress: 0 }
    });
  }

  return res.status(200).json({ status: "ok" });
}
