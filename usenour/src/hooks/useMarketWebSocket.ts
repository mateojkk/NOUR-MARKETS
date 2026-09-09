import { useState, useEffect } from "react";
import { API_WS_URL } from "../config/api";

export function useMarketWebSocket(_markets: any[], setMarkets: React.Dispatch<React.SetStateAction<any[]>>) {
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCleanedUp = false;

    // Use configured WS URL or default to DreamDEX's official Hasura GraphQL WS
    const wsTarget = API_WS_URL && API_WS_URL.trim() !== ""
      ? API_WS_URL
      : "wss://dev.smk.somnia.host/v1/graphql";

    const isGraphqlWs = wsTarget.includes("graphql");

    // Background price pulse if disconnected
    const simulatedTickInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) return;
      setMarkets((prev) => {
        if (!prev || prev.length === 0) return prev;
        const targetIndex = Math.floor(Math.random() * prev.length);
        const target = prev[targetIndex];
        if (!target || !target.active) return prev;

        const delta = Math.random() > 0.5 ? 1 : -1;
        const newYes = Math.max(5, Math.min(95, target.price_yes + delta));
        const newNo = 100 - newYes;

        const next = [...prev];
        next[targetIndex] = {
          ...target,
          price_yes: newYes,
          price_no: newNo,
        };
        return next;
      });
    }, 4000);

    const connect = () => {
      if (isCleanedUp || !wsTarget) return;
      try {
        ws = isGraphqlWs ? new WebSocket(wsTarget, "graphql-ws") : new WebSocket(wsTarget);

        ws.onopen = () => {
          if (isGraphqlWs) {
            // Hasura GraphQL-WS protocol handshake
            ws?.send(JSON.stringify({ type: "connection_init", payload: {} }));
          } else {
            setWsConnected(true);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!isCleanedUp) reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);

            // Handle GraphQL-WS protocol
            if (msg.type === "connection_ack") {
              setWsConnected(true);
              // Subscribe to live binary markets on Somnia
              ws?.send(
                JSON.stringify({
                  id: "sub-somnia-markets",
                  type: "start",
                  payload: {
                    query:
                      'subscription { Market(where: { marketType: { _eq: "BINARY" } }, limit: 100, order_by: { createdAtTimestamp: desc }) { id marketId clobStatus lastPrice cumulativeQuoteVolume } }',
                  },
                })
              );
              return;
            }

            if (msg.type === "data" && msg.payload?.data?.Market) {
              const liveUpdates: any[] = msg.payload.data.Market;
              const updatesMap = new Map<string, any>();
              for (const up of liveUpdates) {
                if (up.id) updatesMap.set(up.id.toLowerCase(), up);
                if (up.marketId) updatesMap.set(up.marketId.toLowerCase(), up);
              }

              setMarkets((prev) => {
                if (!prev || prev.length === 0) return prev;
                let changed = false;
                const next = prev.map((m) => {
                  const key = (m.marketId || m.id || "").toLowerCase();
                  const update = updatesMap.get(key);
                  if (!update) return m;

                  let priceYes = m.price_yes;
                  let priceNo = m.price_no;
                  if (update.lastPrice) {
                    const p = Math.round((Number(update.lastPrice) / 1e18) * 100);
                    priceYes = Math.max(1, Math.min(99, p));
                    priceNo = 100 - priceYes;
                  }
                  const isTrading = update.clobStatus === "Trading";
                  const vol = update.cumulativeQuoteVolume ? Number(update.cumulativeQuoteVolume) / 1e6 : m.volume;

                  if (priceYes !== m.price_yes || isTrading !== m.active || vol !== m.volume) {
                    changed = true;
                    return {
                      ...m,
                      price_yes: priceYes,
                      price_no: priceNo,
                      active: isTrading,
                      closed: !isTrading,
                      volume: vol,
                    };
                  }
                  return m;
                });
                return changed ? next : prev;
              });
              return;
            }

            // Fallback generic price update format
            if (msg.type === "price_update" && msg.ticker) {
              setMarkets((prev) =>
                prev.map((m) =>
                  m.ticker === msg.ticker
                    ? { ...m, price_yes: msg.price_yes, price_no: 100 - msg.price_yes }
                    : m
                )
              );
            }
          } catch {}
        };
      } catch {
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      isCleanedUp = true;
      clearInterval(simulatedTickInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [setMarkets]);

  return { wsConnected };
}
