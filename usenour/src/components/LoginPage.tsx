import { useState, type FC } from "react";
import { Mail, Loader2, ArrowRight, Wallet, ArrowLeft } from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import nourLogo from "../assets/logo nour .png";
import heroImage from "../assets/picture.png";

const LoginPage: FC = () => {
  const { connect, connectInjected, connecting } = useEvmWallet();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginMode, setLoginMode] = useState<"choose" | "email">("choose");

  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim()) return;
    setLoginError("");
    try {
      await connect(loginEmail.trim());
    } catch (err: any) {
      console.error("Email login error:", err);
      setLoginError(err.message || "Login failed");
    }
  };

  const handleInjectedLogin = async () => {
    setLoginError("");
    try {
      await connectInjected();
    } catch (err: any) {
      if (err?.message?.includes("ProviderNotFoundError") || (typeof window !== "undefined" && !(window as any).ethereum)) {
        setLoginError("No browser wallet found. Please install MetaMask or Rabby.");
      } else {
        setLoginError(err.message || "Wallet connection failed");
      }
    }
  };

  return (
    <div className="login-page">
      {/* Left: image */}
      <div className="login-brand">
        <img className="login-media" src={heroImage} alt="NOUR" />
      </div>

      {/* Right: login form */}
      <div className="login-form-side">
        <div className="login-form-wrapper">
          {/* Top: logo + heading */}
          <div className="login-form-top">
            <img src={nourLogo} alt="NOUR" className="login-form-logo" />
            <div className="login-heading">
              <h2>Welcome to Nour</h2>
              <p style={{ color: "var(--text-secondary, #888)", fontSize: "14px", marginTop: "4px" }}>
                Prediction markets on Somnia & DreamDEX
              </p>
            </div>
          </div>

          {/* Auth options */}
          {loginMode === "choose" && (
            <div className="login-options">
              <button
                className="login-option"
                onClick={() => setLoginMode("email")}
                disabled={connecting}
              >
                <div className="login-option-icon">
                  <Mail size={20} />
                </div>
                <div className="login-option-text">
                  <strong>Continue with Email</strong>
                  <span>Magic link email authentication</span>
                </div>
                <ArrowRight size={16} className="login-option-arrow" />
              </button>

              <button
                className="login-option"
                onClick={handleInjectedLogin}
                disabled={connecting}
              >
                <div className="login-option-icon" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818cf8" }}>
                  <Wallet size={20} />
                </div>
                <div className="login-option-text">
                  <strong>Connect Browser Wallet</strong>
                  <span>MetaMask, Rabby, or browser wallet</span>
                </div>
                {connecting ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} className="login-option-arrow" />}
              </button>
            </div>
          )}

          {/* Email form */}
          {loginMode === "email" && (
            <form onSubmit={handleEmailLogin} className="login-email-form">
              <button
                type="button"
                className="login-back-btn"
                onClick={() => setLoginMode("choose")}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <label className="login-label">Email address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="login-email-input"
                autoFocus
                disabled={connecting}
              />
              <button
                type="submit"
                className="login-submit-btn"
                disabled={connecting || !loginEmail.trim()}
              >
                {connecting ? (
                  <>
                    <Loader2 size={16} className="spin" /> Sending Link...
                  </>
                ) : (
                  "Send Magic Link"
                )}
              </button>
            </form>
          )}

          {loginError && <p className="login-error">{loginError}</p>}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
