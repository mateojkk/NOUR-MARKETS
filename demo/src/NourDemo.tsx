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

// ─── Design Tokens (mirrors NOUR dark theme) ─────────────────────────────────
const C = {
  bg: "#1c1c1c",
  bgPanel: "#282725",
  bgCard: "#2e2c2a",
  border: "#4a4946",
  text: "#efede3",
  textMuted: "#b5b3a9",
  textLight: "#8a887e",
  primary: "#afd9c6",
  primaryDark: "#7cb99e",
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
  yes: "#afd9c6",
  no: "#ef4444",
};

const FONT = "'Inter', -apple-system, sans-serif";

// ─── Timing ───────────────────────────────────────────────────────────────────
// 60s @ 30fps = 1800 frames
// Scene 1:  0–360   (0:00–0:12)  Splash / Brand
// Scene 2:  360–570 (0:12–0:19)  Onboarding & Faucet
// Scene 3:  570–840 (0:19–0:28)  Live Market Feed
// Scene 4:  840–1230 (0:28–0:41) Trade Ticket & Order Execution
// Scene 5:  1230–1530 (0:41–0:51) Portfolio & Settlement
// Scene 6:  1530–1800 (0:51–1:00) Closer

// ─── Utility ─────────────────────────────────────────────────────────────────
function fadeIn(frame: number, start: number, duration = 18) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

function fadeOut(frame: number, end: number, duration = 15) {
  return interpolate(frame, [end - duration, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
}

function slideUp(frame: number, start: number, fps: number, delay = 0) {
  const s = spring({ frame: frame - start - delay, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
  return interpolate(s, [0, 1], [40, 0]);
}

function useSpring(frame: number, from: number, fps: number, delay = 0) {
  return spring({ frame: frame - from - delay, fps, config: { damping: 16, stiffness: 100, mass: 0.8 } });
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

/** Blinking "LIVE" indicator */
function LiveDot({ frame }: { frame: number }) {
  const blink = Math.sin(frame * 0.18) > 0 ? 1 : 0.3;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(175,217,198,0.12)",
        border: `1px solid ${C.primary}`,
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 18,
        fontWeight: 500,
        color: C.primary,
        fontFamily: FONT,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary, opacity: blink, display: "inline-block" }} />
      LIVE
    </span>
  );
}

/** Card-style UI widget */
function Panel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.bgPanel,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 32,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Animated text that types in character by character */
function TypeIn({ text, frame, startFrame, fps, style = {} }: { text: string; frame: number; startFrame: number; fps: number; style?: React.CSSProperties }) {
  const charsPerSecond = 40;
  const elapsed = Math.max(0, frame - startFrame);
  const charsVisible = Math.floor((elapsed / fps) * charsPerSecond);
  return (
    <span style={{ fontFamily: FONT, ...style }}>
      {text.slice(0, charsVisible)}
      {charsVisible < text.length && (
        <span style={{ opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0, color: C.primary }}>|</span>
      )}
    </span>
  );
}

/** Section label chip */
function SceneLabel({ label, frame, startFrame, fps }: { label: string; frame: number; startFrame: number; fps: number }) {
  const opacity = fadeIn(frame, startFrame, 20);
  return (
    <div style={{
      position: "absolute",
      top: 52,
      left: 80,
      opacity,
      background: "rgba(175,217,198,0.1)",
      border: `1px solid rgba(175,217,198,0.3)`,
      borderRadius: 8,
      padding: "6px 16px",
      fontFamily: FONT,
      fontSize: 17,
      fontWeight: 500,
      color: C.primary,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {label}
    </div>
  );
}

/** Market card mock */
function MarketCardMock({
  title,
  yes,
  no,
  vol,
  frame,
  startFrame,
  fps,
  delay = 0,
}: {
  title: string; yes: number; no: number; vol: string;
  frame: number; startFrame: number; fps: number; delay?: number;
}) {
  const s = useSpring(frame, startFrame, fps, delay);
  const opacity = interpolate(s, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(s, [0, 1], [30, 0], { extrapolateRight: "clamp" });

  return (
    <div style={{
      opacity,
      transform: `translateY(${translateY}px)`,
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      padding: "22px 24px",
      minWidth: 360,
    }}>
      <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500, color: C.text, marginBottom: 16 }}>{title}</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{
          flex: 1, textAlign: "center", padding: "10px 0",
          background: "rgba(175,217,198,0.12)", border: `1px solid ${C.yes}`,
          borderRadius: 10, fontFamily: FONT, fontSize: 18, fontWeight: 500, color: C.yes,
        }}>
          Yes {yes}¢
        </div>
        <div style={{
          flex: 1, textAlign: "center", padding: "10px 0",
          background: "rgba(239,68,68,0.08)", border: `1px solid ${C.no}`,
          borderRadius: 10, fontFamily: FONT, fontSize: 18, fontWeight: 500, color: C.no,
        }}>
          No {no}¢
        </div>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted }}>{vol} Vol</div>
    </div>
  );
}

/** Order Book price row */
function BookRow({ price, size, side, frame, startFrame, fps, delay = 0 }: {
  price: string; size: string; side: "bid" | "ask";
  frame: number; startFrame: number; fps: number; delay?: number;
}) {
  const op = fadeIn(frame, startFrame + delay, 12);
  const color = side === "bid" ? C.yes : C.no;
  const barWidth = interpolate(frame, [startFrame + delay, startFrame + delay + 20], [0, parseInt(size) * 1.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "6px 0", opacity: op }}>
      <div style={{ width: 180, height: 6, background: `${color}18`, borderRadius: 3, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: barWidth, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontFamily: FONT, fontSize: 15, color, fontWeight: 500, width: 60 }}>{price}¢</div>
      <div style={{ fontFamily: FONT, fontSize: 15, color: C.textMuted, width: 60 }}>{size}</div>
    </div>
  );
}

// ─── SCENE 1: Splash / Brand ──────────────────────────────────────────────────
function Scene1Splash({ localFrame, fps }: { localFrame: number; fps: number }) {
  const logoScale = interpolate(
    spring({ frame: localFrame, fps, config: { damping: 14, stiffness: 80 } }),
    [0, 1], [0.7, 1], { extrapolateRight: "clamp" }
  );
  const logoOpacity = fadeIn(localFrame, 0, 25);
  const taglineOpacity = fadeIn(localFrame, 45, 20);
  const taglineY = slideUp(localFrame, 45, fps);
  const subOpacity = fadeIn(localFrame, 80, 20);
  const badgesOpacity = fadeIn(localFrame, 110, 20);

  const badges = ["Somnia Layer 1", "DreamDEX Event Contracts", "Sub-second Execution"];

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 0 }}>
      {/* Grid lines bg */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `
          linear-gradient(${C.text} 1px, transparent 1px),
          linear-gradient(90deg, ${C.text} 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }} />

      {/* Logo */}
      <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, marginBottom: 48 }}>
        <img src={staticFile("logo.png")} style={{ height: 80, objectFit: "contain" }} />
      </div>

      {/* Tagline */}
      <div style={{
        opacity: taglineOpacity,
        transform: `translateY(${taglineY}px)`,
        fontFamily: FONT, fontSize: 58, fontWeight: 300,
        color: C.text, textAlign: "center", letterSpacing: "-0.02em", lineHeight: 1.15,
        marginBottom: 28,
      }}>
        Predict the future.<br />
        <span style={{ color: C.primary }}>On-chain.</span>
      </div>

      {/* Sub */}
      <div style={{
        opacity: subOpacity,
        fontFamily: FONT, fontSize: 22, fontWeight: 300,
        color: C.textMuted, textAlign: "center", marginBottom: 48,
      }}>
        Binary prediction markets at Somnia speed
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 16, opacity: badgesOpacity }}>
        {badges.map((b, i) => (
          <div key={i} style={{
            background: "rgba(175,217,198,0.07)",
            border: `1px solid rgba(175,217,198,0.25)`,
            borderRadius: 8, padding: "8px 18px",
            fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.primary,
          }}>
            {b}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 2: Onboarding & Faucet ─────────────────────────────────────────────
function Scene2Onboarding({ localFrame, fps }: { localFrame: number; fps: number }) {
  const panelOp = fadeIn(localFrame, 0, 25);
  const panelY = slideUp(localFrame, 0, fps);
  const headOp = fadeIn(localFrame, 20, 18);
  const emailOp = fadeIn(localFrame, 40, 18);
  const otpOp = fadeIn(localFrame, 80, 18);
  const faucetOp = fadeIn(localFrame, 140, 20);
  const balanceOp = fadeIn(localFrame, 175, 20);
  const s = useSpring(localFrame, 175, fps);
  const balanceScale = interpolate(s, [0, 1], [0.8, 1], { extrapolateRight: "clamp" });

  const digits = ["4", "2", "9", "1", "7", "3"];

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center" }}>
      <SceneLabel label="Onboarding" frame={localFrame} startFrame={0} fps={fps} />

      {/* Left: Login Panel */}
      <div style={{
        opacity: panelOp, transform: `translateY(${panelY}px)`,
        display: "flex", gap: 64, alignItems: "flex-start",
      }}>
        {/* Login UI */}
        <Panel style={{ width: 400 }}>
          <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: C.primary, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 24 }}>
            Sign In to NOUR
          </div>

          {/* Email */}
          <div style={{ opacity: emailOp, marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Email</div>
            <div style={{
              background: C.bgCard, border: `1px solid ${C.border}`,
              borderRadius: 10, padding: "12px 16px",
              fontFamily: FONT, fontSize: 16, color: C.text,
            }}>
              <TypeIn text="trader@nourmarket.io" frame={localFrame} startFrame={44} fps={fps} style={{ color: C.text, fontSize: 16 }} />
            </div>
          </div>

          {/* OTP boxes */}
          <div style={{ opacity: otpOp }}>
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted, marginBottom: 8 }}>6-digit code (no password)</div>
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              {digits.map((d, i) => {
                const digitOp = fadeIn(localFrame, 90 + i * 10, 10);
                return (
                  <div key={i} style={{
                    opacity: digitOp,
                    width: 48, height: 52, borderRadius: 10,
                    background: C.bgCard,
                    border: `1.5px solid ${C.primary}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: FONT, fontSize: 22, fontWeight: 500, color: C.text,
                  }}>
                    {d}
                  </div>
                );
              })}
            </div>

            <div style={{
              background: C.primary, borderRadius: 10, padding: "14px 0",
              fontFamily: FONT, fontSize: 16, fontWeight: 500, color: "#1c1c1c",
              textAlign: "center", cursor: "pointer",
            }}>
              Verify & Enter ↗
            </div>
          </div>
        </Panel>

        {/* Right: Faucet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ opacity: headOp, fontFamily: FONT, fontSize: 36, fontWeight: 300, color: C.text, lineHeight: 1.2 }}>
            Passwordless email login.<br />
            <span style={{ color: C.primary }}>No extensions needed.</span>
          </div>

          {/* Faucet panel */}
          <div style={{ opacity: faucetOp }}>
            <Panel style={{ width: 380 }}>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 18 }}>
                🚰 Testnet Faucet
              </div>
              <div style={{ fontFamily: FONT, fontSize: 15, color: C.textMuted, marginBottom: 20 }}>
                Claim free <span style={{ color: C.primary, fontWeight: 500 }}>1,000 tUSDC</span> collateral on Somnia Shannon Testnet instantly.
              </div>
              <div style={{
                background: C.primary, borderRadius: 10, padding: "13px 0",
                fontFamily: FONT, fontSize: 15, fontWeight: 500, color: "#1c1c1c",
                textAlign: "center",
              }}>
                Claim 1,000 tUSDC →
              </div>
            </Panel>
          </div>

          {/* Balance badge */}
          <div style={{
            opacity: balanceOp,
            transform: `scale(${balanceScale})`,
            display: "flex", alignItems: "center", gap: 14,
            background: "rgba(175,217,198,0.08)",
            border: `1px solid ${C.primary}`,
            borderRadius: 12, padding: "14px 24px",
          }}>
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.textMuted }}>Collateral Balance</div>
            <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 500, color: C.primary }}>1,000.00 tUSDC ✓</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 3: Live Market Feed ─────────────────────────────────────────────────
function Scene3Feed({ localFrame, fps }: { localFrame: number; fps: number }) {
  const headOp = fadeIn(localFrame, 0, 20);
  const headY = slideUp(localFrame, 0, fps);

  const markets = [
    { title: "Will ETH close UP? · 15-Minute Window", yes: 64, no: 36, vol: "$12.4K" },
    { title: "Will BTC close UP? · 15-Minute Window", yes: 51, no: 49, vol: "$8.2K" },
    { title: "Will ETH close UP? · 5-Minute Window", yes: 43, no: 57, vol: "$3.1K" },
    { title: "Will BTC close UP? · 5-Minute Window", yes: 58, no: 42, vol: "$5.8K" },
  ];

  return (
    <AbsoluteFill style={{ background: C.bg, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 80px" }}>
      <SceneLabel label="Live Market Feed" frame={localFrame} startFrame={0} fps={fps} />

      {/* Top bar strip */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", marginBottom: 40,
        opacity: headOp, transform: `translateY(${headY}px)`,
      }}>
        <div style={{ fontFamily: FONT, fontSize: 40, fontWeight: 300, color: C.text }}>
          Somnia Markets — <span style={{ color: C.primary }}>All Live</span>
        </div>
        <LiveDot frame={localFrame} />
      </div>

      {/* Hint text */}
      <div style={{
        opacity: fadeIn(localFrame, 30, 20),
        fontFamily: FONT, fontSize: 20, fontWeight: 300, color: C.textMuted,
        alignSelf: "flex-start", marginBottom: 36,
      }}>
        Real on-chain DreamDEX contracts · Prices stream from the CLOB every 3.5s
      </div>

      {/* Market grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, width: "100%" }}>
        {markets.map((m, i) => (
          <MarketCardMock key={i} {...m} frame={localFrame} startFrame={40} fps={fps} delay={i * 12} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 4: Trade Ticket ─────────────────────────────────────────────────────
function Scene4Trade({ localFrame, fps }: { localFrame: number; fps: number }) {
  const panelOp = fadeIn(localFrame, 0, 25);
  const panelY = slideUp(localFrame, 0, fps);

  // Animate order amount appearing
  const amtVisible = localFrame > 80;
  const btnActive = localFrame > 110;
  const confirmedOp = fadeIn(localFrame, 150, 20);
  const positionOp = fadeIn(localFrame, 185, 20);
  const exitOp = fadeIn(localFrame, 215, 20);

  // Price bar animation
  const barW = interpolate(localFrame, [20, 60], [0, 64], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", gap: 60, flexDirection: "row" }}>
      <SceneLabel label="Trade Ticket · Live Execution" frame={localFrame} startFrame={0} fps={fps} />

      {/* Left: Chart stub */}
      <div style={{ opacity: panelOp, transform: `translateY(${panelY}px)`, flex: 1 }}>
        <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 300, color: C.text, marginBottom: 24, lineHeight: 1.2 }}>
          ETH · Will it close UP?<br />
          <span style={{ color: C.primary, fontSize: 22, fontWeight: 500 }}>15-Minute Window · 08:47 remaining</span>
        </div>

        {/* Fake sparkline */}
        <Panel style={{ height: 220, display: "flex", alignItems: "flex-end", gap: 8, padding: "24px 28px", marginBottom: 28 }}>
          {[45, 52, 48, 61, 58, 64, 60, 68, 64, 72, 68, 76, 72, 64].map((h, i) => {
            const barOp = fadeIn(localFrame, i * 5, 10);
            return (
              <div key={i} style={{
                flex: 1, borderRadius: "4px 4px 0 0",
                opacity: barOp,
                background: h > 60 ? C.yes : C.no,
                height: `${(h / 80) * 100}%`,
              }} />
            );
          })}
        </Panel>

        {/* Book tops */}
        <Panel>
          <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live Order Book</div>
          <BookRow price="64" size="48" side="ask" frame={localFrame} startFrame={30} fps={fps} delay={0} />
          <BookRow price="63" size="72" side="ask" frame={localFrame} startFrame={30} fps={fps} delay={6} />
          <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
          <BookRow price="62" size="55" side="bid" frame={localFrame} startFrame={30} fps={fps} delay={10} />
          <BookRow price="61" size="33" side="bid" frame={localFrame} startFrame={30} fps={fps} delay={16} />
        </Panel>
      </div>

      {/* Right: Trade panel */}
      <div style={{ opacity: panelOp, transform: `translateY(${panelY}px)`, width: 420 }}>
        <Panel>
          {/* Buy UP / Down tabs */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <div style={{
              flex: 1, textAlign: "center", padding: "12px 0",
              background: "rgba(175,217,198,0.15)", border: `1.5px solid ${C.yes}`,
              borderRadius: 10, fontFamily: FONT, fontSize: 17, fontWeight: 500, color: C.yes,
            }}>
              ↑ Buy UP (YES)
            </div>
            <div style={{
              flex: 1, textAlign: "center", padding: "12px 0",
              background: "transparent", border: `1px solid ${C.border}`,
              borderRadius: 10, fontFamily: FONT, fontSize: 17, color: C.textMuted,
            }}>
              ↓ Buy DOWN (NO)
            </div>
          </div>

          {/* Price indicator */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Market Price (taker)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                flex: 1, height: 8, background: C.bgCard, borderRadius: 4, overflow: "hidden"
              }}>
                <div style={{ height: "100%", width: `${barW}%`, background: C.primary, borderRadius: 4 }} />
              </div>
              <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 500, color: C.primary }}>64¢</div>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: C.textLight, marginTop: 4 }}>$0.64 per contract · payout 100¢ if UP wins</div>
          </div>

          {/* Amount input */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted, marginBottom: 8 }}>Amount (tUSDC)</div>
            <div style={{
              background: C.bgCard, border: `1.5px solid ${amtVisible ? C.primary : C.border}`,
              borderRadius: 10, padding: "14px 16px", transition: "border-color 0.3s",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: FONT, fontSize: 24, color: C.text }}>
                {amtVisible ? "$25.00" : ""}
              </span>
              <span style={{ fontFamily: FONT, fontSize: 14, color: C.textMuted }}>≈ 39 shares</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {["$5", "$10", "$25", "$50"].map((v, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: "center", padding: "8px 0",
                  background: v === "$25" ? C.bgCard : "transparent",
                  border: `1px solid ${v === "$25" ? C.primary : C.border}`,
                  borderRadius: 8, fontFamily: FONT, fontSize: 14,
                  color: v === "$25" ? C.primary : C.textMuted,
                }}>
                  {v}
                </div>
              ))}
            </div>
          </div>

          {/* Payout breakdown */}
          <div style={{ background: C.bgCard, borderRadius: 10, padding: "14px 16px", marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontFamily: FONT, fontSize: 14, color: C.textMuted }}>
              <span>Potential Return</span>
              <span style={{ color: C.yes, fontWeight: 500 }}>$39.00 (+56%)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT, fontSize: 14, color: C.textMuted }}>
              <span>Cost</span>
              <span style={{ color: C.text }}>$25.00</span>
            </div>
          </div>

          {/* Place Order button */}
          <div style={{
            background: btnActive ? C.primary : C.bgCard,
            border: `1.5px solid ${btnActive ? C.primary : C.border}`,
            borderRadius: 12, padding: "16px 0", textAlign: "center",
            fontFamily: FONT, fontSize: 18, fontWeight: 500,
            color: btnActive ? "#1c1c1c" : C.textMuted,
            transition: "all 0.4s",
          }}>
            {btnActive ? "Place Order →" : "Enter amount to trade"}
          </div>

          {/* Confirmed toast */}
          <div style={{
            opacity: confirmedOp,
            marginTop: 18,
            background: "rgba(34,197,94,0.1)",
            border: `1px solid ${C.success}`,
            borderRadius: 10, padding: "12px 16px",
            fontFamily: FONT, fontSize: 14, color: C.success,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            ✓ Order confirmed on-chain · Somnia Shannon
          </div>
        </Panel>

        {/* Exit hint */}
        <div style={{ opacity: exitOp, marginTop: 18 }}>
          <Panel style={{ padding: "16px 20px" }}>
            <div style={{ fontFamily: FONT, fontSize: 14, color: C.textMuted }}>
              Position open · <span style={{ color: C.text }}>39 shares UP @ 64¢</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: C.primary, marginTop: 8 }}>
              Sell early to lock in gains before window closes →
            </div>
          </Panel>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 5: Portfolio & Settlement ──────────────────────────────────────────
function Scene5Portfolio({ localFrame, fps }: { localFrame: number; fps: number }) {
  const tabsOp = fadeIn(localFrame, 0, 20);
  const tabsY = slideUp(localFrame, 0, fps);
  const openOp = fadeIn(localFrame, 25, 20);
  const closedOp = fadeIn(localFrame, 100, 20);
  const claimOp = fadeIn(localFrame, 180, 20);
  const claimScale = interpolate(
    spring({ frame: localFrame - 180, fps, config: { damping: 14, stiffness: 100 } }),
    [0, 1], [0.85, 1], { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: C.bg, padding: "80px", flexDirection: "column" }}>
      <SceneLabel label="Portfolio · Settlement" frame={localFrame} startFrame={0} fps={fps} />

      {/* Tabs */}
      <div style={{ opacity: tabsOp, transform: `translateY(${tabsY}px)`, display: "flex", gap: 12, marginBottom: 40, marginTop: 30 }}>
        {["Open Positions", "Closed Positions", "Trade History", "Transfers & Activity"].map((t, i) => (
          <div key={i} style={{
            padding: "10px 22px", borderRadius: 10,
            background: i === 1 ? C.primary : "transparent",
            border: `1px solid ${i === 1 ? C.primary : C.border}`,
            fontFamily: FONT, fontSize: 15, fontWeight: i === 1 ? 500 : 300,
            color: i === 1 ? "#1c1c1c" : C.textMuted,
          }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 36, flex: 1 }}>
        {/* Open position card */}
        <div style={{ flex: 1, opacity: openOp }}>
          <div style={{ fontFamily: FONT, fontSize: 18, color: C.textMuted, marginBottom: 16 }}>Active</div>
          <Panel>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500, color: C.text }}>ETH 15-Minute</div>
                <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted, marginTop: 4 }}>39 shares · UP (YES)</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 500, color: C.yes }}>+$4.21</div>
                <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted }}>+16.8% unrealised</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, fontFamily: FONT, fontSize: 14, color: C.textMuted }}>
              <div>Entry: <span style={{ color: C.text }}>64¢ avg</span></div>
              <div>Current: <span style={{ color: C.yes }}>74¢</span></div>
              <div>Value: <span style={{ color: C.text }}>$28.86</span></div>
            </div>
          </Panel>
        </div>

        {/* Closed / settled */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: 18, color: C.textMuted, marginBottom: 16, opacity: closedOp }}>Resolved</div>
          <div style={{ opacity: closedOp }}>
            <Panel style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500, color: C.text }}>ETH 15-Minute</div>
                  <div style={{
                    display: "inline-block", marginTop: 6,
                    background: "rgba(239,68,68,0.12)", border: `1px solid ${C.no}`,
                    borderRadius: 6, padding: "3px 10px",
                    fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.no,
                  }}>
                    LOST · DOWN won
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 500, color: C.no }}>-$9.84</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted }}>-100% · 20 shares</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, fontFamily: FONT, fontSize: 14, color: C.textMuted }}>
                <div>Entry: <span style={{ color: C.text }}>49.2¢</span></div>
                <div>Settlement: <span style={{ color: C.no }}>0¢</span></div>
              </div>
            </Panel>

            {/* Won position + claim */}
            <Panel>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 500, color: C.text }}>BTC 15-Minute</div>
                  <div style={{
                    display: "inline-block", marginTop: 6,
                    background: "rgba(34,197,94,0.1)", border: `1px solid ${C.success}`,
                    borderRadius: 6, padding: "3px 10px",
                    fontFamily: FONT, fontSize: 12, fontWeight: 500, color: C.success,
                  }}>
                    WON · UP resolved
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 500, color: C.success }}>+$14.30</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: C.textMuted }}>+44% · 28 shares</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 20, fontFamily: FONT, fontSize: 14, color: C.textMuted, marginBottom: 20 }}>
                <div>Entry: <span style={{ color: C.text }}>71.4¢</span></div>
                <div>Settlement: <span style={{ color: C.success }}>100¢ ✓</span></div>
              </div>

              {/* Claim button */}
              <div style={{
                opacity: claimOp,
                transform: `scale(${claimScale})`,
                background: C.primary, borderRadius: 10, padding: "14px 0", textAlign: "center",
                fontFamily: FONT, fontSize: 16, fontWeight: 500, color: "#1c1c1c",
              }}>
                Claim $28.00 Payout → On-Chain
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── SCENE 6: Closer ──────────────────────────────────────────────────────────
function Scene6Closer({ localFrame, fps }: { localFrame: number; fps: number }) {
  const logoOp = fadeIn(localFrame, 10, 25);
  const logoScale = interpolate(
    spring({ frame: localFrame - 10, fps, config: { damping: 14, stiffness: 80 } }),
    [0, 1], [0.8, 1], { extrapolateRight: "clamp" }
  );
  const line1Op = fadeIn(localFrame, 40, 20);
  const line1Y = slideUp(localFrame, 40, fps);
  const line2Op = fadeIn(localFrame, 65, 20);
  const line2Y = slideUp(localFrame, 65, fps);
  const line3Op = fadeIn(localFrame, 90, 20);
  const line3Y = slideUp(localFrame, 90, fps);
  const badgesOp = fadeIn(localFrame, 120, 20);
  const urlOp = fadeIn(localFrame, 155, 20);

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      {/* Grid lines */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: `
          linear-gradient(${C.text} 1px, transparent 1px),
          linear-gradient(90deg, ${C.text} 1px, transparent 1px)
        `,
        backgroundSize: "80px 80px",
      }} />

      <div style={{ opacity: logoOp, transform: `scale(${logoScale})`, marginBottom: 48 }}>
        <img src={staticFile("logo.png")} style={{ height: 72, objectFit: "contain" }} />
      </div>

      <div style={{ opacity: line1Op, transform: `translateY(${line1Y}px)`, fontFamily: FONT, fontSize: 52, fontWeight: 300, color: C.text, textAlign: "center", marginBottom: 12 }}>
        Frictionless entry.
      </div>
      <div style={{ opacity: line2Op, transform: `translateY(${line2Y}px)`, fontFamily: FONT, fontSize: 52, fontWeight: 300, color: C.text, textAlign: "center", marginBottom: 12 }}>
        Sub-second execution.
      </div>
      <div style={{ opacity: line3Op, transform: `translateY(${line3Y}px)`, fontFamily: FONT, fontSize: 52, fontWeight: 500, color: C.primary, textAlign: "center", marginBottom: 52 }}>
        Verifiable truth.
      </div>

      <div style={{ display: "flex", gap: 32, opacity: badgesOp, marginBottom: 52 }}>
        {[
          { icon: "⚡", label: "Somnia Layer 1" },
          { icon: "📊", label: "DreamDEX CLOB" },
          { icon: "🔐", label: "On-Chain Settlement" },
          { icon: "✉️", label: "Passwordless Login" },
        ].map((b, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            background: "rgba(175,217,198,0.07)", border: `1px solid rgba(175,217,198,0.2)`,
            borderRadius: 14, padding: "20px 28px",
            fontFamily: FONT, fontSize: 14, fontWeight: 500, color: C.primary,
          }}>
            <div style={{ fontSize: 28 }}>{b.icon}</div>
            {b.label}
          </div>
        ))}
      </div>

      <div style={{ opacity: urlOp, fontFamily: FONT, fontSize: 20, color: C.textMuted }}>
        Built for the <span style={{ color: C.text, fontWeight: 500 }}>Somnia × DreamDEX Hackathon</span>
        &nbsp;·&nbsp;
        <span style={{ color: C.primary }}>github.com/mateojkk/nour</span>
      </div>
    </AbsoluteFill>
  );
}

// ─── Scene transition overlay ─────────────────────────────────────────────────
function SceneTransition({ frame, transitionFrame }: { frame: number; transitionFrame: number }) {
  const opacity = interpolate(
    frame,
    [transitionFrame - 8, transitionFrame, transitionFrame + 8],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill style={{ background: C.bg, opacity, pointerEvents: "none" }} />
  );
}

// ─── Main composition ─────────────────────────────────────────────────────────
export const NourDemo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene boundaries (frames)
  const TRANSITIONS = [360, 570, 840, 1230, 1530];

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      {/* Scene 1: 0–360 */}
      <Sequence from={0} durationInFrames={360}>
        <Scene1Splash localFrame={frame} fps={fps} />
      </Sequence>

      {/* Scene 2: 360–570 */}
      <Sequence from={360} durationInFrames={210}>
        <Scene2Onboarding localFrame={frame - 360} fps={fps} />
      </Sequence>

      {/* Scene 3: 570–840 */}
      <Sequence from={570} durationInFrames={270}>
        <Scene3Feed localFrame={frame - 570} fps={fps} />
      </Sequence>

      {/* Scene 4: 840–1230 */}
      <Sequence from={840} durationInFrames={390}>
        <Scene4Trade localFrame={frame - 840} fps={fps} />
      </Sequence>

      {/* Scene 5: 1230–1530 */}
      <Sequence from={1230} durationInFrames={300}>
        <Scene5Portfolio localFrame={frame - 1230} fps={fps} />
      </Sequence>

      {/* Scene 6: 1530–1800 */}
      <Sequence from={1530} durationInFrames={270}>
        <Scene6Closer localFrame={frame - 1530} fps={fps} />
      </Sequence>

      {/* Transition flashes */}
      {TRANSITIONS.map((t) => (
        <SceneTransition key={t} frame={frame} transitionFrame={t} />
      ))}

      {/* Global progress bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0,
        height: 3, background: C.primary, opacity: 0.6,
        width: `${(frame / 1800) * 100}%`,
        transition: "width 0.033s linear",
      }} />
    </AbsoluteFill>
  );
};
