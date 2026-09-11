import { useState, useMemo, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useEvmWallet } from "./contexts/EvmWalletContext";
import LoginPage from "./components/LoginPage";
import ProfilePage from "./components/ProfilePage";
import Portfolio from "./components/Portfolio";
import FaucetPage from "./components/FaucetPage";
import Settings from "./components/Settings";
import TopBar from "./components/TopBar";
import nourLogo from "./assets/logo nour .png";

import BottomNav from "./components/BottomNav";
import MarketCard from "./components/MarketCard";
import TradePage from "./components/TradePage";
import ScrollToTop from "./components/ScrollToTop";
import { ToastContainer, useToast } from "./components/Toast";
import type { Market, MarketGroup } from "./types";
import { resolveMarketIcon } from "./types";

import "./index.css";
import Dropdown from "./components/Dropdown";
import Footer from "./components/Footer";
import { useMarketData } from "./hooks/useMarketData";
import { useMarketWebSocket } from "./hooks/useMarketWebSocket";

function App() {
  const { toasts, addToast, removeToast } = useToast();
  const { connected, restoring } = useEvmWallet();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive activeTab from URL path
  const activeTab = location.pathname.startsWith("/faucet")
    ? "faucet"
    : location.pathname.startsWith("/portfolio") 
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
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      metaTheme?.setAttribute("content", "#1c1c1c");
      metaColorScheme?.setAttribute("content", "only dark");
    } else {
      document.documentElement.classList.remove("dark");
      metaTheme?.setAttribute("content", "#efede3");
      metaColorScheme?.setAttribute("content", "only light");
    }
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
      // Live trading markets only — drop settled/locked windows from the grid
      // (covers both fresh feed data and markets that settle mid-session).
      if (m.closed || m.active === false) return;
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

  const handleTabChange = (tab: "markets" | "portfolio" | "faucet" | "settings") => {
    if (tab === "portfolio") navigate("/portfolio");
    else if (tab === "faucet") navigate("/faucet");
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
        markets={markets}
        isLoading={isLoading}
        onOrderComplete={(success, message) => {
          addToast(success ? "success" : "error", message);
        }}
      />
    );
  }, [groupedMarkets, markets, isLoading, addToast]);

  // While the previous session is being restored, show a branded splash
  // instead of the login form — the URL is untouched, so once the session
  // returns you land exactly where you were (portfolio/trade/etc).
  if (restoring && !connected) {
    return <SessionRestoringSplash />;
  }

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
            <Route path="/faucet" element={<FaucetPage />} />
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

// Wrapper for TradePage to retrieve group from state or find matching active market
function TradePageWrapper({
  groupedMarkets,
  markets,
  isLoading,
  onOrderComplete,
}: {
  groupedMarkets: MarketGroup[];
  markets: Market[];
  isLoading: boolean;
  onOrderComplete: (success: boolean, message: string) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { ticker: rawTicker } = useParams<{ ticker: string }>();

  const target = rawTicker ? decodeURIComponent(rawTicker).trim() : "";
  const targetLower = target.toLowerCase();
  const targetSuffix = target.split("-").pop()?.toLowerCase() || "";

  // 1. Group from location.state if provided (e.g. from MarketCard or Portfolio "Trade More")
  const stateGroup = location.state?.group as MarketGroup | undefined;

  // 2. Resolve matching market group
  const group = useMemo(() => {
    // If stateGroup is provided, verify it actually matches target (or no target specified)
    if (stateGroup && stateGroup.markets && stateGroup.markets.length > 0) {
      if (!target) return stateGroup;
      const stateMatches =
        stateGroup.markets.some((m) =>
          m.ticker.toLowerCase() === targetLower ||
          m.ticker.toLowerCase().includes(targetLower) ||
          targetLower.includes(m.ticker.toLowerCase()) ||
          (m.marketId && targetSuffix && m.marketId.toLowerCase().endsWith(targetSuffix))
        ) || stateGroup.title.toLowerCase() === targetLower;
      if (stateMatches) return stateGroup;
    }

    if (!target) return groupedMarkets[0];

    // Tier 1: Exact ticker match among active groups
    let found = groupedMarkets.find((g) =>
      g.markets.some((m) => m.ticker.toLowerCase() === targetLower) ||
      (g.ticker && g.ticker.toLowerCase() === targetLower)
    );
    if (found) return found;

    // Tier 2: Suffix or marketId match among active groups
    found = groupedMarkets.find((g) =>
      g.markets.some((m) => {
        if (m.marketId && m.marketId.toLowerCase() === targetLower) return true;
        if (targetSuffix && m.marketId && m.marketId.toLowerCase().endsWith(targetSuffix)) return true;
        const mSuffix = m.ticker.split("-").pop()?.toLowerCase();
        if (targetSuffix && mSuffix && targetSuffix === mSuffix) return true;
        return false;
      })
    );
    if (found) return found;

    // Tier 3: Title match among active groups
    found = groupedMarkets.find((g) =>
      g.title.toLowerCase() === targetLower ||
      g.markets.some((m) => m.title.toLowerCase() === targetLower)
    );
    if (found) return found;

    // Tier 4: Asset & Duration match among active groups (e.g. BTC-60M or BTC-5M)
    const asset = target.split("-")[0]?.toUpperCase();
    const duration = target.split("-")[1]?.toUpperCase();

    if (asset && asset.length >= 2) {
      if (duration) {
        found = groupedMarkets.find((g) =>
          g.markets.some((m) =>
            m.asset?.toUpperCase() === asset &&
            m.ticker.toUpperCase().includes(duration)
          )
        );
        if (found) return found;
      }

      // Tier 5: Any active market for the SAME asset (e.g. BTC -> active BTC market)
      found = groupedMarkets.find((g) =>
        g.markets.some((m) => m.asset?.toUpperCase() === asset)
      );
      if (found) return found;
    }

    // Tier 6: Look in ALL markets (including settled/finalized) so user can see their market
    const anyMarket = markets.find((m) => {
      if (m.ticker.toLowerCase() === targetLower) return true;
      if (m.marketId && m.marketId.toLowerCase() === targetLower) return true;
      if (targetSuffix && m.marketId && m.marketId.toLowerCase().endsWith(targetSuffix)) return true;
      const mSuffix = m.ticker.split("-").pop()?.toLowerCase();
      if (targetSuffix && mSuffix && targetSuffix === mSuffix) return true;
      if (m.title.toLowerCase() === targetLower) return true;
      return false;
    });

    if (anyMarket) {
      return {
        ticker: anyMarket.ticker,
        title: anyMarket.title.trim(),
        totalVolume: anyMarket.volume || 0,
        markets: [anyMarket],
        image: anyMarket.image || resolveMarketIcon(anyMarket.asset, anyMarket.title),
      };
    }

    // NEVER return groupedMarkets[0] if a target was specified! Returning undefined prevents opening the wrong market.
    return undefined;
  }, [stateGroup, target, targetLower, targetSuffix, groupedMarkets, markets]);

  if (isLoading && (!group || group.markets.length === 0)) {
    return (
      <div className="loading-center" style={{ padding: "80px 20px" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent, #10b981)", margin: "0 auto 12px" }} />
        <p className="loading-text">Loading market details...</p>
      </div>
    );
  }

  if (!group || group.markets.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "60px 20px" }}>
        <h3>Market not found</h3>
        <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
          This market may have expired or is not currently active.
        </p>
        <button onClick={() => navigate("/")} className="btn-yes" style={{ marginTop: "16px" }}>
          Explore Active Markets
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

// Full-screen branded splash shown while a previous session is being restored
// after a refresh — keeps the user's URL/page intact until they're back in.
function SessionRestoringSplash() {
  return (
    <div className="login-page">
      <div className="login-form-side">
        <div className="login-form-wrapper" style={{ textAlign: "center", alignItems: "center" }}>
          <div className="login-form-top">
            <img src={nourLogo} alt="NOUR" className="login-form-logo" />
            <div className="login-heading">
              <h2>Nour</h2>
              <p style={{ color: "var(--text-secondary, #888)", fontSize: "14px", marginTop: "4px" }}>
                Prediction markets on Somnia & DreamDEX
              </p>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text-muted)",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            <Loader2 size={18} className="spin" />
            <span>restoring your session…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
