import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { API_BASE_URL } from "../config/api";
import styles from "./PriceChart.module.css";

interface PricePoint {
  price_yes: number;
  price_no: number;
  volume: number;
  timestamp: number;
}

interface MarketData {
  ticker: string;
  name: string;
  color: string;
  currentPrice: number;
  history: PricePoint[];
}

interface PriceChartProps {
  ticker?: string;
  currentPrice?: number;
  markets?: { ticker: string; name: string; currentPrice: number; tokenId?: string; marketId?: string; color?: string }[];
  volume?: number;
}

type TimeRange = "1m" | "1D" | "1W" | "1M" | "ALL";

const TIME_RANGES: { label: TimeRange; ms: number }[] = [
  { label: "1m", ms: 60 * 1000 },
  { label: "1D", ms: 24 * 60 * 60 * 1000 },
  { label: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "ALL", ms: Infinity },
];

const formatPrice = (value: number) => {
  if (!Number.isFinite(value)) return "0¢";
  return Number.isInteger(value) ? `${value}¢` : `${value.toFixed(1)}¢`;
};

// Premium color palette with gradient support
const OUTCOME_COLORS = [
  { stroke: "#5eae8b", gradient: ["#5eae8b", "#5eae8b00"] }, // Mint green (Up/Yes)
  { stroke: "#ef4444", gradient: ["#ef4444", "#ef444400"] }, // Red (Down/No)
  { stroke: "#3b82f6", gradient: ["#3b82f6", "#3b82f600"] }, // Blue
  { stroke: "#f59e0b", gradient: ["#f59e0b", "#f59e0b00"] }, // Amber
  { stroke: "#a855f7", gradient: ["#a855f7", "#a855f700"] }, // Purple
  { stroke: "#14b8a6", gradient: ["#14b8a6", "#14b8a600"] }, // Teal
];

// Custom tooltip with glassmorphism
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className={styles.tooltipRow}>
          <span
            className={styles.tooltipDot}
            style={{ background: entry.color }}
          />
          <span className={styles.tooltipName}>{entry.name}</span>
          <span className={styles.tooltipValue}>{formatPrice(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// Custom cursor component with vertical line
const CustomCursor = ({ points, height }: { points?: Array<{ x: number; y: number }>; height?: number }) => {
  if (!points?.length) return null;
  const { x } = points[0];

  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={height}
      stroke="var(--primary)"
      strokeWidth={1}
      strokeDasharray="4 4"
      strokeOpacity={0.5}
    />
  );
};

// Custom active dot with glow effect
const CustomActiveDot = ({
  cx,
  cy,
  fill,
}: {
  cx?: number;
  cy?: number;
  fill?: string;
}) => {
  if (cx === undefined || cy === undefined) return null;

  return (
    <g>
      {/* Outer glow */}
      <circle cx={cx} cy={cy} r={12} fill={fill} opacity={0.15} />
      {/* Middle ring */}
      <circle cx={cx} cy={cy} r={8} fill={fill} opacity={0.3} />
      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={4} fill={fill} stroke="#fff" strokeWidth={2} />
    </g>
  );
};

const PriceChart: React.FC<PriceChartProps> = ({
  ticker,
  currentPrice = 50,
  markets = [],
  volume = 0,
}) => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("ALL");
  const [hoveredData, setHoveredData] = useState<{
    date: string;
    values: { name: string; value: number; color: string }[];
  } | null>(null);

  // Build stable ticker key for memoization
  const marketTickerKey = markets
    .map((m) => `${m.ticker}:${m.marketId || ""}`)
    .join(",");

  // Keep refs for live prices so historical fetch doesn't re-trigger on price ticks
  const latestMarketsRef = React.useRef(markets);
  latestMarketsRef.current = markets;
  const latestPriceRef = React.useRef(currentPrice);
  latestPriceRef.current = currentPrice;

  // Build list of markets to fetch - STABLE based on tickers only
  const marketsToFetch = useMemo(() => {
    if (markets.length > 0) {
      return markets.slice(0, 4).map((m, i) => ({
        ticker: m.ticker,
        name: m.name,
        color: m.color || OUTCOME_COLORS[i % OUTCOME_COLORS.length].stroke,
        gradientId: `gradient-${i}`,
        tokenId: m.tokenId,
        marketId: m.marketId,
      }));
    }
    if (ticker) {
      return [
        {
          ticker: `${ticker}-yes`,
          name: "Up (Yes)",
          color: "#5eae8b",
          gradientId: "gradient-0",
          tokenId: undefined as string | undefined,
          marketId: undefined as string | undefined,
        },
        {
          ticker: `${ticker}-no`,
          name: "Down (No)",
          color: "#ef4444",
          gradientId: "gradient-1",
          tokenId: undefined as string | undefined,
          marketId: undefined as string | undefined,
        },
      ];
    }
    return [];
  }, [marketTickerKey, ticker]);

  const activeMarkets = useMemo(() => {
    const base = marketsToFetch.length > 0
      ? marketsToFetch
      : [
          {
            ticker: ticker ? `${ticker}-yes` : "default",
            name: "Up (Yes)",
            color: "#5eae8b",
            gradientId: "gradient-0",
          },
        ];

    return base.map((m) => {
      const liveMarket = markets.find((pm) => pm.ticker === m.ticker);
      const livePrice = liveMarket
        ? liveMarket.currentPrice
        : m.ticker.endsWith("-no")
        ? 100 - currentPrice
        : currentPrice;
      return { ...m, currentPrice: livePrice };
    });
  }, [marketsToFetch, markets, currentPrice, ticker]);

  // Fetch price history for all markets ONCE per market configuration
  useEffect(() => {
    if (marketsToFetch.length === 0) {
      setLoading(false);
      return;
    }

    let isCancelled = false;

    // Only show skeleton on first load if we don't have any data yet
    setMarketData((prev) => {
      const prevKeys = prev.map((p) => p.ticker).sort().join(",");
      const nextKeys = marketsToFetch.map((m) => m.ticker).sort().join(",");
      if (prevKeys !== nextKeys) {
        setLoading(true);
      }
      return prev;
    });

    const currentMarkets = latestMarketsRef.current;
    const currentBasePrice = latestPriceRef.current;

    // Fetch real candle history from the DreamDEX indexer
    const fetchSingleMarket = async (m: (typeof marketsToFetch)[0], targetPrice: number): Promise<MarketData> => {
      const clamped = Math.max(1, Math.min(99, targetPrice));
      const seedHistory: PricePoint[] = [
        {
          price_yes: clamped,
          price_no: Number((100 - clamped).toFixed(2)),
          volume: 0,
          timestamp: Date.now(),
        },
      ];

      try {
        if (m.marketId) {
          const res = await fetch(
            `${API_BASE_URL}/api/timeseries?marketId=${encodeURIComponent(m.marketId)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.history && data.history.length > 0) {
              const history = data.history.map((point: any) => ({
                price_yes: Number(((point.p || 0) * 100).toFixed(2)),
                price_no: Number(((1 - (point.p || 0)) * 100).toFixed(2)),
                volume: 0,
                timestamp: (point.t || 0) * 1000,
              }));
              return { ...m, history, currentPrice: targetPrice };
            }
          }
        }
      } catch {}

      return { ...m, history: seedHistory, currentPrice: targetPrice };
    };

    const isBinary =
      marketsToFetch.length === 2 &&
      ((marketsToFetch[0].name.toLowerCase().includes("up") &&
        marketsToFetch[1].name.toLowerCase().includes("down")) ||
        (marketsToFetch[0].ticker.endsWith("-yes") &&
          marketsToFetch[1].ticker.endsWith("-no")));

    if (isBinary) {
      const mUp = marketsToFetch[0];
      const mDown = marketsToFetch[1];
      const upPrice = currentMarkets.find((pm) => pm.ticker === mUp.ticker)?.currentPrice ?? currentBasePrice;
      const downPrice = currentMarkets.find((pm) => pm.ticker === mDown.ticker)?.currentPrice ?? (100 - upPrice);

      fetchSingleMarket(mUp, upPrice).then((upResult) => {
        if (isCancelled) return;
        const downHistory: PricePoint[] = upResult.history.map((pt) => ({
          price_yes: Number((100 - pt.price_yes).toFixed(2)),
          price_no: Number(pt.price_yes.toFixed(2)),
          volume: pt.volume,
          timestamp: pt.timestamp,
        }));

        setMarketData([
          upResult,
          {
            ...mDown,
            history: downHistory,
            currentPrice: downPrice,
          },
        ]);
        setLoading(false);
      });
      return () => {
        isCancelled = true;
      };
    }

    Promise.all(
      marketsToFetch.map((m) => {
        const livePrice = currentMarkets.find((pm) => pm.ticker === m.ticker)?.currentPrice ?? currentBasePrice;
        return fetchSingleMarket(m, livePrice);
      })
    ).then((results) => {
      if (isCancelled) return;
      setMarketData(results);
      setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [marketTickerKey, marketsToFetch]);

  // Real-time: Append live price points when markets prop updates without reloading
  useEffect(() => {
    if (marketData.length === 0) return;

    setMarketData((prev) => {
      if (prev.length === 0) return prev;

      const isBinaryPair =
        prev.length === 2 &&
        ((prev[0].name.toLowerCase().includes("up") &&
          prev[1].name.toLowerCase().includes("down")) ||
          (prev[0].ticker.endsWith("-yes") &&
            prev[1].ticker.endsWith("-no")));

      const upLive = markets.find((p) => p.ticker === prev[0]?.ticker);
      const newUpPrice = upLive ? upLive.currentPrice : (prev[0]?.ticker === ticker ? currentPrice : null);

      let hasChange = false;
      const updated = prev.map((m, idx) => {
        let newPrice: number | null = null;
        if (isBinaryPair && idx === 1) {
          const downLive = markets.find((p) => p.ticker === m.ticker);
          newPrice = downLive ? downLive.currentPrice : (newUpPrice !== null ? 100 - newUpPrice : null);
        } else {
          const liveMarket = markets.find((p) => p.ticker === m.ticker);
          newPrice = liveMarket ? liveMarket.currentPrice : (m.ticker === ticker ? currentPrice : null);
        }

        if (newPrice !== null && Number.isFinite(newPrice) && newPrice !== m.currentPrice) {
          hasChange = true;
          const newPoint: PricePoint = {
            price_yes: newPrice,
            price_no: 100 - newPrice,
            volume: 0,
            timestamp: Date.now(),
          };

          const newHistory = [...m.history, newPoint].slice(-200);

          return {
            ...m,
            currentPrice: newPrice,
            history: newHistory,
          };
        }
        return m;
      });

      return hasChange ? updated : prev;
    });
  }, [markets, currentPrice, ticker]);

  // Format date labels
  const formatDateLabel = useCallback(
    (timestamp: number, timeRange: TimeRange): string => {
      const date = new Date(timestamp);
      if (timeRange === "1m") {
        return date.toLocaleTimeString([], {
          minute: "2-digit",
          second: "2-digit",
        });
      }
      if (timeRange === "1D") {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    },
    []
  );

  // Build chart data
  const { chartData, yMin, yMax, historyNote } = useMemo(() => {
    const rangeConfig = TIME_RANGES.find((r) => r.label === range);
    const cutoffMs =
      rangeConfig?.ms === Infinity ? 0 : Date.now() - (rangeConfig?.ms || 0);

    // Collect all unique timestamps
    const allTimestamps = new Set<number>();
    marketData.forEach((m) => {
      m.history
        .filter((p) => p.timestamp >= cutoffMs)
        .forEach((p) => allTimestamps.add(p.timestamp));
    });

    if (allTimestamps.size === 0) {
      return {
        chartData: [],
        yMin: 0,
        yMax: 100,
        historyNote: "",
      };
    }

    // Sort and sample timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
    const maxPoints = 800; // Resolution cap
    const step = Math.max(1, Math.floor(sortedTimestamps.length / maxPoints));
    
    // For high resolution, we sample but keep enough points to show "squiggliness"
    const sampledTimestamps = sortedTimestamps.filter((_, i) => {
      // Always keep the last 200 points for real-time fidelity
      const isRecent = i > sortedTimestamps.length - 200;
      return isRecent || (i % step === 0);
    });

    const filteredMarketData = marketData.map((m) => ({
      ...m,
      filteredHistory: m.history
        .filter((p) => p.timestamp >= cutoffMs)
        .sort((a, b) => a.timestamp - b.timestamp),
    }));

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    const pointers = new Map<string, number>();
    const lastSeenPrices = new Map<string, number>();

    const data = sampledTimestamps.map((timestamp) => {
      const point: Record<string, number | string | null> = {
        date: formatDateLabel(timestamp, range),
        timestamp,
      };

      filteredMarketData.forEach((m) => {
        const currentPointer = pointers.get(m.ticker) ?? 0;
        let nextPointer = currentPointer;

        while (
          nextPointer < m.filteredHistory.length &&
          m.filteredHistory[nextPointer].timestamp <= timestamp
        ) {
          lastSeenPrices.set(m.ticker, m.filteredHistory[nextPointer].price_yes);
          nextPointer += 1;
        }

        pointers.set(m.ticker, nextPointer);

        const price = lastSeenPrices.get(m.ticker);
        point[m.name] = price ?? null;

        if (price !== undefined) {
          if (price < minPrice) minPrice = price;
          if (price > maxPrice) maxPrice = price;
        }
      });

      return point;
    });

    if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
      minPrice = 0;
      maxPrice = 100;
    }

    const uniquePriceCount = new Set(
      filteredMarketData.flatMap((m) =>
        m.filteredHistory.map((point) => point.price_yes.toFixed(2))
      )
    ).size;

    const priceRange = maxPrice - minPrice;
    const padding = Math.max(priceRange * 0.15, 3);

    return {
      chartData: data,
      yMin: Math.max(0, Number((minPrice - padding).toFixed(1))),
      yMax: Math.min(100, Number((maxPrice + padding).toFixed(1))),
      historyNote:
        uniquePriceCount <= 1
          ? "Limited source history for this market."
          : "",
    };
  }, [marketData, range, activeMarkets, formatDateLabel]);

  const formatVolume = (v: number) => {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${Math.round(v / 1000)}K`;
    return `$${v}`;
  };

  // Handle tooltip data for legend update
  const handleMouseMove = useCallback(
    (data: { activePayload?: Array<{ name: string; value: number; color: string }>; activeLabel?: string }) => {
      if (data.activePayload?.length) {
        setHoveredData({
          date: data.activeLabel || "",
          values: data.activePayload.map((p) => ({
            name: p.name,
            value: p.value,
            color: p.color,
          })),
        });
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredData(null);
  }, []);

  if (loading && marketData.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Legend with live values on hover */}
      {activeMarkets.length > 0 && (
        <div className={styles.legend}>
          {hoveredData && (
            <span className={styles.legendDate}>{hoveredData.date}</span>
          )}
          {activeMarkets.map((m) => {
            const hoveredValue = hoveredData?.values.find(
              (v) => v.name === m.name
            );
            return (
              <div key={m.name} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: m.color }} />
                <span className={styles.legendName} style={{ color: m.color }}>
                  {m.name}
                </span>
                <span className={styles.legendPercent}>
                  {hoveredValue ? formatPrice(hoveredValue.value) : formatPrice(m.currentPrice)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Premium Chart */}
      <div className={styles.chartWrapper}>
        <div className={styles.chartWatermark}>NOUR</div>
        {chartData.length === 0 ? (
          <div className={styles.emptyState}>No price history available.</div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 40, left: 0, bottom: 0 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid reference line at 50% */}
            <ReferenceLine
              y={50}
              stroke="var(--border)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />

            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              dy={10}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              domain={[yMin, yMax]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(value) => formatPrice(Number(value))}
              orientation="right"
              dx={10}
              width={45}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={<CustomCursor />}
              isAnimationActive={false}
            />

            {/* Smooth snake-like lines with glow */}
            {activeMarkets.map((m) => (
              <Line
                key={m.name}
                type="monotone"
                dataKey={m.name}
                stroke={m.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={<CustomActiveDot fill={m.color} />}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Footer: Volume + Time Range */}
      <div className={styles.footer}>
        <div className={styles.volume}>
          <span className={styles.volumeValue}>{formatVolume(volume)}</span>
          <span className={styles.volumeLabel}>vol</span>
          {historyNote && <span className={styles.historyNote}>{historyNote}</span>}
        </div>

        <div className={styles.timeRangeTabs}>
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              className={`${styles.rangeTab} ${range === r.label ? styles.active : ""}`}
              onClick={() => setRange(r.label)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PriceChart;
