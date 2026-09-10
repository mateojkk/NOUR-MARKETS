import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getProfile,
  updateProfile,
  getPublicProfileByUsername,
  getTrades,
  recordTrade,
  getPositions,
  getStats,
  createSession,
  validateSession,
  deleteSession,
  isSupabaseConfigured,
} from "./lib/supabase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support standard Node http.ServerResponse if invoked outside Vercel
  if (!res.status) {
    (res as any).status = function (code: number) {
      this.statusCode = code;
      return this;
    };
  }
  if (!res.json) {
    (res as any).json = function (data: any) {
      this.setHeader("Content-Type", "application/json");
      this.end(JSON.stringify(data));
      return this;
    };
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const parsedUrl = new URL(req.url || "", "http://localhost");
    if (!req.query) {
      (req as any).query = Object.fromEntries(parsedUrl.searchParams.entries());
    }

    // Determine path from query subpath or raw url
    let pathname = "";
    if (req.query?.subpath) {
      const sub = Array.isArray(req.query.subpath)
        ? req.query.subpath.join("/")
        : req.query.subpath;
      pathname = `/api/user/${sub}`;
    } else {
      pathname = parsedUrl.pathname;
    }

    // Route: /api/user/session
    if (pathname.match(/\/api\/user\/session$/i)) {
      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const address = body.wallet_address || body.address;
        const authMethod = body.auth_method === "magic" ? "magic" : "injected";
        if (!address) {
          return res.status(400).json({ error: "wallet_address required" });
        }
        const userAgent = (req.headers && (req.headers["user-agent"] as string)) || "";
        const session = await createSession(address, authMethod, userAgent);
        return res.status(201).json(session);
      }

      if (req.method === "GET") {
        const token = (req.query?.token as string) || "";
        const result = await validateSession(token);
        return res.status(200).json(result);
      }

      if (req.method === "DELETE") {
        const token =
          (req.query?.token as string) ||
          (typeof req.body === "object" ? req.body?.token : "") ||
          "";
        await deleteSession(token);
        return res.status(200).json({ status: "ok", message: "Session revoked" });
      }
    }

    // Route: GET /api/user/username/:username/public
    const publicMatch = pathname.match(/\/api\/user\/username\/([^/]+)\/public/i);
    if (publicMatch) {
      const username = decodeURIComponent(publicMatch[1]);
      const publicData = await getPublicProfileByUsername(username);
      if (!publicData) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(200).json(publicData);
    }

    // Match /api/user/:address/(profile|trades|positions|stats)
    const userRouteMatch = pathname.match(/\/api\/user\/([^/]+)\/(profile|trades|positions|stats)/i);
    
    if (userRouteMatch) {
      const address = decodeURIComponent(userRouteMatch[1]);
      const endpoint = userRouteMatch[2].toLowerCase();

      // Profile
      if (endpoint === "profile") {
        if (req.method === "PUT") {
          const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
          const updated = await updateProfile(address, {
            display_name: body.display_name,
            username: body.username,
            bio: body.bio,
            avatar_url: body.avatar_url,
          });
          return res.status(200).json(updated);
        }
        const profile = await getProfile(address);
        return res.status(200).json(profile);
      }

      // Trades
      if (endpoint === "trades") {
        if (req.method === "POST") {
          const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
          const trade = await recordTrade(address, {
            ticker: body.ticker || "UNKNOWN",
            title: body.title || "Prediction Market",
            side: body.side || "yes",
            action: body.action || "buy",
            amount: Number(body.amount || 0),
            price: Number(body.price || 0),
            total_cost: Number(body.total_cost || 0),
            platform: body.platform || "dreamdex",
            tx_signature: body.tx_signature,
            platform_fee: Number(body.platform_fee || 0),
            pnl: body.pnl !== undefined ? Number(body.pnl) : undefined,
          });
          return res.status(201).json(trade);
        }
        const limit = Number(req.query?.limit) || 100;
        const trades = await getTrades(address, limit);
        return res.status(200).json(trades);
      }

      // Positions
      if (endpoint === "positions") {
        const positions = await getPositions(address);
        return res.status(200).json(positions);
      }

      // Stats
      if (endpoint === "stats") {
        const stats = await getStats(address);
        return res.status(200).json(stats);
      }
    }

    // Default status & diagnostics
    return res.status(200).json({
      status: "ok",
      database: isSupabaseConfigured() ? "supabase" : "in-memory-fallback",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("API /api/user error:", error);
    return res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
}
