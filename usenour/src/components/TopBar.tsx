import React from "react";
import { Search, Moon, Sun } from "lucide-react";
import AuthButton from "./AuthButton";
import SearchPage from "./SearchPage";
import nourLogo from "../assets/logo nour .png";
import type { MarketGroup } from "../types";

interface TopBarProps {
  activeTab: "markets" | "portfolio" | "settings";
  setActiveTab: (tab: "markets" | "portfolio" | "settings") => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  wsConnected: boolean;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  onAuthClick?: () => void;
  showSearchPage: boolean;
  setShowSearchPage: (show: boolean) => void;
  filteredGroups: MarketGroup[];
  onMarketClick: (group: MarketGroup) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  searchTerm,
  setSearchTerm,
  wsConnected,
  theme,
  setTheme,
  onAuthClick,
  showSearchPage,
  setShowSearchPage,
  filteredGroups,
  onMarketClick
}) => {

  // Show SearchPage as full-page overlay on mobile
  if (showSearchPage) {
    return (
      <div className="search-page-overlay">
        <SearchPage
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onClose={() => setShowSearchPage(false)}
          filteredGroups={filteredGroups}
          onMarketClick={(group) => {
            onMarketClick(group);
            setShowSearchPage(false);
          }}
        />
      </div>
    );
  }

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <img src={nourLogo} alt="NOUR" className="logo-img" />
        
        <nav className="top-nav" style={{ display: "flex", gap: "4px" }}>
          <button
            className={`category-tab ${activeTab === "markets" ? "active" : ""}`}
            onClick={() => setActiveTab("markets")}
          >
            Home
          </button>
          <button
            className={`category-tab ${activeTab === "portfolio" ? "active" : ""}`}
            onClick={() => setActiveTab("portfolio")}
          >
            Portfolio
          </button>
        </nav>

        {wsConnected && (
          <span className="live-badge">
            Live
          </span>
        )}
      </div>

      <div className="top-bar-right">
        {/* Search icon button */}
        <button
          className="icon-btn"
          onClick={() => setShowSearchPage(true)}
          title="Search"
        >
          <Search size={16} />
        </button>

        <AuthButton onClick={onAuthClick} />

        {/* Theme toggle */}
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          title="Toggle theme"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
};

export default TopBar;

