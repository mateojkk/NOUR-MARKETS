import React from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import styles from "./SearchPage.module.css";
import type { MarketGroup } from "../types";
import { formatMarketTitle, resolveMarketIcon } from "../types";

interface SearchPageProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onClose: () => void;
  filteredGroups: MarketGroup[];
  onMarketClick: (group: MarketGroup) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({
  searchTerm,
  setSearchTerm,
  onClose,
  filteredGroups,
  onMarketClick,
}) => {
  const handleClear = () => {
    setSearchTerm("");
  };

  return (
    <div className={styles.page}>
      {/* Back Button */}
      <button className={styles.backBtn} onClick={onClose}>
        <ArrowLeft size={16} />
        BACK
      </button>

      {/* Search Input */}
      <div className={styles.searchSection}>
        <div className={styles.searchInputWrapper}>
          <Search size={20} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search markets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          {searchTerm && (
            <button className={styles.clearBtn} onClick={handleClear}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchTerm && filteredGroups.length > 0 && (
        <>
          <p className={styles.resultCount}>
            {filteredGroups.length} result{filteredGroups.length !== 1 ? "s" : ""}
          </p>
          <div className={styles.results}>
            {filteredGroups.map((group) => (
              <button
                key={group.title}
                className={styles.resultItem}
                onClick={() => onMarketClick(group)}
              >
                <div className={styles.resultIcon}>
                  <img
                    src={(group as any).image || resolveMarketIcon(group.ticker, group.title)}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/icons/nour.png";
                    }}
                  />
                </div>
                <div className={styles.resultInfo}>
                  <span className={styles.resultTitle}>{formatMarketTitle(group.title)}</span>
                  <span className={styles.resultMeta}>
                    {group.markets.length} option{group.markets.length !== 1 ? "s" : ""} • ${Math.round(group.totalVolume / 1000)}K vol
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* No Results */}
      {searchTerm && filteredGroups.length === 0 && (
        <div className={styles.emptyState}>
          <Search size={48} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No markets found for "{searchTerm}"</p>
          <p className={styles.emptyHint}>Try a different search term</p>
        </div>
      )}

      {/* Empty State when no search */}
      {!searchTerm && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Start typing to search markets</p>
          <p className={styles.emptyHint}>Search by event title</p>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
