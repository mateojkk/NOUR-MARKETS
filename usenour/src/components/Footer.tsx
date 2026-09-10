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
