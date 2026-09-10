import React from "react";
import { Home, Briefcase, Search, Droplets } from "lucide-react";
import "../styles/bottom-nav.css";

interface BottomNavProps {
  activeTab: "markets" | "portfolio" | "faucet" | "settings";
  onTabChange: (tab: "markets" | "portfolio" | "faucet" | "settings") => void;
  onSearch: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, onSearch }) => {
  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-item ${activeTab === "markets" ? "active" : ""}`}
        onClick={() => onTabChange("markets")}
      >
        <Home size={20} />
        <span>Home</span>
      </button>
      
      <button
        className={`bottom-nav-item ${activeTab === "portfolio" ? "active" : ""}`}
        onClick={() => onTabChange("portfolio")}
      >
        <Briefcase size={20} />
        <span>Portfolio</span>
      </button>

      <button
        className={`bottom-nav-item ${activeTab === "faucet" ? "active" : ""}`}
        onClick={() => onTabChange("faucet")}
      >
        <Droplets size={20} />
        <span>Faucet</span>
      </button>
      
      <button
        className="bottom-nav-item"
        onClick={onSearch}
      >
        <Search size={20} />
        <span>Search</span>
      </button>
    </nav>
  );
};

export default BottomNav;

