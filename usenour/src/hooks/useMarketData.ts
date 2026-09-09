import { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";
import { getLiveEventContractMarkets } from "../services/dreamdex";
import type { Market } from "../types";
import logger from "../utils/logger";

const CACHE_KEY = "nour-somnia-markets-v1";

export function useMarketData() {
  const [markets, setMarkets] = useState<Market[]>(() => {
    // Initial immediate load from local generation
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data } = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}
    return getLiveEventContractMarkets();
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/markets`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setMarkets(data);
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
            return;
          }
        }
      } catch {
        logger.warn("Backend /api/markets not responding, using direct Somnia event contracts feed");
      }
      
      // Fallback: generate live on-chain rolling event contracts directly
      const live = getLiveEventContractMarkets();
      setMarkets(live);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: live, timestamp: Date.now() }));
      setIsLoading(false);
    };

    fetchMarkets();

    // Refresh every 10 seconds for real-time window tracking
    const interval = setInterval(fetchMarkets, 10000);
    return () => clearInterval(interval);
  }, []);

  return { markets, setMarkets, isLoading };
}
