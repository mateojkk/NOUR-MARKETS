import { useState, useRef, useEffect, type FC } from "react";
import { Mail, Loader2, ArrowRight, Wallet, ArrowLeft, ShieldCheck } from "lucide-react";
import { useEvmWallet } from "../contexts/EvmWalletContext";
import nourLogo from "../assets/logo nour .png";
import heroImage from "../assets/picture.png";

const OTP_LENGTH = 6;

const LoginPage: FC = () => {
  const {
    connectInjected,
    connecting,
    emailOtpError,
    startEmailLogin,
    verifyEmailOtp,
    cancelEmailLogin,
  } = useEvmWallet();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginMode, setLoginMode] = useState<"choose" | "email" | "otp">("choose");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Show inline Magic errors (invalid / expired / too many attempts)
  useEffect(() => {
    if (emailOtpError) setLoginError(emailOtpError);
  }, [emailOtpError]);

  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail.trim() || sendingCode) return;
    setLoginError("");
    setSendingCode(true);
    try {
      await startEmailLogin(loginEmail.trim());
      setOtp(Array(OTP_LENGTH).fill(""));
      setLoginMode("otp");
    } catch (err: any) {
      console.error("Email login error:", err);
      setLoginError(err.message || "Failed to send the login code");
    } finally {
      setSendingCode(false);
    }
  };

  const submitOtp = async (code: string) => {
    if (verifyingCode || code.length !== OTP_LENGTH) return;
    setLoginError("");
    setVerifyingCode(true);
    try {
      // On success the wallet connects and App.tsx swaps to the main UI.
      await verifyEmailOtp(code);
    } catch (err: any) {
      setLoginError(err.message || "Invalid code. Please try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      otpInputRefs.current[0]?.focus();
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleOtpChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 1) {
      // Paste (or multi-char input): distribute across boxes from the start
      const next = Array(OTP_LENGTH).fill("");
      digits.split("").slice(0, OTP_LENGTH).forEach((d, i) => { next[i] = d; });
      setOtp(next);
      otpInputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
      if (digits.length >= OTP_LENGTH) submitOtp(next.join(""));
      return;
    }
    const next = [...otp];
    next[index] = digits;
    setOtp(next);
    if (digits && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
    if (next.join("").length === OTP_LENGTH) submitOtp(next.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
      otpInputRefs.current[index - 1]?.focus();
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

  const backToEmail = () => {
    cancelEmailLogin();
    setLoginError("");
    setOtp(Array(OTP_LENGTH).fill(""));
    setLoginMode("email");
  };

  const backToChoose = () => {
    cancelEmailLogin();
    setLoginError("");
    setLoginMode("choose");
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
                disabled={connecting || sendingCode || verifyingCode}
              >
                <div className="login-option-icon">
                  <Mail size={20} />
                </div>
                <div className="login-option-text">
                  <strong>Continue with Email</strong>
                  <span>6-digit code email authentication</span>
                </div>
                <ArrowRight size={16} className="login-option-arrow" />
              </button>

              <button
                className="login-option"
                onClick={handleInjectedLogin}
                disabled={connecting || sendingCode || verifyingCode}
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
                onClick={backToChoose}
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
                disabled={sendingCode}
              />
              <button
                type="submit"
                className="login-submit-btn"
                disabled={sendingCode || !loginEmail.trim()}
              >
                {sendingCode ? (
                  <>
                    <Loader2 size={16} className="spin" /> Sending Code...
                  </>
                ) : (
                  "Send Code"
                )}
              </button>
            </form>
          )}

          {/* OTP code form (custom in-app UI — no Magic widget) */}
          {loginMode === "otp" && (
            <div className="login-email-form">
              <button
                type="button"
                className="login-back-btn"
                onClick={backToEmail}
                disabled={verifyingCode}
              >
                <ArrowLeft size={16} /> Back
              </button>
              <div className="login-heading" style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", margin: 0 }}>
                  <ShieldCheck size={20} style={{ color: "var(--primary)" }} /> check your email
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "6px" }}>
                  we sent a {OTP_LENGTH}-digit code to <strong>{loginEmail}</strong>
                </p>
              </div>
              <div className="login-otp-row">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    aria-label={`Digit ${i + 1}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className={`login-otp-box${loginError ? " login-otp-box-error" : ""}`}
                    autoFocus={i === 0}
                    disabled={verifyingCode}
                  />
                ))}
              </div>
              <button
                type="button"
                className="login-submit-btn"
                onClick={() => submitOtp(otp.join(""))}
                disabled={verifyingCode || otp.join("").length !== OTP_LENGTH}
              >
                {verifyingCode ? (
                  <>
                    <Loader2 size={16} className="spin" /> Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </button>
              <button
                type="button"
                className="login-resend-btn"
                onClick={handleEmailLogin}
                disabled={sendingCode || verifyingCode}
              >
                {sendingCode ? "sending..." : "didn't receive it? resend code"}
              </button>
            </div>
          )}

          {loginError && <p className="login-error">{loginError}</p>}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
