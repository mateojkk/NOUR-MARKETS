import React from "react";
import nourLogo from "../assets/logo nour .png";

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <img src={nourLogo} alt="nour" className="footer-logo" />
          <p className="footer-tagline">
            A simplified prediction markets platform for crypto and culture markets.
          </p>
        </div>
        
        <div className="footer-links">
          <div className="footer-link-group">
            <h4>Platform</h4>
            <a href="/">Markets</a>
            <a href="/portfolio">Portfolio</a>
          </div>
          
          <div className="footer-link-group">
            <h4>Social</h4>
            <a href="https://x.com/trynour" target="_blank" rel="noopener noreferrer">Twitter / X</a>
            <a href="https://t.me/nourterminal" target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://docs.nour.sh" target="_blank" rel="noopener noreferrer">Documentation</a>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="footer-copyright">
          © {new Date().getFullYear()} Nour. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
