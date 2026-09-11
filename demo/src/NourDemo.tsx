import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Sequence,
  Easing,
} from "remotion";

// ─── Exact NOUR dark tokens (mirrors .dark in variables.css) ─────────────────
const BG        = "#1c1c1c";
const BG_ALT    = "#3a3936";
const BG_PANEL  = "#282725";
const BORDER    = "#4a4946";
const TEXT      = "#efede3";
const MUTED     = "#b5b3a9";
const LIGHT     = "#8a887e";
const PRIMARY   = "#afd9c6";   // mint
const DANGER    = "#ef4444";
const SUCCESS   = "#22c55e";
const WARNING   = "#f59e0b";
const YES_BG    = "rgba(175,217,198,0.12)";
const NO_BG     = "rgba(239,68,68,0.12)";
const TEXTINV   = "#302f2c";

const F = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'Inter', monospace";

// ─── Timing plan (90fps scene = 1 second) ───────────────────────────────────
// Total: 3000 frames = 100s @ 30fps
// Scene 1: 0–360    (0:00–0:12) Login page
// Scene 2: 360–630  (0:12–0:21) Email OTP flow
// Scene 3: 630–870  (0:21–0:29) Home feed + faucet tab hint
// Scene 4: 870–1110 (0:29–0:37) Faucet page – claim 1,000 tUSDC
// Scene 5: 1110–1590 (0:37–0:53) Trade page – full flow
// Scene 6: 1590–1920 (0:53–1:04) Portfolio – open positions
// Scene 7: 1920–2280 (1:04–1:16) Closed positions + Claim Payout
// Scene 8: 2280–2520 (1:16–1:24) Outro / closer

// ─── Utils ───────────────────────────────────────────────────────────────────
function fi(frame: number, s: number, e: number, from = 0, to = 1) {
  return interpolate(frame, [s, e], [from, to], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}
function fo(frame: number, s: number, e: number) {
  return interpolate(frame, [s, e], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
}
function sp(frame: number, from: number, fps: number, delay = 0, damping = 16, stiffness = 110) {
  return spring({ frame: frame - from - delay, fps, config: { damping, stiffness, mass: 0.8 } });
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

/** Exact NOUR top bar */
function TopBar({ activeTab, wsLive, frame, startF }: { activeTab: string; wsLive?: boolean; frame: number; startF: number }) {
  const op = fi(frame, startF, startF + 15);
  const tabs = ["Home", "Portfolio", "Faucet"];
  return (
    <div style={{
      opacity: op,
      position: "absolute", top: 0, left: 0, right: 0, height: 60,
      background: BG_PANEL,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", borderBottom: `1px solid ${BORDER}`, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <img src={staticFile("logo.png")} style={{ height: 26, objectFit: "contain" }} />
        <nav style={{ display: "flex", gap: 4 }}>
          {tabs.map((t) => (
            <button key={t} style={{
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: t === activeTab ? YES_BG : "transparent",
              color: t === activeTab ? PRIMARY : MUTED,
              fontFamily: F, fontSize: 13, fontWeight: t === activeTab ? 500 : 300,
              cursor: "pointer",
            }}>{t}</button>
          ))}
        </nav>
        {wsLive && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: YES_BG, border: `1px solid ${PRIMARY}`,
            borderRadius: 20, padding: "3px 10px",
            fontFamily: F, fontSize: 12, fontWeight: 500, color: PRIMARY,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIMARY, display: "inline-block" }} />
            Live
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button style={{
          padding: "7px 16px", borderRadius: 8, border: `1px solid ${BORDER}`,
          background: "transparent", color: TEXT, fontFamily: F, fontSize: 13, fontWeight: 300,
        }}>0x3f…d8E2</button>
      </div>
    </div>
  );
}

/** Exact NOUR bottom nav */
function BottomNav({ active, frame, startF }: { active: string; frame: number; startF: number }) {
  const op = fi(frame, startF, startF + 20);
  const items = [
    { label: "Home", icon: "⊞" },
    { label: "Search", icon: "⌕" },
    { label: "Portfolio", icon: "◈" },
    { label: "Faucet", icon: "⋮" },
  ];
  return (
    <div style={{
      opacity: op,
      position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
      background: BG_PANEL, borderTop: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", zIndex: 100,
    }}>
      {items.map((item) => (
        <div key={item.label} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          color: item.label === active ? PRIMARY : MUTED,
          fontFamily: F, fontSize: 11, fontWeight: item.label === active ? 500 : 300,
        }}>
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
}

/** Market card exactly as MarketCard.tsx renders */
function RealMarketCard({ title, yes, no, vol, frame, startF, delay = 0 }: {
  title: string; yes: number; no: number; vol: string;
  frame: number; startF: number; delay?: number;
}) {
  const s = sp(frame, startF, 30, delay);
  const op = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const ty = interpolate(s, [0, 1], [20, 0], { extrapolateRight: "clamp" });

  // Thin icon placeholder like the real app
  const ticker = title.startsWith("Will BTC") ? "₿" : title.startsWith("Will ETH") ? "Ξ" : "●";
  const iconBg = title.startsWith("Will BTC") ? "#f7931a" : title.startsWith("Will ETH") ? "#627eea" : "#5eae8b";

  return (
    <div style={{
      opacity: op, transform: `translateY(${ty}px)`,
      background: BG_PANEL, borderRadius: 12, padding: 18,
      cursor: "pointer",
    }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 10, background: iconBg,
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, color: "#fff",
        }}>{ticker}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.4, marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{
                padding: "6px 12px", borderRadius: 6, border: "none",
                background: YES_BG, color: PRIMARY,
                fontFamily: MONO, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>Yes {yes}¢</button>
              <button style={{
                padding: "6px 12px", borderRadius: 6, border: "none",
                background: NO_BG, color: DANGER,
                fontFamily: MONO, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>No {no}¢</button>
            </div>
          </div>
        </div>
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 12, borderTop: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: PRIMARY, fontWeight: 500 }}>{vol} Vol</span>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: BG_ALT,
          color: MUTED, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13,
        }}>+</div>
      </div>
    </div>
  );
}

// ─── SCENE 1: Login choose screen ────────────────────────────────────────────
function S1Login({ lf, fps }: { lf: number; fps: number }) {
  const pageOp = fi(lf, 0, 20);
  const formOp = fi(lf, 25, 50);
  const formY  = interpolate(sp(lf, 25, fps), [0,1], [30, 0], { extrapolateRight: "clamp" });
  const opt1Op = fi(lf, 60, 80);
  const opt2Op = fi(lf, 80, 100);

  return (
    <AbsoluteFill style={{ background: BG, opacity: pageOp }}>
      {/* Left hero image panel */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "50%",
        background: "#1a1916",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `
            radial-gradient(ellipse at 30% 50%, rgba(175,217,198,0.06) 0%, transparent 60%),
            linear-gradient(135deg, #1a1916 0%, #2a2724 100%)
          `,
        }} />
        <div style={{
          position: "relative", textAlign: "center", padding: 60,
        }}>
          <img src={staticFile("logo.png")} style={{ height: 56, objectFit: "contain", marginBottom: 32 }} />
          <div style={{ fontFamily: F, fontSize: 32, fontWeight: 300, color: TEXT, lineHeight: 1.3, marginBottom: 16 }}>
            Prediction markets<br />on <span style={{ color: PRIMARY }}>Somnia</span>
          </div>
          <div style={{ fontFamily: F, fontSize: 16, fontWeight: 300, color: MUTED }}>
            Trade binary event contracts<br />with sub-second execution
          </div>
        </div>
      </div>

      {/* Right: login form */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 80,
      }}>
        <div style={{ width: "100%", maxWidth: 420, opacity: formOp, transform: `translateY(${formY}px)` }}>
          <img src={staticFile("logo.png")} style={{ height: 32, objectFit: "contain", marginBottom: 32 }} />

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: F, fontSize: 28, fontWeight: 500, color: TEXT, margin: "0 0 8px 0" }}>
              Welcome to Nour
            </h2>
            <p style={{ fontFamily: F, fontSize: 14, fontWeight: 300, color: MUTED, margin: 0 }}>
              Prediction markets on Somnia &amp; DreamDEX
            </p>
          </div>

          {/* Login options – exactly as loginMode="choose" */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Email option */}
            <div style={{
              opacity: opt1Op,
              display: "flex", alignItems: "center", gap: 14,
              background: BG_PANEL, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "18px 20px", cursor: "pointer",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: YES_BG,
                color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>✉</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXT }}>Continue with Email</div>
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 300, color: MUTED, marginTop: 2 }}>6-digit code email authentication</div>
              </div>
              <span style={{ color: MUTED, fontSize: 18 }}>›</span>
            </div>

            {/* Wallet option */}
            <div style={{
              opacity: opt2Op,
              display: "flex", alignItems: "center", gap: 14,
              background: BG_PANEL, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: "18px 20px", cursor: "pointer",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: "rgba(99,102,241,0.15)",
                color: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>◈</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXT }}>Connect Browser Wallet</div>
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 300, color: MUTED, marginTop: 2 }}>MetaMask, Rabby, or browser wallet</div>
              </div>
              <span style={{ color: MUTED, fontSize: 18 }}>›</span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: Email OTP ───────────────────────────────────────────────────────
function S2Otp({ lf, fps }: { lf: number; fps: number }) {
  const emailOp = fi(lf, 0, 20);
  const emailY  = interpolate(sp(lf, 0, fps), [0,1], [20, 0], { extrapolateRight: "clamp" });
  const inputOp = fi(lf, 15, 35);
  const btnOp   = fi(lf, 30, 50);

  // OTP screen appears at frame 100
  const otpOp   = fi(lf, 100, 120);
  const otpY    = interpolate(sp(lf, 100, fps), [0,1], [20, 0], { extrapolateRight: "clamp" });
  const digits  = ["7","3","4","9","1","6"];

  return (
    <AbsoluteFill style={{ background: BG }}>
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "50%",
        background: "#1a1916",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ textAlign: "center", padding: 60, position: "relative" }}>
          <img src={staticFile("logo.png")} style={{ height: 56, marginBottom: 32, objectFit: "contain" }} />
          <div style={{ fontFamily: F, fontSize: 32, fontWeight: 300, color: TEXT, lineHeight: 1.3, marginBottom: 16 }}>
            Prediction markets<br />on <span style={{ color: PRIMARY }}>Somnia</span>
          </div>
          <div style={{ fontFamily: F, fontSize: 16, fontWeight: 300, color: MUTED }}>
            Trade binary event contracts<br />with sub-second execution
          </div>
        </div>
      </div>

      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "50%",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 80,
      }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <img src={staticFile("logo.png")} style={{ height: 32, objectFit: "contain", marginBottom: 32 }} />

          {/* Email step */}
          {lf < 100 && (
            <div style={{ opacity: emailOp, transform: `translateY(${emailY}px)` }}>
              <button style={{
                background: "none", border: "none", color: MUTED, fontFamily: F, fontSize: 13,
                marginBottom: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>‹ Back</button>
              <label style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: MUTED, display: "block", marginBottom: 8 }}>
                Email address
              </label>
              <div style={{ opacity: inputOp }}>
                <div style={{
                  background: BG_PANEL, border: `1px solid ${BORDER}`, borderRadius: 10,
                  padding: "14px 16px", marginBottom: 16,
                  fontFamily: MONO, fontSize: 16, color: TEXT,
                }}>
                  mateo@nourmarket.io
                </div>
              </div>
              <div style={{ opacity: btnOp }}>
                <div style={{
                  background: PRIMARY, borderRadius: 10, padding: "14px 0",
                  fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXTINV,
                  textAlign: "center", cursor: "pointer",
                }}>
                  Send Code
                </div>
              </div>
            </div>
          )}

          {/* OTP step */}
          {lf >= 100 && (
            <div style={{ opacity: otpOp, transform: `translateY(${otpY}px)` }}>
              <button style={{
                background: "none", border: "none", color: MUTED, fontFamily: F, fontSize: 13,
                marginBottom: 24, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              }}>‹ Back</button>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h2 style={{
                  fontFamily: F, fontSize: 22, fontWeight: 500, color: TEXT, margin: "0 0 8px 0",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <span style={{ color: PRIMARY }}>✓</span> check your email
                </h2>
                <p style={{ fontFamily: F, fontSize: 14, fontWeight: 300, color: MUTED, margin: 0 }}>
                  we sent a 6-digit code to <strong style={{ color: TEXT }}>mateo@nourmarket.io</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 24 }}>
                {digits.map((d, i) => {
                  const dOp = fi(lf, 110 + i * 8, 120 + i * 8);
                  return (
                    <div key={i} style={{
                      opacity: dOp,
                      width: 56, height: 60, borderRadius: 10,
                      background: BG_PANEL, border: `1.5px solid ${PRIMARY}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: MONO, fontSize: 24, fontWeight: 500, color: TEXT,
                    }}>{d}</div>
                  );
                })}
              </div>
              {lf > 160 && (
                <div style={{
                  opacity: fi(lf, 160, 175),
                  background: "rgba(175,217,198,0.1)", border: `1px solid ${PRIMARY}`,
                  borderRadius: 10, padding: "12px 16px", textAlign: "center",
                  fontFamily: F, fontSize: 14, fontWeight: 500, color: PRIMARY,
                }}>
                  ✓ Verified — connecting wallet…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: Home Feed ───────────────────────────────────────────────────────
function S3Home({ lf, fps }: { lf: number; fps: number }) {
  const markets = [
    { title: "Will ETH close UP at end of 15-Min Window?", yes: 64, no: 36, vol: "$12.4K" },
    { title: "Will BTC close UP at end of 15-Min Window?", yes: 51, no: 49, vol: "$8.2K"  },
    { title: "Will ETH close UP at end of 5-Min Window?",  yes: 43, no: 57, vol: "$3.1K"  },
    { title: "Will BTC close UP at end of 5-Min Window?",  yes: 58, no: 42, vol: "$5.8K"  },
    { title: "Will ETH close UP at end of 1-Hour Window?", yes: 55, no: 45, vol: "$21.3K" },
    { title: "Will BTC close UP at end of 1-Hour Window?", yes: 48, no: 52, vol: "$17.6K" },
  ];
  const headerOp = fi(lf, 0, 20);
  const filterOp = fi(lf, 20, 40);

  return (
    <AbsoluteFill style={{ background: BG, display: "flex", flexDirection: "column" }}>
      <TopBar activeTab="Home" wsLive frame={lf} startF={0} />

      <div style={{
        position: "absolute", top: 60, bottom: 64, left: 0, right: 0,
        overflowY: "hidden", padding: "24px 40px",
      }}>
        {/* filter row */}
        <div style={{
          opacity: filterOp,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 20,
        }}>
          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: MUTED }}>
            6 Somnia Markets
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              padding: "6px 14px", borderRadius: 6, background: BG_PANEL, border: `1px solid ${BORDER}`,
              fontFamily: F, fontSize: 12, color: TEXT, cursor: "pointer",
            }}>By Volume ▾</div>
            <div style={{
              padding: "6px 14px", borderRadius: 6, background: "transparent", border: `1px solid ${BORDER}`,
              fontFamily: F, fontSize: 12, color: MUTED, cursor: "pointer",
            }}>★ Watchlist (0)</div>
          </div>
        </div>

        {/* market grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {markets.map((m, i) => (
            <RealMarketCard key={i} {...m} frame={lf} startF={30} delay={i * 8} />
          ))}
        </div>
      </div>

      <BottomNav active="Home" frame={lf} startF={0} />
    </AbsoluteFill>
  );
}

// ─── SCENE 4: Faucet page ────────────────────────────────────────────────────
function S4Faucet({ lf, fps }: { lf: number; fps: number }) {
  const cardOp = fi(lf, 0, 25);
  const cardY  = interpolate(sp(lf, 0, fps), [0,1], [30, 0], { extrapolateRight: "clamp" });
  const btnOp  = fi(lf, 40, 60);
  const claimed = lf > 120;
  const successOp = fi(lf, 120, 145);
  const balanceScale = interpolate(sp(lf, 120, fps), [0,1], [0.8, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG }}>
      <TopBar activeTab="Faucet" frame={lf} startF={0} />

      <div style={{
        position: "absolute", top: 60, bottom: 64,
        left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          opacity: cardOp, transform: `translateY(${cardY}px)`,
          width: 480, fontFamily: F,
        }}>
          <div style={{
            background: BG_PANEL, border: `1px solid ${BORDER}`,
            borderRadius: 16, overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 20px", borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: YES_BG,
                  color: PRIMARY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                }}>⋈</div>
                <span style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>Testnet Faucet</span>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: BG_ALT, padding: "4px 10px", borderRadius: 8, fontSize: 12,
                transform: `scale(${claimed ? balanceScale : 1})`,
              }}>
                <span style={{ color: MUTED, fontSize: 11 }}>Balance</span>
                <span style={{ fontFamily: MONO, fontWeight: 500, color: TEXT }}>
                  {claimed ? "1,000.00" : "0.00"}
                  <span style={{ fontWeight: 300, color: MUTED }}> tUSDC</span>
                </span>
              </div>
            </div>

            {/* Body */}
            <div style={{
              padding: "32px 24px 24px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 64, fontWeight: 600, letterSpacing: -2, color: TEXT, lineHeight: 1 }}>
                  1,000
                </span>
                <span style={{ fontSize: 20, fontWeight: 500, color: PRIMARY }}>tUSDC</span>
              </div>

              <div style={{ opacity: btnOp, width: "100%" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "13px 20px",
                  background: claimed ? `rgba(175,217,198,0.15)` : PRIMARY,
                  color: claimed ? PRIMARY : TEXTINV,
                  borderRadius: 10, fontSize: 14, fontWeight: 500,
                  border: claimed ? `1px solid ${PRIMARY}` : "none",
                  cursor: "pointer",
                }}>
                  {claimed ? "✓  1,000 tUSDC Claimed" : "⋈  Claim 1,000 tUSDC"}
                </div>
              </div>

              {claimed && (
                <div style={{
                  opacity: successOp,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "rgba(16,185,129,0.12)", color: "#10b981",
                  fontSize: 13, fontWeight: 500,
                }}>
                  ✓ Claimed 1,000 tUSDC successfully
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "14px 20px", background: BG_ALT, borderTop: `1px solid ${BORDER}`,
              fontSize: 12, color: MUTED,
            }}>
              Need testnet gas?
              <span style={{ color: PRIMARY, textDecoration: "underline" }}>Get Somnia STT ↗</span>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="Faucet" frame={lf} startF={0} />
    </AbsoluteFill>
  );
}

// ─── SCENE 5: Trade Page ─────────────────────────────────────────────────────
function S5Trade({ lf, fps }: { lf: number; fps: number }) {
  const mainOp = fi(lf, 0, 25);
  const panelOp = fi(lf, 10, 35);

  // Step 1: shows the page (0-80)
  // Step 2: user selects YES (80-130)
  // Step 3: enters $25 (130-220)
  // Step 4: clicks BUY UP (220-280)
  // Step 5: confirmation (280+)
  const selectedYes = lf > 80;
  const amountVisible = lf > 130;
  const btnActive = lf > 200;
  const confirmedOp = fi(lf, 280, 310);

  // Animated $amount
  const amountStr = amountVisible ? "$25" : "";
  const sharesStr = amountVisible ? "39" : "0";
  const costStr   = amountVisible ? "$25.00" : "$0.00";

  // Countdown
  const countdown = Math.max(0, Math.floor(8 * 60 - lf * 0.5));
  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  // Book top values animate
  const barWYes = fi(lf, 20, 60, 0, 64);
  const barWNo  = fi(lf, 25, 65, 0, 36);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <TopBar activeTab="Home" wsLive frame={lf} startF={0} />

      <div style={{
        position: "absolute", top: 60, bottom: 64,
        left: 0, right: 0, padding: "16px 32px 32px",
        display: "grid", gridTemplateColumns: "1fr 420px", gap: 40,
        opacity: mainOp,
      }}>
        {/* Left: main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          {/* Back */}
          <button style={{
            background: "none", border: "none", color: MUTED,
            fontFamily: F, fontSize: 12, fontWeight: 500,
            letterSpacing: "0.5px", cursor: "pointer", padding: 0,
            display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content",
          }}>‹ Ethereum</button>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 12, background: "#627eea",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, color: "#fff", flexShrink: 0,
            }}>Ξ</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  DreamDEX Event Contract
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 600, padding: "3px 8px",
                  borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.5px",
                  background: YES_BG, color: PRIMARY, border: `1px solid ${BORDER}`,
                }}>SOMNIA</span>
              </div>
              <h1 style={{ fontFamily: F, fontSize: 24, fontWeight: 500, color: TEXT, margin: 0, lineHeight: 1.3 }}>
                Will ETH close UP at end of 15-Min Window?
              </h1>
              <div style={{ fontFamily: F, fontSize: 13, color: PRIMARY, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                ⏱ {mm}:{ss} remaining
              </div>
            </div>
          </div>

          {/* Chart area - simple candlestick simulation */}
          <div style={{
            background: "transparent", borderRadius: 12, overflow: "hidden",
            height: 220, display: "flex", flexDirection: "column",
          }}>
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 4, height: "100%",
              padding: "16px 0",
            }}>
              {[48,55,52,61,58,64,60,68,64,70,67,74,71,64,69,72,68,76,73,78,75,70,74,78,64].map((h, i) => {
                const barOp = fi(lf, i * 4, i * 4 + 12);
                const isGreen = h > (i > 0 ? [48,55,52,61,58,64,60,68,64,70,67,74,71,64,69,72,68,76,73,78,75,70,74,78,64][i-1] : 48);
                return (
                  <div key={i} style={{
                    flex: 1, borderRadius: "3px 3px 0 0",
                    opacity: barOp,
                    background: isGreen ? PRIMARY : DANGER,
                    height: `${(h / 90) * 100}%`,
                    minHeight: 4,
                  }} />
                );
              })}
            </div>
          </div>

          {/* Outcome table */}
          <div style={{ borderTop: `1px solid ${BORDER}` }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 100px 90px 90px", gap: 12,
              padding: "12px 0",
              fontFamily: F, fontSize: 11, fontWeight: 500, color: MUTED,
              textTransform: "uppercase", letterSpacing: "0.5px",
              borderBottom: `1px solid ${BORDER}`,
            }}>
              <span>Outcome</span><span>Chance</span><span>Yes</span><span>No</span>
            </div>

            {/* UP row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 100px 90px 90px", gap: 12,
              padding: "14px 12px", alignItems: "center",
              borderBottom: `1px solid ${BORDER}`, cursor: "pointer",
              background: selectedYes ? "rgba(175,217,198,0.05)" : "transparent",
              borderRadius: 8,
            }}>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: TEXT }}>UP (Yes)</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TEXT }}>64%</div>
              <button style={{
                padding: "8px 16px", fontFamily: MONO, fontSize: 13, fontWeight: 600,
                borderRadius: 6, border: "none", cursor: "pointer",
                background: selectedYes ? PRIMARY : YES_BG,
                color: selectedYes ? TEXTINV : PRIMARY,
              }}>64¢</button>
              <button style={{
                padding: "8px 16px", fontFamily: MONO, fontSize: 13, fontWeight: 600,
                borderRadius: 6, border: `1px solid ${DANGER}`, cursor: "pointer",
                background: NO_BG, color: DANGER,
              }}>36¢</button>
            </div>

            {/* DOWN row */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 100px 90px 90px", gap: 12,
              padding: "14px 12px", alignItems: "center", cursor: "pointer",
            }}>
              <div style={{ fontFamily: F, fontSize: 14, fontWeight: 500, color: TEXT }}>DOWN (No)</div>
              <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: TEXT }}>36%</div>
              <button style={{
                padding: "8px 16px", fontFamily: MONO, fontSize: 13, fontWeight: 600,
                borderRadius: 6, border: "none", cursor: "pointer",
                background: YES_BG, color: PRIMARY,
              }}>64¢</button>
              <button style={{
                padding: "8px 16px", fontFamily: MONO, fontSize: 13, fontWeight: 600,
                borderRadius: 6, border: `1px solid ${DANGER}`, cursor: "pointer",
                background: NO_BG, color: DANGER,
              }}>36¢</button>
            </div>
          </div>
        </div>

        {/* Right: Trade Panel (exactly as .tradePanel) */}
        <div style={{
          opacity: panelOp,
          position: "sticky", top: 32,
          background: BG_PANEL, borderRadius: 20, padding: 28, height: "fit-content",
          alignSelf: "start",
        }}>
          {/* Panel header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, paddingBottom: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8, background: "#627eea",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#fff",
            }}>Ξ</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: TEXT, lineHeight: 1.3 }}>
                Will ETH close UP?
              </div>
              <div style={{ fontFamily: F, fontSize: 11, color: PRIMARY, marginTop: 2 }}>15-Min Window</div>
            </div>
          </div>

          {/* Buy/Sell toggle */}
          <div style={{
            display: "flex", gap: 0, marginBottom: 16,
            background: BG_ALT, borderRadius: 8, padding: 4,
          }}>
            <div style={{
              flex: 1, padding: 10, textAlign: "center",
              fontFamily: F, fontSize: 13, fontWeight: 600,
              background: BG, borderRadius: 6, color: TEXT,
            }}>Buy</div>
            <div style={{
              flex: 1, padding: 10, textAlign: "center",
              fontFamily: F, fontSize: 13, fontWeight: 600,
              background: "transparent", color: MUTED,
            }}>Sell</div>
          </div>

          {/* YES/NO side buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            <div style={{
              padding: 16, fontFamily: MONO, fontSize: 15, fontWeight: 600,
              borderRadius: 12, textAlign: "center", cursor: "pointer",
              background: selectedYes ? PRIMARY : YES_BG,
              color: selectedYes ? TEXTINV : PRIMARY,
              border: "none",
            }}>
              Yes 64¢
            </div>
            <div style={{
              padding: 16, fontFamily: MONO, fontSize: 15, fontWeight: 600,
              borderRadius: 12, textAlign: "center", cursor: "pointer",
              background: NO_BG, color: DANGER, border: "none",
            }}>
              No 36¢
            </div>
          </div>

          {/* Market mode badge */}
          <div style={{
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)",
            borderRadius: 10, padding: "10px 12px", marginBottom: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 5 }}>
                ⚡ Instant Market Order
              </div>
              <span style={{
                fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700,
                background: "rgba(16,185,129,0.18)", color: "#10b981", padding: "2px 6px", borderRadius: 4,
              }}>Live Book</span>
            </div>
            <div style={{ fontFamily: F, fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
              Matches resting asks on Somnia Shannon testnet immediately.
            </div>
          </div>

          {/* Amount input */}
          <div style={{
            marginBottom: 24, background: BG_ALT, borderRadius: 12, padding: 16,
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
            }}>
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 500, color: MUTED }}>Amount (tUSDC)</span>
              <span style={{ fontFamily: F, fontSize: 12, color: PRIMARY, cursor: "pointer" }}>Switch to shares ▾</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center",
              borderBottom: `1px solid ${amountVisible ? PRIMARY : BORDER}`,
              paddingBottom: 4, marginBottom: 12,
              transition: "border-color 0.2s",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, color: MUTED, marginRight: 4 }}>$</span>
              <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 600, color: TEXT, flex: 1 }}>
                {amountVisible ? "25" : <span style={{ color: MUTED, opacity: 0.3 }}>0</span>}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px dashed ${BORDER}`, fontFamily: F, fontSize: 13, color: MUTED }}>
              <span>Est. Shares:</span>
              <span style={{ fontFamily: MONO, color: TEXT, fontWeight: 600 }}>{sharesStr}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px solid ${BORDER}`, marginTop: 4, fontFamily: F, fontSize: 14, fontWeight: 600 }}>
              <span style={{ color: TEXT }}>Total Cost:</span>
              <span style={{ color: PRIMARY, fontWeight: 700, fontFamily: MONO }}>{costStr} tUSDC</span>
            </div>
            {amountVisible && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1px dashed ${BORDER}`, marginTop: 4, fontFamily: F, fontSize: 13 }}>
                <span style={{ color: MUTED }}>Potential Payout:</span>
                <span style={{ color: SUCCESS, fontWeight: 700, fontFamily: MONO }}>+$14.00 (56.0% ROI)</span>
              </div>
            )}
          </div>

          {/* Trade Button */}
          <button style={{
            width: "100%", padding: 18,
            fontFamily: F, fontSize: 16, fontWeight: 700,
            border: "none", borderRadius: 12,
            background: btnActive ? PRIMARY : `${PRIMARY}50`,
            color: TEXTINV,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}>
            {btnActive ? `BUY UP ($25.00)` : "Enter amount to trade"}
          </button>

          {/* Confirm toast */}
          {lf > 280 && (
            <div style={{
              opacity: confirmedOp,
              marginTop: 16,
              background: "rgba(34,197,94,0.1)", border: `1px solid ${SUCCESS}`,
              borderRadius: 10, padding: "12px 16px",
              fontFamily: F, fontSize: 14, color: SUCCESS,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              ✓ Order placed on Somnia Shannon · 39 shares UP @ 64¢
            </div>
          )}

          <div style={{ fontFamily: F, fontSize: 11, color: MUTED, textAlign: "center", marginTop: 12 }}>
            Somnia Testnet: 0x3f2d…d8E2
          </div>
        </div>
      </div>

      <BottomNav active="Home" frame={lf} startF={0} />
    </AbsoluteFill>
  );
}

// ─── SCENE 6: Portfolio – Open positions ─────────────────────────────────────
function S6Portfolio({ lf, fps }: { lf: number; fps: number }) {
  const pageOp = fi(lf, 0, 20);
  const statsOp = fi(lf, 20, 45);
  const tabsOp  = fi(lf, 40, 60);
  const cardsOp = fi(lf, 55, 80);

  return (
    <AbsoluteFill style={{ background: BG, opacity: pageOp }}>
      <TopBar activeTab="Portfolio" frame={lf} startF={0} />

      <div style={{
        position: "absolute", top: 60, bottom: 64, left: 0, right: 0,
        overflowY: "hidden", padding: "32px 40px 0",
        fontFamily: F,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <h1 style={{ fontFamily: F, fontSize: 24, fontWeight: 500, color: TEXT, margin: 0 }}>Portfolio</h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                padding: "5px 12px", background: BG_ALT, borderRadius: 8,
                fontFamily: MONO, fontSize: 12, color: MUTED,
              }}>0x3f2d…d8E2</span>
            </div>
          </div>
          <button style={{
            width: 36, height: 36, borderRadius: 10, border: "none",
            background: BG_PANEL, color: MUTED, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>↻</button>
        </div>

        {/* Stats grid */}
        <div style={{
          opacity: statsOp,
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24,
        }}>
          {[
            { label: "Collateral Balance", val: "975.00", unit: "tUSDC", hint: "Available to trade" },
            { label: "Open Positions", val: "1", unit: "", hint: "Active trades", pos: true },
            { label: "Total Wagered", val: "$25.00", unit: "", hint: "This session" },
            { label: "Realized P&L", val: "+$0.00", unit: "", hint: "Settled trades", pos: true },
          ].map((s, i) => (
            <div key={i} style={{
              background: BG_PANEL, borderRadius: 12, padding: "18px 20px",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: F, fontSize: 11, fontWeight: 500, letterSpacing: "0.5px", color: MUTED, textTransform: "uppercase" }}>
                  {s.label}
                </span>
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 22, fontWeight: 600, color: s.pos ? PRIMARY : TEXT,
              }}>
                {s.val}<span style={{ fontFamily: F, fontSize: 12, fontWeight: 400, color: MUTED, marginLeft: 4 }}>{s.unit}</span>
              </div>
              <span style={{ fontFamily: F, fontSize: 11, color: MUTED }}>{s.hint}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ opacity: tabsOp, display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
          {[
            { label: "Open Positions (1)", active: true },
            { label: "Closed Positions (1)" },
            { label: "Trade History" },
            { label: "Transfers & Activity" },
            { label: "Performance & Stats" },
          ].map((t, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              fontFamily: F, fontSize: 13, fontWeight: t.active ? 600 : 500,
              color: t.active ? PRIMARY : MUTED,
              background: t.active ? "rgba(175,217,198,0.1)" : "transparent",
            }}>{t.label}</div>
          ))}
        </div>

        {/* Position card */}
        <div style={{ opacity: cardsOp }}>
          <div style={{
            background: BG_PANEL, borderRadius: 12, padding: "18px 20px",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: "#627eea",
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 18,
                }}>Ξ</div>
                <div>
                  <div style={{ fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.3 }}>
                    Will ETH close UP at end of 15-Min Window?
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>ETH-15M-live</div>
                </div>
              </div>
              <span style={{
                fontFamily: F, fontSize: 11, fontWeight: 600, padding: "3px 8px",
                borderRadius: 6, background: YES_BG, color: PRIMARY, letterSpacing: "0.5px",
                flexShrink: 0,
              }}>UP · YES</span>
            </div>

            {/* Metrics */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
              background: BG_ALT, padding: "12px 16px", borderRadius: 8,
            }}>
              {[
                { label: "Contracts", val: "39" },
                { label: "Avg Entry", val: "64¢" },
                { label: "Current", val: "69¢" },
                { label: "Unrealised P&L", val: "+$1.95", pos: true },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontFamily: F, fontSize: 10, fontWeight: 500, textTransform: "uppercase", color: MUTED, letterSpacing: "0.4px" }}>{m.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: m.pos ? SUCCESS : TEXT }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, fontFamily: F, fontSize: 12, fontWeight: 500,
                border: "none", background: BG_ALT, color: TEXT, cursor: "pointer",
              }}>📊 View Chart</button>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, fontFamily: F, fontSize: 12, fontWeight: 500,
                border: "none", background: BG_ALT, color: TEXT, cursor: "pointer",
              }}>Trade More</button>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, fontFamily: F, fontSize: 12, fontWeight: 600,
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.12)", color: DANGER, cursor: "pointer",
              }}>Sell / Exit</button>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="Portfolio" frame={lf} startF={0} />
    </AbsoluteFill>
  );
}

// ─── SCENE 7: Closed Positions + Claim ───────────────────────────────────────
function S7Closed({ lf, fps }: { lf: number; fps: number }) {
  const pageOp = fi(lf, 0, 20);
  const lostOp = fi(lf, 20, 50);
  const wonOp  = fi(lf, 70, 100);
  const claimOp = fi(lf, 160, 190);
  const claimS  = interpolate(sp(lf, 160, fps), [0,1], [0.9,1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, opacity: pageOp }}>
      <TopBar activeTab="Portfolio" frame={lf} startF={0} />

      <div style={{
        position: "absolute", top: 60, bottom: 64, left: 0, right: 0,
        overflowY: "hidden", padding: "32px 40px 0", fontFamily: F,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <h1 style={{ fontFamily: F, fontSize: 24, fontWeight: 500, color: TEXT, margin: 0 }}>Portfolio</h1>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
          {[
            { label: "Open Positions (1)" },
            { label: "Closed Positions (2)", active: true },
            { label: "Trade History" },
            { label: "Transfers & Activity" },
            { label: "Performance & Stats" },
          ].map((t, i) => (
            <div key={i} style={{
              display: "inline-flex", alignItems: "center",
              padding: "8px 14px", borderRadius: 8, cursor: "pointer",
              fontFamily: F, fontSize: 13, fontWeight: t.active ? 600 : 500,
              color: t.active ? PRIMARY : MUTED,
              background: t.active ? "rgba(175,217,198,0.1)" : "transparent",
            }}>{t.label}</div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Lost position */}
          <div style={{ opacity: lostOp, background: BG_PANEL, borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#627eea", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>Ξ</div>
                <div>
                  <div style={{ fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.3 }}>Will ETH close UP? · 15-Min Window</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>ETH-15M-01a465</div>
                </div>
              </div>
              <span style={{
                fontFamily: F, fontSize: 11, fontWeight: 600, padding: "3px 8px",
                borderRadius: 6, background: "rgba(175,217,198,0.12)", color: PRIMARY,
                letterSpacing: "0.5px", flexShrink: 0,
              }}>UP · YES</span>
            </div>
            <div style={{ marginTop: 4, marginBottom: 4, padding: "12px 14px", borderRadius: 10, display: "flex", flexDirection: "column", gap: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: "rgba(239,68,68,0.15)", color: DANGER, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "3px 9px" }}>LOST</span>
                <span style={{ fontFamily: F, fontSize: 13, color: MUTED }}>DOWN won · position expired at 0¢</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, background: BG_ALT, padding: "12px 16px", borderRadius: 8 }}>
              {[
                { label: "Contracts / Shares", val: "20" },
                { label: "Avg Entry Price", val: "49.2¢" },
                { label: "Settlement Price", val: "0.0¢" },
                { label: "Realized P&L", val: "-$9.84 (-100.0%)", neg: true },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontFamily: F, fontSize: 10, fontWeight: 500, textTransform: "uppercase", color: MUTED, letterSpacing: "0.4px" }}>{m.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: m.neg ? DANGER : TEXT }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ width: "100%", padding: "8px 14px", borderRadius: 8, fontFamily: F, fontSize: 13, fontWeight: 500, textAlign: "center", background: "rgba(239,68,68,0.1)", color: DANGER, border: "1px solid rgba(239,68,68,0.2)" }}>
              Resolved DOWN · Position Lost ($0.00)
            </div>
          </div>

          {/* Won position */}
          <div style={{ opacity: wonOp, background: BG_PANEL, borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f7931a", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18 }}>₿</div>
                <div>
                  <div style={{ fontFamily: F, fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.3 }}>Will BTC close UP? · 15-Min Window</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>BTC-15M-9b33f2</div>
                </div>
              </div>
              <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: YES_BG, color: PRIMARY, letterSpacing: "0.5px", flexShrink: 0 }}>UP · YES</span>
            </div>
            <div style={{ marginTop: 4, marginBottom: 4, padding: "12px 14px", borderRadius: 10, display: "flex", flexDirection: "column", gap: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: "rgba(34,197,94,0.15)", color: SUCCESS, border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "3px 9px" }}>WON</span>
                <span style={{ fontFamily: F, fontSize: 13, color: MUTED }}>UP won · settled at 100¢ — eligible for 1:1 redemption</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, background: BG_ALT, padding: "12px 16px", borderRadius: 8 }}>
              {[
                { label: "Contracts / Shares", val: "28" },
                { label: "Avg Entry Price", val: "71.4¢" },
                { label: "Settlement Price", val: "100¢ ✓" },
                { label: "Realized P&L", val: "+$8.01 (+40.1%)", pos: true },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontFamily: F, fontSize: 10, fontWeight: 500, textTransform: "uppercase", color: MUTED, letterSpacing: "0.4px" }}>{m.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, color: m.pos ? SUCCESS : TEXT }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Claim button */}
            <div style={{ opacity: claimOp, transform: `scale(${claimS})` }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px 18px",
                background: PRIMARY, color: TEXTINV,
                borderRadius: 10, fontFamily: F, fontSize: 13, fontWeight: 600,
                cursor: "pointer", width: "fit-content",
              }}>
                🏆 Claim $28.00 Payout — On-Chain
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav active="Portfolio" frame={lf} startF={0} />
    </AbsoluteFill>
  );
}

// ─── SCENE 8: Closer ─────────────────────────────────────────────────────────
function S8Outro({ lf, fps }: { lf: number; fps: number }) {
  const logoOp = fi(lf, 10, 35);
  const logoS  = interpolate(sp(lf, 10, fps), [0,1], [0.8, 1], { extrapolateRight: "clamp" });
  const l1Op   = fi(lf, 40, 65);
  const l1Y    = interpolate(sp(lf, 40, fps), [0,1], [30, 0], { extrapolateRight: "clamp" });
  const l2Op   = fi(lf, 65, 90);
  const l2Y    = interpolate(sp(lf, 65, fps), [0,1], [30, 0], { extrapolateRight: "clamp" });
  const l3Op   = fi(lf, 90, 115);
  const l3Y    = interpolate(sp(lf, 90, fps), [0,1], [30, 0], { extrapolateRight: "clamp" });
  const badgeOp = fi(lf, 120, 150);
  const urlOp   = fi(lf, 160, 185);

  return (
    <AbsoluteFill style={{
      background: BG, alignItems: "center", justifyContent: "center",
      flexDirection: "column",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `
          linear-gradient(${TEXT} 1px, transparent 1px),
          linear-gradient(90deg, ${TEXT} 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }} />

      <div style={{ opacity: logoOp, transform: `scale(${logoS})`, marginBottom: 52 }}>
        <img src={staticFile("logo.png")} style={{ height: 72, objectFit: "contain" }} />
      </div>

      <div style={{ opacity: l1Op, transform: `translateY(${l1Y}px)`, fontFamily: F, fontSize: 56, fontWeight: 300, color: TEXT, textAlign: "center", marginBottom: 12 }}>
        Frictionless entry.
      </div>
      <div style={{ opacity: l2Op, transform: `translateY(${l2Y}px)`, fontFamily: F, fontSize: 56, fontWeight: 300, color: TEXT, textAlign: "center", marginBottom: 12 }}>
        Sub-second execution.
      </div>
      <div style={{ opacity: l3Op, transform: `translateY(${l3Y}px)`, fontFamily: F, fontSize: 56, fontWeight: 500, color: PRIMARY, textAlign: "center", marginBottom: 56 }}>
        Verifiable truth.
      </div>

      <div style={{ display: "flex", gap: 24, opacity: badgeOp, marginBottom: 52 }}>
        {[
          { icon: "⚡", label: "Somnia Layer 1" },
          { icon: "📖", label: "DreamDEX CLOB" },
          { icon: "🔐", label: "On-Chain Settlement" },
          { icon: "✉️", label: "Passwordless Login" },
          { icon: "🚰", label: "Built-in Faucet" },
        ].map((b, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            background: YES_BG, border: `1px solid rgba(175,217,198,0.2)`,
            borderRadius: 14, padding: "20px 24px",
            fontFamily: F, fontSize: 14, fontWeight: 500, color: PRIMARY,
          }}>
            <div style={{ fontSize: 26 }}>{b.icon}</div>
            {b.label}
          </div>
        ))}
      </div>

      <div style={{ opacity: urlOp, fontFamily: F, fontSize: 18, color: MUTED }}>
        Built for the <span style={{ color: TEXT, fontWeight: 500 }}>Somnia × DreamDEX Hackathon</span>
        &nbsp;·&nbsp;
        <span style={{ color: PRIMARY }}>github.com/mateojkk/nour</span>
      </div>
    </AbsoluteFill>
  );
}

// ─── Transition flash ─────────────────────────────────────────────────────────
function Flash({ frame, at }: { frame: number; at: number }) {
  const op = interpolate(frame, [at - 6, at, at + 6], [0, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ background: BG, opacity: op, pointerEvents: "none" }} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export const NourDemo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const transitions = [360, 630, 870, 1110, 1590, 1920, 2280];

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: F }}>
      <Sequence from={0}    durationInFrames={360}><S1Login  lf={frame}        fps={fps} /></Sequence>
      <Sequence from={360}  durationInFrames={270}><S2Otp    lf={frame - 360}  fps={fps} /></Sequence>
      <Sequence from={630}  durationInFrames={240}><S3Home   lf={frame - 630}  fps={fps} /></Sequence>
      <Sequence from={870}  durationInFrames={240}><S4Faucet lf={frame - 870}  fps={fps} /></Sequence>
      <Sequence from={1110} durationInFrames={480}><S5Trade  lf={frame - 1110} fps={fps} /></Sequence>
      <Sequence from={1590} durationInFrames={330}><S6Portfolio lf={frame - 1590} fps={fps} /></Sequence>
      <Sequence from={1920} durationInFrames={360}><S7Closed lf={frame - 1920} fps={fps} /></Sequence>
      <Sequence from={2280} durationInFrames={240}><S8Outro  lf={frame - 2280} fps={fps} /></Sequence>

      {transitions.map((t) => <Flash key={t} frame={frame} at={t} />)}

      {/* Progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0,
        height: 2, background: PRIMARY, opacity: 0.4,
        width: `${(frame / 2520) * 100}%`,
      }} />
    </AbsoluteFill>
  );
};
