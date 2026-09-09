import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useEvmWallet } from "./contexts/EvmWalletContext";
import LoginPage from "./components/LoginPage";
import ProfilePage from "./components/ProfilePage";
import Portfolio from "./components/Portfolio";
import Settings from "./components/Settings";
import TopBar from "./components/TopBar";

import BottomNav from "./components/BottomNav";
import MarketCard from "./components/MarketCard";
import TradePage from "./components/TradePage";
import ScrollToTop from "./components/ScrollToTop";
import { ToastContainer, useToast } from "./components/Toast";
import type { MarketGroup } from "./types";
import { resolveMarketIcon } from "./types";

import "./index.css";
import Dropdown from "./components/Dropdown";
import Footer from "./components/Footer";
import { useMarketData } from "./hooks/useMarketData";
import { useMarketWebSocket } from "./hooks/useMarketWebSocket";

function App() {
  const { toasts, addToast, removeToast } = useToast();
  const { connected } = useEvmWallet();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive activeTab from URL path
  const activeTab = location.pathname.startsWith("/portfolio") 
    ? "portfolio" 
    : "markets";
    
  // Settings drawer state
  const [showSettings, setShowSettings] = useState(false);
  // Search page state
  const [showSearchPage, setShowSearchPage] = useState(false);
  const [searchPageTerm, setSearchPageTerm] = useState("");
    
  const { markets, setMarkets, isLoading } = useMarketData();
  const { wsConnected } = useMarketWebSocket(markets, setMarkets);

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("nour-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("nour-watchlist");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [viewFilter, setViewFilter] = useState<"all" | "watchlist">("all");
  const [visibleCount, setVisibleCount] = useState(60);
  const [sortBy, setSortBy] = useState<"volume" | "newest" | "trending">("volume");

  useEffect(() => {
    localStorage.setItem("nour-theme", theme);
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("nour-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    setVisibleCount(60);
  }, [viewFilter, sortBy]);

  // --- Computed Market Groups ---
  const groupedMarkets = useMemo(() => {
    const groups: { [key: string]: MarketGroup } = {};
    markets.forEach((m) => {
      // Key by marketId or ticker to keep individual DreamDEX event contracts distinct
      const key = m.marketId || m.ticker || m.title.trim();
      if (!groups[key]) {
        groups[key] = { ticker: m.ticker, title: m.title.trim(), totalVolume: 0, markets: [], image: (m as any).image || resolveMarketIcon(m.asset, m.title) };
      }
      groups[key].markets.push(m);
      groups[key].totalVolume += m.volume;
      if (!groups[key].image && (m as any).image) {
        groups[key].image = (m as any).image;
      }
    });
    const groupList = Object.values(groups).map((g) => {
      g.markets.sort((a, b) => b.price_yes - a.price_yes);
      return g;
    });
    return groupList.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [markets]);

  const filteredGroups = useMemo(() => {
    let result = [...groupedMarkets];

    if (viewFilter === "watchlist") {
      result = result.filter((g) =>
        g.markets.some((m) => watchlist.includes(m.ticker))
      );
    }

    if (sortBy === "volume") {
      result.sort((a, b) => b.totalVolume - a.totalVolume);
    } else if (sortBy === "newest") {
      result.sort((a, b) => (b.markets[0]?.expiry || 0) - (a.markets[0]?.expiry || 0));
    }

    return result;
  }, [groupedMarkets, viewFilter, sortBy, watchlist]);

  // Search results for SearchPage
  const searchResults = useMemo(() => {
    if (!searchPageTerm.trim()) return groupedMarkets;
    const term = searchPageTerm.toLowerCase();
    return groupedMarkets.filter(
      (g) =>
        g.title.toLowerCase().includes(term) ||
        g.markets.some((m) => m.ticker.toLowerCase().includes(term))
    );
  }, [groupedMarkets, searchPageTerm]);

  const toggleWatchlist = (ticker: string) => {
    setWatchlist((prev) =>
      prev.includes(ticker) ? prev.filter((t) => t !== ticker) : [...prev, ticker]
    );
  };

  const handleTabChange = (tab: "markets" | "portfolio" | "settings") => {
    if (tab === "portfolio") navigate("/portfolio");
    else if (tab === "settings") setShowSettings(true);
    else navigate("/");
  };

  const handleMarketClick = (group: MarketGroup) => {
    navigate(`/trade/${encodeURIComponent(group.markets[0]?.ticker || group.title)}`, {
      state: { group },
    });
  };

  const handleAuthClick = () => {
    setShowSettings(true);
  };

  // Trade page route helper
  const tradePageElement = useMemo(() => {
    return (
      <TradePageWrapper
        groupedMarkets={groupedMarkets}
        onOrderComplete={(success, message) => {
          addToast(success ? "success" : "error", message);
        }}
      />
    );
  }, [groupedMarkets, addToast]);

  if (!connected) {
    return <LoginPage />;
  }

  return (
    <>
      <ScrollToTop />
      <div className="main-layout">
        <div className="content-area">
        <TopBar
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          searchTerm={searchPageTerm}
          setSearchTerm={setSearchPageTerm}
          wsConnected={wsConnected}
          theme={theme}
          setTheme={setTheme}
          onAuthClick={handleAuthClick}
          showSearchPage={showSearchPage}
          setShowSearchPage={setShowSearchPage}
          filteredGroups={searchResults}
          onMarketClick={handleMarketClick}
        />

        <main className="main-scroll">
          <Routes>
            <Route path="/" element={
              <>
                <div className="filter-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {filteredGroups.length} Somnia Markets
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <Dropdown
                      options={[
                        { value: "volume", label: "By Volume" },
                        { value: "newest", label: "Newest" },
                        { value: "trending", label: "Trending" },
                      ]}
                      value={sortBy}
                      onChange={(val) => setSortBy(val as any)}
                    />
                    <button
                      className={`sort-dropdown ${viewFilter === "watchlist" ? "active" : ""}`}
                      onClick={() => setViewFilter(viewFilter === "all" ? "watchlist" : "all")}
                      style={{
                        background: viewFilter === "watchlist" ? "var(--text)" : "",
                        color: viewFilter === "watchlist" ? "var(--bg)" : "",
                      }}
                    >
                      ★ Watchlist ({watchlist.length})
                    </button>
                  </div>
                </div>

                {isLoading && markets.length === 0 ? (
                  <div className="loading-center">
                    <div className="progress-bar-container">
                      <div className="progress-bar" />
                    </div>
                    <p className="loading-text">Loading Somnia markets...</p>
                  </div>
                ) : filteredGroups.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No markets found</h3>
                    <p>Try adjusting your filters or search term</p>
                  </div>
                ) : (
                  <>
                    <div className="market-grid">
                      {filteredGroups.slice(0, visibleCount).map((group) => (
                        <MarketCard
                          key={group.ticker || group.title}
                          group={group}
                          onClick={() => handleMarketClick(group)}
                          watchlist={watchlist}
                          onWatchlist={toggleWatchlist}
                        />
                      ))}
                    </div>
                    {visibleCount < filteredGroups.length && (
                      <button
                        onClick={() => setVisibleCount((prev) => prev + 60)}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '20px 0',
                          marginTop: 8,
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 13,
                          cursor: 'pointer',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        Show more · {filteredGroups.length - visibleCount} left
                      </button>
                    )}
                  </>
                )}
              </>
            } />
            
            <Route path="/trade/:ticker" element={tradePageElement} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </main>
      </div>

      {/* Settings Drawer */}
      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)} 
          theme={theme}
          setTheme={setTheme}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <BottomNav 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
        onSearch={() => {
          navigate("/");
          setShowSearchPage(true);
        }}
      />
      </div>
    </>
  );
}

// Wrapper for TradePage to retrieve group from state or find in groupedMarkets
function TradePageWrapper({
  groupedMarkets,
  onOrderComplete,
}: {
  groupedMarkets: MarketGroup[];
  onOrderComplete: (success: boolean, message: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const group: MarketGroup | undefined =
    location.state?.group ||
    groupedMarkets.find((g) =>
      location.pathname.includes(encodeURIComponent(g.markets[0]?.ticker || "")) ||
      location.pathname.includes(encodeURIComponent(g.title))
    ) ||
    groupedMarkets[0];

  if (!group || group.markets.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "60px 20px" }}>
        <h3>Market not found</h3>
        <button onClick={() => navigate("/")} className="btn-yes" style={{ marginTop: "16px" }}>
          Back to Markets
        </button>
      </div>
    );
  }

  return (
    <TradePage
      group={group}
      onBack={() => navigate("/")}
      onOrderComplete={onOrderComplete}
    />
  );
}

export default App;
