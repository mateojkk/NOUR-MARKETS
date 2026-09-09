import React, { memo } from "react";
import { Plus } from "lucide-react";
import type { MarketGroup } from "../types";
import { formatVolume, formatMarketTitle, resolveMarketIcon } from "../types";

interface MarketCardProps {
  group: MarketGroup;
  onClick: () => void;
  watchlist: string[];
  onWatchlist: (ticker: string) => void;
}

const MarketCard: React.FC<MarketCardProps> = memo(({ group, onClick, watchlist, onWatchlist }) => {
  const ticker = group.markets[0]?.ticker;
  const isWatched = ticker ? watchlist.includes(ticker) : false;
  
  return (
    <div className="market-card" onClick={onClick}>
      <div className="card-top-row">
        <img
          src={group.image || resolveMarketIcon(group.ticker, group.title)}
          alt=""
          className="card-thumb"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/icons/nour.png";
          }}
        />
        <div className="card-info">
          <h3 className="card-title">{formatMarketTitle(group.title)}</h3>
          <div className="card-outcomes">
            {group.markets[0] && (() => {
              const m = group.markets[0];
              const yesLabel = (m as any).yes_sub_title || "Yes";
              const noLabel = (m as any).no_sub_title || "No";
              const hasMultipleMarkets = group.markets.length > 1;
              const isGeneric = yesLabel === "Yes" && noLabel === "No";
              const showOptionName = hasMultipleMarkets && !isGeneric;
            
              return (
                <div className="outcome-row">
                  {showOptionName && <span className="outcome-name">{yesLabel}</span>}
                  <div className="outcome-btns">
                    <button className="btn-yes">Yes {m.price_yes}¢</button>
                    <button className="btn-no">No {m.price_no}¢</button>
                  </div>
                </div>
              );
            })()}
            {group.markets.length > 1 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, opacity: 0.8 }}>
                +{group.markets.length - 1} more options →
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="footer-left">
          <span className="volume">{formatVolume(group.totalVolume)} Vol</span>
        </div>
        <button
          className={`watchlist-btn ${isWatched ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (ticker) onWatchlist(ticker);
          }}
        >
          {isWatched ? "✓" : <Plus size={14} />}
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Fast path: if group ticker/identity changed, re-render
  const prevGroupId = prevProps.group.ticker || prevProps.group.title;
  const nextGroupId = nextProps.group.ticker || nextProps.group.title;
  if (prevGroupId !== nextGroupId) return false;
  
  // Check basic group properties
  if (prevProps.group.totalVolume !== nextProps.group.totalVolume) return false;
  if (prevProps.group.markets.length !== nextProps.group.markets.length) return false;
  
  // Check watchlist status for first market ticker
  const prevTicker = prevProps.group.markets[0]?.ticker || "";
  const nextTicker = nextProps.group.markets[0]?.ticker || "";
  if (prevProps.watchlist.includes(prevTicker) !== nextProps.watchlist.includes(nextTicker)) {
    return false;
  }
  
  // Check prices for displayed markets (top 3)
  const prevMarkets = prevProps.group.markets.slice(0, 3);
  const nextMarkets = nextProps.group.markets.slice(0, 3);
  for (let i = 0; i < prevMarkets.length; i++) {
    if (prevMarkets[i]?.price_yes !== nextMarkets[i]?.price_yes ||
        prevMarkets[i]?.price_no !== nextMarkets[i]?.price_no) {
      return false;
    }
  }
  
  return true;
});

export default MarketCard;

