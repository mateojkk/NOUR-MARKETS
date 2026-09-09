import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";
import type { Market } from "../types";
import logger from "../utils/logger";

// v2: cache version bumped — v1 caches contained demo markets that were removed
const CACHE_KEY = "nour-somnia-markets-v2";

export function useMarketData() {
  const [markets, setMarkets] = useState<Market[]>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/markets`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setMarkets(data);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
            setIsLoading(false);
            return;
          }
        }
      } catch {
        logger.warn("Backend /api/markets not responding");
      }

      // No demo-market fallback anymore — if the live feed fails, keep the
      // last cached markets (or an empty list) rather than fake listings.
      setIsLoading(false);
    };

    fetchMarkets();

    // Refresh every 10 seconds for real-time window tracking
    const interval = setInterval(fetchMarkets, 10000);
    return () => clearInterval(interval);
  }, []);

  return { markets, setMarkets, isLoading };
}
