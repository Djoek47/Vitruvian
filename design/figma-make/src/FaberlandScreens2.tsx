import { useState, useEffect, useRef } from "react";

// ── Shared tokens ──────────────────────────────────────────────────────────────
const T = {
  gold: "#FFC61A",
  amber: "#F5A81C",
  ember: "#FF3D00",
  panel: "#0D0B08",
  surface: "#1A1611",
  surface2: "#231E17",
  textPrimary: "#FFF6E6",
  textSecondary: "#C9BFB0",
  textTertiary: "#8A8176",
  info: "#5BC8FF",
  success: "#3DD68C",
  error: "#FF2E88",
};

// ── Panel chrome ───────────────────────────────────────────────────────────────
function Panel({ children, style = {}, primary = false }: {
  children: React.ReactNode; style?: React.CSSProperties; primary?: boolean;
}) {
  return (
    <div style={{
      background: "rgba(13,11,8,0.72)",
      borderRadius: primary ? 24 : 16,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg,transparent,rgba(255,198,26,0.55) 25%,rgba(255,198,26,0.55) 75%,transparent)",
      }} />
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      color: T.textTertiary, fontFamily: "Inter", fontSize: 11,
      fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
      margin: "0 0 16px",
    }}>{children}</p>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — INPUT GLYPH SET
// ══════════════════════════════════════════════════════════════════════════════

type InputFamily = "controller" | "hands";

const CONTROLLER_GLYPHS = [
  { id: "r-thumbstick", label: "Move / Scroll", hand: "R", color: T.gold,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <circle cx="24" cy="24" r="16" stroke={c} strokeWidth="3" />
        <circle cx="24" cy="24" r="7" fill={c} opacity="0.4" />
        <path d="M24 10 L24 4M24 38 L24 44M10 24 L4 24M38 24 L44 24" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    )},
  { id: "a-button", label: "Confirm", hand: "R", color: T.gold,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="3" />
        <text x="24" y="30" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="Inter" fill={c}>A</text>
      </svg>
    )},
  { id: "b-button", label: "Back", hand: "R", color: T.textSecondary,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="3" />
        <text x="24" y="30" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="Inter" fill={c}>B</text>
      </svg>
    )},
  { id: "r-trigger", label: "Select / Grab", hand: "R", color: T.gold,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <path d="M20 6 C14 8,10 14,10 22 C10 32,14 40,20 42 L28 38 C24 36,20 30,20 22 C20 14,24 10,28 8 Z" stroke={c} strokeWidth="3" fill={c} fillOpacity="0.15" strokeLinecap="round"/>
      </svg>
    )},
  { id: "r-grip", label: "Grab Near", hand: "R", color: T.gold,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <path d="M14 12 C12 16,12 32,14 36" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M22 10 C20 14,20 34,22 38" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M30 12 C28 16,28 32,30 36" stroke={c} strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    )},
  { id: "x-button", label: "Palm Menu", hand: "L", color: T.info,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="3" />
        <text x="24" y="30" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="Inter" fill={c}>X</text>
      </svg>
    )},
  { id: "y-button", label: "Assistant", hand: "L", color: T.info,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <circle cx="24" cy="24" r="18" stroke={c} strokeWidth="3" />
        <text x="24" y="30" textAnchor="middle" fontSize="18" fontWeight="700" fontFamily="Inter" fill={c}>Y</text>
      </svg>
    )},
  { id: "l-trigger", label: "Select", hand: "L", color: T.textSecondary,
    icon: (c: string) => (
      <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
        <path d="M28 6 C34 8,38 14,38 22 C38 32,34 40,28 42 L20 38 C24 36,28 30,28 22 C28 14,24 10,20 8 Z" stroke={c} strokeWidth="3" fill={c} fillOpacity="0.15" strokeLinecap="round"/>
      </svg>
    )},
];

const HAND_GLYPHS = [
  { id: "pinch", label: "Select / Poke", icon: (c: string) => (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
      <path d="M20 28 C20 28,16 24,16 18 C16 14,18 12,20 12 C22 12,24 14,24 16 L24 26" stroke={c} strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 26 C24 20,26 14,30 14 C33 14,34 16,34 20 L34 26" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
      <ellipse cx="19" cy="34" rx="11" ry="6" fill={c} fillOpacity="0.12" stroke={c} strokeWidth="2"/>
      <circle cx="24" cy="15" r="4" fill={c} opacity="0.8"/>
      <circle cx="18" cy="15" r="4" stroke={c} strokeWidth="2" fill="none"/>
      <path d="M18 15 L24 15" stroke={c} strokeWidth="2"/>
    </svg>
  )},
  { id: "pinch-drag", label: "Drag", icon: (c: string) => (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
      <circle cx="20" cy="16" r="4" fill={c} opacity="0.8"/>
      <circle cx="16" cy="16" r="4" stroke={c} strokeWidth="2" fill="none"/>
      <path d="M16 16 L20 16" stroke={c} strokeWidth="2"/>
      <path d="M18 20 L18 38 M14 34 L18 38 L22 34" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { id: "two-hand-pinch", label: "Scale", icon: (c: string) => (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
      <circle cx="10" cy="24" r="3.5" fill={c} opacity="0.8"/>
      <circle cx="7" cy="24" r="3.5" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M7 24 L10 24" stroke={c} strokeWidth="1.5"/>
      <circle cx="38" cy="24" r="3.5" fill={c} opacity="0.8"/>
      <circle cx="41" cy="24" r="3.5" stroke={c} strokeWidth="1.5" fill="none"/>
      <path d="M41 24 L38 24" stroke={c} strokeWidth="1.5"/>
      <path d="M14 24 L34 24" stroke={c} strokeWidth="2" strokeDasharray="4 3"/>
      <path d="M8 20 L4 24 L8 28M40 20 L44 24 L40 28" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )},
  { id: "full-grab", label: "Grip", icon: (c: string) => (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
      <path d="M14 18 C14 14,17 10,22 10 C24 10,26 11,27 13 C28 11,30 10,32 10 C36 10,38 14,38 18 L38 30 C38 36,32 42,24 42 C16 42,14 36,14 30 Z" stroke={c} strokeWidth="3" fill={c} fillOpacity="0.12"/>
      <path d="M22 18 L22 24M28 18 L28 24M34 20 L34 26" stroke={c} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )},
  { id: "palm-up", label: "Palm Menu", icon: (c: string) => (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
      <path d="M14 26 C14 20,16 12,20 8 L20 22 M20 22 C20 16,22 10,26 8 L26 22 M26 22 C26 16,28 10,32 8 L32 22 M32 22 C32 16,34 12,36 14 L36 26 C36 34,30 40,24 40 C18 40,14 34,14 26 Z" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M18 36 L30 36" stroke={T.gold} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )},
  { id: "poke", label: "Direct Touch", icon: (c: string) => (
    <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
      <path d="M24 8 L24 32" stroke={c} strokeWidth="3" strokeLinecap="round"/>
      <path d="M18 14 L24 8 L30 14" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <ellipse cx="24" cy="36" rx="10" ry="5" stroke={c} strokeWidth="2" opacity="0.5"/>
      <circle cx="24" cy="32" r="3" fill={c} opacity="0.8"/>
    </svg>
  )},
];

export function ScreenInputGlyphs() {
  const [family, setFamily] = useState<InputFamily>("controller");
  const [distance, setDistance] = useState<"direct"|"ray"|"gaze">("ray");

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 24 }}>
      {/* Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontFamily: "Chakra Petch,sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 20, color: T.gold, margin: 0 }}>INPUT GLYPH SET</h2>
          <p style={{ color: T.textTertiary, fontSize: 11, margin: "4px 0 0", fontFamily: "Inter" }}>48 dmm bounding box · 3 dmm stroke minimum · controller / hand variants</p>
        </div>
        <div style={{ display: "flex", background: T.surface, borderRadius: 10, padding: 3, gap: 2 }}>
          {(["controller","hands"] as InputFamily[]).map(f => (
            <button key={f} onClick={() => setFamily(f)} style={{
              padding: "8px 20px", borderRadius: 8,
              background: family === f ? "rgba(255,198,26,0.15)" : "transparent",
              border: `1.5px solid ${family === f ? T.gold : "transparent"}`,
              color: family === f ? T.gold : T.textTertiary,
              fontFamily: "Inter", fontSize: 12, fontWeight: 600, cursor: "pointer",
              textTransform: "capitalize", transition: "all 0.15s ease",
            }}>{f === "controller" ? "🎮 Controller" : "✋ Hands"}</button>
          ))}
        </div>
      </div>

      {/* Glyph grid */}
      <Panel style={{ padding: "24px 28px" }}>
        <SectionLabel>{family === "controller" ? "Controller Inputs" : "Hand Gesture Inputs"}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {(family === "controller" ? CONTROLLER_GLYPHS : HAND_GLYPHS).map((g) => {
            const color = "color" in g ? g.color : T.gold;
            return (
              <div key={g.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                padding: "16px 12px",
                background: T.surface,
                borderRadius: 14,
                border: "1px solid rgba(255,246,230,0.06)",
                transition: "border-color 0.15s ease",
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,198,26,0.3)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,246,230,0.06)")}
              >
                {/* 48×48 dmm bounding box */}
                <div style={{
                  width: 48, height: 48,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,198,26,0.04)",
                  borderRadius: 10,
                  border: "1px dashed rgba(255,198,26,0.15)",
                }}>
                  {g.icon(color)}
                </div>
                {"hand" in g && (
                  <span style={{ fontSize: 9, color: T.textTertiary, fontFamily: "Inter", fontWeight: 600, letterSpacing: "0.08em" }}>
                    {g.hand} CTRL
                  </span>
                )}
                <span style={{ fontSize: 11, color: T.textSecondary, fontFamily: "Inter", fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>
                  {g.label}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Interaction Distance Model */}
      <Panel style={{ padding: "24px 28px" }}>
        <SectionLabel>Interaction Distance Model</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {([["direct","< 0.5 m","Direct Touch"],["ray","0.5–5 m","Ray-Cast"],["gaze","Fallback","Gaze Dwell"]] as const).map(([k,range,name]) => (
            <button key={k} onClick={() => setDistance(k)} style={{
              padding: "8px 16px", borderRadius: 8,
              background: distance === k ? "rgba(255,198,26,0.12)" : "transparent",
              border: `1.5px solid ${distance === k ? T.gold : "rgba(255,246,230,0.1)"}`,
              color: distance === k ? T.gold : T.textTertiary,
              fontFamily: "Inter", fontSize: 12, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              <div>{name}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{range}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
          {/* Visual demo */}
          <div style={{
            flex: 1, minHeight: 180, background: T.surface,
            borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
          }}>
            {distance === "direct" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 16,
                  background: "rgba(255,198,26,0.15)",
                  border: `3px solid ${T.gold}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 0 6px rgba(255,198,26,0.1)",
                  animation: "directPulse 1s ease-in-out infinite",
                }}>
                  <span style={{ fontSize: 28 }}>👆</span>
                </div>
                <span style={{ color: T.gold, fontFamily: "Inter", fontSize: 12 }}>Contact highlight · press depth state</span>
              </div>
            )}
            {distance === "ray" && (
              <svg width="260" height="160" viewBox="0 0 260 160" fill="none">
                {/* Ray beam */}
                <line x1="20" y1="80" x2="190" y2="80" stroke={T.gold} strokeWidth="1.5" strokeDasharray="8 4" opacity="0.6"/>
                <line x1="20" y1="80" x2="190" y2="80" stroke={T.gold} strokeWidth="0.5" opacity="0.3"/>
                {/* Origin */}
                <circle cx="20" cy="80" r="6" fill={T.gold} opacity="0.8"/>
                {/* Cursor */}
                <circle cx="190" cy="80" r="10" fill="none" stroke={T.gold} strokeWidth="2"/>
                <circle cx="190" cy="80" r="3" fill={T.gold}/>
                {/* Target */}
                <rect x="205" y="55" width="50" height="50" rx="8"
                  fill="rgba(255,198,26,0.15)" stroke={T.gold} strokeWidth="2"/>
                <text x="230" y="84" textAnchor="middle" fontSize="10" fill={T.gold} fontFamily="Inter" fontWeight="600">Target</text>
              </svg>
            )}
            {distance === "gaze" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 80, height: 80 }}>
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <circle cx="40" cy="40" r="36" stroke="rgba(255,246,230,0.1)" strokeWidth="6"/>
                    <circle cx="40" cy="40" r="36" stroke={T.gold} strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${0.65 * 2 * Math.PI * 36} ${2 * Math.PI * 36}`}
                      transform="rotate(-90 40 40)"
                      style={{ animation: "gazeFill 2s linear infinite" }}
                    />
                    <circle cx="40" cy="40" r="6" fill={T.gold} opacity="0.8"/>
                  </svg>
                </div>
                <span style={{ color: T.gold, fontFamily: "Inter", fontSize: 12 }}>Radial dwell timer · 65% shown</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 10 }}>
            {distance === "direct" && (
              <>
                <p style={{ color: T.textPrimary, fontFamily: "Inter", fontSize: 13, fontWeight: 600, margin: 0 }}>Direct Interaction · under 0.5 m</p>
                <p style={{ color: T.textSecondary, fontFamily: "Inter", fontSize: 12, lineHeight: 1.6, margin: 0 }}>Poke and direct grab. Buttons need visible press-depth state and contact highlight. Panels in direct range show a subtle glow on hover.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["Contact highlight","Press depth","Near glow"].map(t => (
                    <span key={t} style={{ padding: "3px 10px", borderRadius: 100, background: "rgba(255,198,26,0.1)", border: "1px solid rgba(255,198,26,0.2)", color: T.gold, fontSize: 10, fontFamily: "Inter", fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              </>
            )}
            {distance === "ray" && (
              <>
                <p style={{ color: T.textPrimary, fontFamily: "Inter", fontSize: 13, fontWeight: 600, margin: 0 }}>Ray-Cast · 0.5 m to 5 m</p>
                <p style={{ color: T.textSecondary, fontFamily: "Inter", fontSize: 12, lineHeight: 1.6, margin: 0 }}>Gold laser from controller or pinch-ray from hand. Cursor snaps to interactive surfaces. Distinct ray-hover state on every target — gold outline, no fill.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["Ray beam","Cursor dot","Ray-hover state"].map(t => (
                    <span key={t} style={{ padding: "3px 10px", borderRadius: 100, background: "rgba(255,198,26,0.1)", border: "1px solid rgba(255,198,26,0.2)", color: T.gold, fontSize: 10, fontFamily: "Inter", fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              </>
            )}
            {distance === "gaze" && (
              <>
                <p style={{ color: T.textPrimary, fontFamily: "Inter", fontSize: 13, fontWeight: 600, margin: 0 }}>Gaze Dwell · Hands-down Fallback</p>
                <p style={{ color: T.textSecondary, fontFamily: "Inter", fontSize: 12, lineHeight: 1.6, margin: 0 }}>Radial fill timer on target. Default dwell: 1.5 s. Cancel by looking away before completion. Used only when controllers and hands are both inactive.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {["Radial timer","1.5 s dwell","Gaze reticle"].map(t => (
                    <span key={t} style={{ padding: "3px 10px", borderRadius: 100, background: "rgba(255,198,26,0.1)", border: "1px solid rgba(255,198,26,0.2)", color: T.gold, fontSize: 10, fontFamily: "Inter", fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Panel>

      <style>{`
        @keyframes directPulse { 0%,100%{box-shadow:0 0 0 6px rgba(255,198,26,0.1)} 50%{box-shadow:0 0 0 14px rgba(255,198,26,0.04)} }
        @keyframes gazeFill { 0%{stroke-dasharray:0 226} 100%{stroke-dasharray:226 226} }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — MANIPULATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

type ManipMode = "move" | "rotate" | "scale" | "measure";
type SelectState = "unselected" | "hovered" | "selected" | "locked";

export function ScreenManipulation() {
  const [mode, setMode] = useState<ManipMode>("move");
  const [selectState, setSelectState] = useState<SelectState>("unselected");
  const [dims, setDims] = useState({ w: 320, d: 180, h: 240 });
  const [uniform, setUniform] = useState(true);
  const [unit, setUnit] = useState<"cm"|"m"|"in"|"ft">("cm");
  const [snap, setSnap] = useState<"off"|"1cm"|"10cm"|"25cm"|"1m">("10cm");
  const [measurePoints, setMeasurePoints] = useState<{x:number,y:number}[]>([]);

  const selStyles: Record<SelectState, React.CSSProperties> = {
    unselected: { border: "none", boxShadow: "none" },
    hovered: { border: `3px solid rgba(255,198,26,0.6)`, boxShadow: "0 0 12px rgba(255,198,26,0.15)" },
    selected: { border: `3px solid ${T.gold}`, boxShadow: "0 0 20px rgba(255,198,26,0.25)" },
    locked: { border: `3px dashed ${T.ember}`, boxShadow: "0 0 12px rgba(255,61,0,0.15)" },
  };

  const MODES: ManipMode[] = ["move","rotate","scale","measure"];
  const modeIcons: Record<ManipMode, string> = { move:"↑", rotate:"↻", scale:"⤢", measure:"⊢" };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h2 style={{ fontFamily: "Chakra Petch,sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 20, color: T.gold, margin: 0 }}>MANIPULATION SYSTEM</h2>
        <p style={{ color: T.textTertiary, fontSize: 11, margin: 0, fontFamily: "Inter" }}>Object selection · handles · inspector · hint bar</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* Left: viewport demo + mode switcher */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Mode switcher */}
          <Panel style={{ padding: "6px 8px" }}>
            <div style={{ display: "flex", gap: 4 }}>
              {MODES.map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 10,
                  background: mode === m ? "rgba(255,198,26,0.15)" : "transparent",
                  border: `1.5px solid ${mode === m ? T.gold : "transparent"}`,
                  color: mode === m ? T.gold : T.textTertiary,
                  fontFamily: "Inter", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", transition: "all 0.15s ease",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}>
                  <span style={{ fontSize: 18 }}>{modeIcons[m]}</span>
                  <span style={{ textTransform: "capitalize", letterSpacing: "0.05em" }}>{m}</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Object viewport */}
          <Panel style={{ padding: "20px", flex: 1, minHeight: 280 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <SectionLabel>Selection State</SectionLabel>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {(["unselected","hovered","selected","locked"] as SelectState[]).map(ss => (
                  <button key={ss} onClick={() => setSelectState(ss)} style={{
                    padding: "4px 10px", borderRadius: 6,
                    background: selectState === ss ? "rgba(255,198,26,0.1)" : "transparent",
                    border: `1px solid ${selectState === ss ? T.gold : "rgba(255,246,230,0.1)"}`,
                    color: selectState === ss ? T.gold : T.textTertiary,
                    fontSize: 10, fontFamily: "Inter", fontWeight: 600, cursor: "pointer",
                    textTransform: "capitalize",
                  }}>{ss}</button>
                ))}
              </div>
            </div>

            {/* Object with selection chrome */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, position: "relative" }}>
              {/* The object */}
              <div style={{
                width: 160, height: 120, borderRadius: 8,
                background: "rgba(255,246,230,0.04)",
                position: "relative",
                ...selStyles[selectState],
                transition: "all 0.2s ease",
              }}>
                {/* Corner brackets (selected state) */}
                {selectState === "selected" && (
                  <>
                    {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy], i) => (
                      <div key={i} style={{
                        position: "absolute",
                        top: sy < 0 ? -2 : "auto", bottom: sy > 0 ? -2 : "auto",
                        left: sx < 0 ? -2 : "auto", right: sx > 0 ? -2 : "auto",
                        width: 20, height: 20,
                        borderTop: sy < 0 ? `4px solid ${T.gold}` : "none",
                        borderBottom: sy > 0 ? `4px solid ${T.gold}` : "none",
                        borderLeft: sx < 0 ? `4px solid ${T.gold}` : "none",
                        borderRight: sx > 0 ? `4px solid ${T.gold}` : "none",
                      }}/>
                    ))}
                    {/* Scale handles at corners */}
                    {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy], i) => (
                      <div key={`h${i}`} style={{
                        position: "absolute",
                        top: sy < 0 ? -8 : "auto", bottom: sy > 0 ? -8 : "auto",
                        left: sx < 0 ? -8 : "auto", right: sx > 0 ? -8 : "auto",
                        width: 16, height: 16, borderRadius: "50%",
                        background: T.gold,
                        cursor: "pointer",
                        boxShadow: `0 0 8px ${T.gold}`,
                      }}/>
                    ))}
                    {/* Edge handle (right) */}
                    <div style={{
                      position: "absolute", right: -10, top: "50%", transform: "translateY(-50%)",
                      width: 8, height: 28, borderRadius: 4, background: T.gold, cursor: "ew-resize",
                    }}/>
                  </>
                )}
                {/* Lock glyph */}
                {selectState === "locked" && (
                  <div style={{ position: "absolute", top: 6, right: 6, color: T.ember, fontSize: 16 }}>🔒</div>
                )}
                {/* Rotation rings (rotate mode + selected) */}
                {selectState === "selected" && mode === "rotate" && (
                  <div style={{ position: "absolute", inset: -24, borderRadius: "50%", pointerEvents: "none" }}>
                    <svg width="208" height="168" viewBox="0 0 208 168" fill="none" style={{ position: "absolute", inset: 0 }}>
                      <ellipse cx="104" cy="84" rx="100" ry="60" stroke={T.ember} strokeWidth="6" strokeDasharray="8 6" opacity="0.7"/>
                      <ellipse cx="104" cy="84" rx="100" ry="60" stroke={T.gold} strokeWidth="6" strokeDasharray="8 6" opacity="0.7" transform="rotate(60 104 84)"/>
                      <ellipse cx="104" cy="84" rx="100" ry="60" stroke={T.info} strokeWidth="6" strokeDasharray="8 6" opacity="0.7" transform="rotate(120 104 84)"/>
                    </svg>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.textTertiary, fontSize: 12, fontFamily: "Inter" }}>
                  Object
                </div>
              </div>

              {/* Two-hand scale readout (scale mode) */}
              {mode === "scale" && selectState === "selected" && (
                <div style={{
                  position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(13,11,8,0.85)", borderRadius: 8, padding: "6px 16px",
                  border: `1px solid ${T.gold}`,
                }}>
                  <span style={{ color: T.gold, fontFamily: "Inter", fontSize: 13, fontWeight: 700 }}>1.0×</span>
                  <span style={{ color: T.textSecondary, fontFamily: "Inter", fontSize: 11, marginLeft: 8 }}>160 × 120 cm</span>
                </div>
              )}

              {/* Measure mode */}
              {mode === "measure" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="100%" height="100%" viewBox="0 0 340 200" fill="none" style={{ position: "absolute", inset: 0 }}>
                    <line x1="60" y1="100" x2="280" y2="100" stroke={T.gold} strokeWidth="2"/>
                    <line x1="60" y1="90" x2="60" y2="110" stroke={T.gold} strokeWidth="2"/>
                    <line x1="280" y1="90" x2="280" y2="110" stroke={T.gold} strokeWidth="2"/>
                    <rect x="140" y="84" width="60" height="32" rx="8" fill="rgba(13,11,8,0.9)" stroke={T.gold} strokeWidth="1.5"/>
                    <text x="170" y="104" textAnchor="middle" fontSize="11" fontFamily="Inter" fontWeight="700" fill={T.gold}>220 cm</text>
                  </svg>
                </div>
              )}
            </div>
          </Panel>

          {/* Hint bar — 1000×72 dmm */}
          <Panel style={{ padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", height: 64, gap: 8 }}>
              <span style={{ color: T.textTertiary, fontSize: 10, fontFamily: "Inter", fontWeight: 600, letterSpacing: "0.1em", marginRight: 4 }}>HINT</span>
              {(mode === "move" ? [
                { glyph: "↑", label: "Move" },
                { glyph: "⊙", label: "Stick" },
                { glyph: "◎", label: "Grip" },
              ] : mode === "rotate" ? [
                { glyph: "↻", label: "Rotate" },
                { glyph: "⊙", label: "Snap 15°" },
                { glyph: "B", label: "Cancel" },
              ] : mode === "scale" ? [
                { glyph: "⤢", label: "Scale" },
                { glyph: "◎+◎", label: "Two-hand" },
                { glyph: "⊙", label: "Reset" },
              ] : [
                { glyph: "⊢", label: "Place" },
                { glyph: "A", label: "Confirm" },
                { glyph: "B", label: "Clear" },
              ]).map((hint, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0 14px", height: 40,
                  background: T.surface,
                  borderRadius: 8,
                  border: "1px solid rgba(255,246,230,0.08)",
                }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: "rgba(255,198,26,0.12)",
                    border: `1.5px solid ${T.gold}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: T.gold, fontSize: 13, fontWeight: 700,
                    fontFamily: "Inter",
                  }}>{hint.glyph}</span>
                  <span style={{ color: T.textSecondary, fontFamily: "Inter", fontSize: 12, fontWeight: 500 }}>{hint.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right: Numeric inspector 640×900 dmm */}
        <Panel style={{ padding: "20px 20px 28px" }}>
          <SectionLabel>Precision Inspector</SectionLabel>

          {/* Dimension section */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em" }}>DIMENSIONS</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["cm","m","in","ft"] as const).map(u => (
                  <button key={u} onClick={() => setUnit(u)} style={{
                    padding: "2px 8px", borderRadius: 4,
                    background: unit === u ? "rgba(255,198,26,0.12)" : "transparent",
                    border: `1px solid ${unit === u ? T.gold : "rgba(255,246,230,0.1)"}`,
                    color: unit === u ? T.gold : T.textTertiary,
                    fontSize: 10, fontFamily: "Inter", fontWeight: 600, cursor: "pointer",
                  }}>{u}</button>
                ))}
              </div>
            </div>

            {/* Uniform lock */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setUniform(!uniform)} style={{
                width: 28, height: 28, borderRadius: 6, cursor: "pointer",
                background: uniform ? "rgba(255,198,26,0.12)" : "rgba(255,246,230,0.04)",
                border: `1.5px solid ${uniform ? T.gold : "rgba(255,246,230,0.15)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: uniform ? T.gold : T.textTertiary, fontSize: 14,
              }}>⛓</button>
              <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 11 }}>Uniform scale</span>
            </div>

            {["W","D","H"].map((axis, i) => {
              const keys = ["w","d","h"] as const;
              const val = dims[keys[i]];
              return (
                <div key={axis} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 12, fontWeight: 600, width: 16 }}>{axis}</span>
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center",
                    background: T.surface, borderRadius: 8,
                    border: "1px solid rgba(255,246,230,0.1)",
                    overflow: "hidden",
                  }}>
                    <button onClick={() => setDims(d => ({ ...d, [keys[i]]: Math.max(10, val - 10) }))}
                      style={{ width: 32, height: 36, background: "none", border: "none", color: T.textTertiary, cursor: "pointer", fontSize: 18 }}>−</button>
                    <input type="number" value={val}
                      onChange={e => setDims(d => ({ ...d, [keys[i]]: Number(e.target.value) }))}
                      style={{ flex: 1, background: "none", border: "none", color: T.textPrimary, fontFamily: "Inter", fontSize: 13, fontWeight: 600, textAlign: "center", outline: "none" }}/>
                    <button onClick={() => setDims(d => ({ ...d, [keys[i]]: val + 10 }))}
                      style={{ width: 32, height: 36, background: "none", border: "none", color: T.textTertiary, cursor: "pointer", fontSize: 18 }}>+</button>
                  </div>
                  <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 11, width: 20 }}>{unit}</span>
                </div>
              );
            })}
          </div>

          {/* Snap increment */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em" }}>SNAP INCREMENT</span>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {(["off","1cm","10cm","25cm","1m"] as const).map(s => (
                <button key={s} onClick={() => setSnap(s)} style={{
                  padding: "5px 10px", borderRadius: 6,
                  background: snap === s ? "rgba(255,198,26,0.12)" : "transparent",
                  border: `1px solid ${snap === s ? T.gold : "rgba(255,246,230,0.1)"}`,
                  color: snap === s ? T.gold : T.textTertiary,
                  fontSize: 11, fontFamily: "Inter", fontWeight: 600, cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Reset to original", color: T.textSecondary },
              { label: "Fit to my body", color: T.gold },
              { label: "Duplicate", color: T.textSecondary },
              { label: "Delete", color: T.error },
            ].map(a => (
              <button key={a.label} style={{
                padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                background: a.color === T.error ? "rgba(255,46,136,0.08)" : "rgba(255,246,230,0.04)",
                border: `1.5px solid ${a.color === T.error ? "rgba(255,46,136,0.3)" : "rgba(255,246,230,0.1)"}`,
                color: a.color, fontFamily: "Inter", fontSize: 13, fontWeight: 600,
                textAlign: "left" as const,
              }}>{a.label}</button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — HELMET HUD LAYER
// ══════════════════════════════════════════════════════════════════════════════

export function ScreenHUD() {
  const [targetLocked, setTargetLocked] = useState(false);
  const [lockFrame, setLockFrame] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [compass, setCompass] = useState(147);

  useEffect(() => {
    if (!targetLocked) { setLockFrame(0); return; }
    const t = setTimeout(() => setLockFrame(f => f < 2 ? f + 1 : 2), 300);
    return () => clearTimeout(t);
  }, [targetLocked, lockFrame]);

  const districts = [
    { deg: 60, name: "North Market" },
    { deg: 147, name: "Vitruvian Sq" },
    { deg: 220, name: "East Atrium" },
    { deg: 310, name: "Central Hub" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h2 style={{ fontFamily: "Chakra Petch,sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 20, color: T.gold, margin: 0 }}>HELMET HUD LAYER</h2>
        <p style={{ color: T.textTertiary, fontSize: 11, margin: 0, fontFamily: "Inter" }}>HEAD-LOCKED · max 6 elements · central 20° cone clear</p>
      </div>

      {/* HUD canvas */}
      <Panel style={{ flex: 1, padding: 0, minHeight: 480, position: "relative", overflow: "hidden" }}>
        {/* World scene (passthrough simulation) */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 40%, rgba(255,198,26,0.03) 0%, transparent 60%)",
        }}>
          {/* Grid lines simulating world */}
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.04 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <line key={`v${i}`} x1={`${i * 5.26}%`} y1="0" x2={`${i * 5.26}%`} y2="100%" stroke={T.textPrimary} strokeWidth="0.5"/>
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={`${i * 8.33}%`} x2="100%" y2={`${i * 8.33}%`} stroke={T.textPrimary} strokeWidth="0.5"/>
            ))}
          </svg>
        </div>

        {/* ── HUD ELEMENT 1: Corner reticle brackets ── */}
        {[
          { top: 16, left: 16, rotate: 0 },
          { top: 16, right: 16, rotate: 90 },
          { bottom: 16, left: 16, rotate: 270 },
          { bottom: 16, right: 16, rotate: 180 },
        ].map((pos, i) => (
          <div key={i} style={{ position: "absolute", width: 60, height: 60, opacity: 0.35, ...pos }}>
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ transform: `rotate(${pos.rotate}deg)` }}>
              <path d="M4 56 L4 4 L56 4" stroke={T.gold} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        ))}

        {/* ── HUD ELEMENT 2: Assistant star upper-right ── */}
        <div style={{ position: "absolute", top: 24, right: 80, opacity: 0.6 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d={`M20 2 C19 2,17 10,10 20 C17 30,19 38,20 38 C21 38,23 30,30 20 C23 10,21 2,20 2 Z`} fill={T.gold}/>
          </svg>
        </div>

        {/* ── HUD ELEMENT 3: Status cluster upper-left ── */}
        <div style={{
          position: "absolute", top: 28, left: 80,
          display: "flex", gap: 8, alignItems: "center", opacity: 0.65,
        }}>
          {[
            { icon: "◉", color: T.success, label: "Connected" },
            { icon: "⊙", color: T.gold, label: "Mic on" },
            { icon: "◈", color: T.info, label: "2 / 4" },
          ].map((s, i) => (
            <div key={i} title={s.label} style={{
              width: 24, height: 24,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: s.color, fontSize: 16,
            }}>{s.icon}</div>
          ))}
          <div style={{ width: "100%", height: 4, background: T.gold, borderRadius: 2, position: "absolute", bottom: -6, left: 0 }}/>
        </div>

        {/* ── HUD ELEMENT 4: Compass strip top-center ── */}
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          width: 340, height: 44,
          background: "rgba(13,11,8,0.55)",
          borderRadius: 8, overflow: "hidden",
          border: "1px solid rgba(255,198,26,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0.75,
        }}>
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
            {/* Ticks */}
            {Array.from({ length: 36 }).map((_, i) => {
              const deg = i * 10;
              const offset = ((deg - compass + 180) % 360 - 180) * (340 / 90);
              const isMajor = deg % 90 === 0;
              if (Math.abs(offset) > 200) return null;
              const district = districts.find(d => Math.abs(d.deg - deg) < 6);
              return (
                <div key={i} style={{ position: "absolute", left: "50%", transform: `translateX(calc(-50% + ${offset}px))` }}>
                  <div style={{ width: 1, height: isMajor ? 20 : 10, background: isMajor ? T.gold : "rgba(255,246,230,0.3)", margin: "8px auto 0" }}/>
                  {district && <div style={{ color: T.gold, fontFamily: "Inter", fontSize: 9, fontWeight: 600, textAlign: "center", marginTop: 2, whiteSpace: "nowrap" }}>{district.name}</div>}
                </div>
              );
            })}
            {/* Center marker */}
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 4, width: 1, height: 36, background: T.gold, opacity: 0.9 }}/>
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 0, fontSize: 9, fontFamily: "Inter", fontWeight: 700, color: T.gold }}>{compass}°</div>
          </div>
        </div>

        {/* ── HUD ELEMENT 5: Target lock ── */}
        <div style={{
          position: "absolute", top: "35%", left: "55%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <button onClick={() => { setTargetLocked(t => !t); setLockFrame(0); }} style={{
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              {/* Target object */}
              <rect x="20" y="20" width="40" height="40" rx="4"
                fill="rgba(255,246,230,0.06)" stroke="rgba(255,246,230,0.2)" strokeWidth="1"/>
              {/* Lock brackets — animate convergence */}
              {targetLocked && lockFrame >= 0 && (() => {
                const inset = lockFrame === 0 ? 2 : lockFrame === 1 ? 5 : 8;
                return (
                  <>
                    {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy], i) => {
                      const bx = 40 + sx * (20 - inset);
                      const by = 40 + sy * (20 - inset);
                      return (
                        <path key={i} d={`M ${bx - sx*10} ${by} L ${bx} ${by} L ${bx} ${by - sy*10}`}
                          stroke={T.gold} strokeWidth="2.5" strokeLinecap="round"
                          style={{ transition: "all 0.3s ease" }}/>
                      );
                    })}
                  </>
                );
              })()}
              {!targetLocked && (
                <text x="40" y="43" textAnchor="middle" fontSize="9" fill="rgba(255,246,230,0.4)" fontFamily="Inter">tap to lock</text>
              )}
            </svg>
          </button>
          {targetLocked && lockFrame >= 2 && (
            <div style={{
              background: "rgba(13,11,8,0.8)", borderRadius: 6, padding: "4px 12px",
              border: `1px solid ${T.gold}`,
              animation: "fadeIn 0.3s ease",
            }}>
              <span style={{ color: T.gold, fontFamily: "Inter", fontSize: 11, fontWeight: 600 }}>Storefront 14B</span>
            </div>
          )}
        </div>

        {/* ── Alert band bottom ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: alertVisible ? 64 : 0,
          background: "rgba(255,61,0,0.12)",
          borderTop: alertVisible ? `2px solid ${T.ember}` : "none",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          transition: "height 0.3s ease",
          overflow: "hidden",
        }}>
          <span style={{ color: T.ember, fontSize: 16 }}>⚠</span>
          <span style={{ color: T.textPrimary, fontFamily: "Inter", fontSize: 13, fontWeight: 500 }}>Guardian boundary nearby — slow down</span>
        </div>

        {/* Controls */}
        <div style={{ position: "absolute", bottom: alertVisible ? 80 : 16, right: 16, display: "flex", gap: 8 }}>
          <button onClick={() => setAlertVisible(a => !a)} style={{
            padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            background: "rgba(13,11,8,0.8)",
            border: `1px solid ${alertVisible ? T.ember : "rgba(255,246,230,0.15)"}`,
            color: alertVisible ? T.ember : T.textTertiary,
            fontFamily: "Inter", fontSize: 11, fontWeight: 600,
          }}>{alertVisible ? "Hide Alert" : "Show Alert"}</button>
          <button onClick={() => setCompass(c => (c + 15) % 360)} style={{
            padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            background: "rgba(13,11,8,0.8)",
            border: "1px solid rgba(255,246,230,0.15)",
            color: T.textTertiary, fontFamily: "Inter", fontSize: 11, fontWeight: 600,
          }}>Rotate +15°</button>
        </div>
      </Panel>

      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — VITRUVIAN BODY EDITOR
// ══════════════════════════════════════════════════════════════════════════════

type Confidence = "measured" | "derived" | "estimated" | "manual" | "conflicted";
type BodyView = "front" | "side" | "three-quarter" | "back";

interface Measurement {
  id: string; label: string; value: number; unit: string;
  confidence: Confidence; locked: boolean; group: string;
}

const MEASUREMENTS: Measurement[] = [
  { id:"height", label:"Height", value:181.4, unit:"cm", confidence:"measured", locked:false, group:"Global" },
  { id:"wingspan", label:"Wingspan", value:183.0, unit:"cm", confidence:"derived", locked:false, group:"Global" },
  { id:"eye-height", label:"Eye height", value:170.2, unit:"cm", confidence:"measured", locked:false, group:"Global" },
  { id:"ipd", label:"IPD", value:63.5, unit:"mm", confidence:"measured", locked:true, group:"Global" },
  { id:"head-circ", label:"Head circumference", value:56.8, unit:"cm", confidence:"measured", locked:false, group:"Head / Neck" },
  { id:"neck-circ", label:"Neck circumference", value:38.4, unit:"cm", confidence:"estimated", locked:false, group:"Head / Neck" },
  { id:"shoulder-w", label:"Shoulder width", value:44.8, unit:"cm", confidence:"measured", locked:false, group:"Torso" },
  { id:"chest", label:"Chest", value:96.2, unit:"cm", confidence:"measured", locked:false, group:"Torso" },
  { id:"waist", label:"Waist", value:82.7, unit:"cm", confidence:"measured", locked:false, group:"Torso" },
  { id:"hip", label:"Hip", value:97.1, unit:"cm", confidence:"measured", locked:false, group:"Torso" },
  { id:"inseam", label:"Inseam", value:82.0, unit:"cm", confidence:"measured", locked:false, group:"Legs" },
  { id:"thigh-circ", label:"Thigh circumference", value:54.3, unit:"cm", confidence:"derived", locked:false, group:"Legs" },
  { id:"arm-len", label:"Sleeve length", value:63.4, unit:"cm", confidence:"measured", locked:false, group:"Arms" },
  { id:"wrist-circ", label:"Wrist circumference", value:17.1, unit:"cm", confidence:"estimated", locked:false, group:"Arms" },
  { id:"foot-len", label:"Foot length", value:27.5, unit:"cm", confidence:"manual", locked:false, group:"Extremities" },
];

const CONF_STYLES: Record<Confidence, { dot: React.ReactNode; label: string; color: string }> = {
  measured:   { dot: <div style={{ width:8,height:8,borderRadius:"50%",background:T.gold }}/>, label:"Measured", color: T.gold },
  derived:    { dot: <div style={{ width:8,height:8,borderRadius:"50%",border:`2px solid ${T.gold}` }}/>, label:"Derived", color: T.gold },
  estimated:  { dot: <div style={{ width:8,height:8,borderRadius:"50%",background:"#8A8176" }}/>, label:"Estimated", color: T.textTertiary },
  manual:     { dot: <div style={{ width:8,height:8,borderRadius:"50%",background:T.ember }}/>, label:"Manual", color: T.ember },
  conflicted: { dot: <div style={{ width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderBottom:`9px solid ${T.ember}` }}/>, label:"Conflicted", color: T.ember },
};

export function ScreenVitruvianEditor() {
  const [selected, setSelected] = useState<string>("shoulder-w");
  const [bodyView, setBodyView] = useState<BodyView>("front");
  const [measurements, setMeasurements] = useState<Measurement[]>(MEASUREMENTS);
  const [ghost, setGhost] = useState(false);
  const [symmetry, setSymmetry] = useState(true);

  const selectedM = measurements.find(m => m.id === selected)!;

  const groups = Array.from(new Set(measurements.map(m => m.group)));

  const updateValue = (id: string, val: number) => {
    setMeasurements(prev => prev.map(m => m.id === id ? { ...m, value: val, confidence: "manual" } : m));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h2 style={{ fontFamily: "Chakra Petch,sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 20, color: T.gold, margin: 0 }}>VITRUVIAN BODY EDITOR</h2>
        <p style={{ color: T.textTertiary, fontSize: 11, margin: 0, fontFamily: "Inter" }}>BODY-LOCKED · 2400 dmm wide · measurement instrument</p>
      </div>

      {/* Confidence legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {(Object.entries(CONF_STYLES) as [Confidence, typeof CONF_STYLES[Confidence]][]).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {v.dot}
            <span style={{ color: v.color, fontFamily: "Inter", fontSize: 11, fontWeight: 500 }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Three-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: 12, flex: 1 }}>

        {/* LEFT: Measurement list */}
        <Panel style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 0 80px", height: "100%", overflowY: "auto" }}>
            {groups.map(group => (
              <div key={group}>
                <div style={{ padding: "6px 16px", position: "sticky", top: 0, background: "rgba(13,11,8,0.95)", zIndex: 1 }}>
                  <span style={{ color: T.textTertiary, fontSize: 10, fontFamily: "Inter", fontWeight: 600, letterSpacing: "0.1em" }}>{group.toUpperCase()}</span>
                </div>
                {measurements.filter(m => m.group === group).map(m => {
                  const cs = CONF_STYLES[m.confidence];
                  return (
                    <button key={m.id} onClick={() => setSelected(m.id)}
                      style={{
                        width: "100%", textAlign: "left", padding: "10px 16px",
                        background: selected === m.id ? "rgba(255,198,26,0.08)" : "transparent",
                        borderLeft: selected === m.id ? `3px solid ${T.gold}` : "3px solid transparent",
                        border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                        transition: "all 0.1s ease",
                      }}>
                      {cs.dot}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: selected === m.id ? T.textPrimary : T.textSecondary, fontFamily: "Inter", fontSize: 12, fontWeight: selected === m.id ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</div>
                        <div style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 11 }}>{m.value} {m.unit}</div>
                      </div>
                      {m.locked && <span style={{ color: T.ember, fontSize: 12 }}>🔒</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>

        {/* CENTER: Body viewport */}
        <Panel style={{ position: "relative", overflow: "hidden" }}>
          {/* View selector */}
          <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 2 }}>
            {(["front","side","three-quarter","back"] as BodyView[]).map(v => (
              <button key={v} onClick={() => setBodyView(v)} style={{
                padding: "5px 12px", borderRadius: 6,
                background: bodyView === v ? "rgba(255,198,26,0.12)" : "rgba(13,11,8,0.7)",
                border: `1px solid ${bodyView === v ? T.gold : "rgba(255,246,230,0.1)"}`,
                color: bodyView === v ? T.gold : T.textTertiary,
                fontSize: 10, fontFamily: "Inter", fontWeight: 600, cursor: "pointer",
                textTransform: "capitalize",
              }}>{v.replace("-", " ")}</button>
            ))}
          </div>

          {/* Ghost toggle */}
          <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2 }}>
            <button onClick={() => setGhost(g => !g)} style={{
              padding: "5px 12px", borderRadius: 6, cursor: "pointer",
              background: ghost ? "rgba(255,198,26,0.1)" : "rgba(13,11,8,0.7)",
              border: `1px solid ${ghost ? T.gold : "rgba(255,246,230,0.1)"}`,
              color: ghost ? T.gold : T.textTertiary, fontSize: 10, fontFamily: "Inter", fontWeight: 600,
            }}>Ghost overlay</button>
          </div>

          {/* Body wireframe SVG */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", paddingTop: 56 }}>
            <svg width="200" height="360" viewBox="0 0 200 360" fill="none" style={{ position: "relative" }}>
              {/* Ghost (previous profile) */}
              {ghost && (
                <g opacity="0.2" stroke={T.gold} fill="none" strokeWidth="1">
                  <ellipse cx="100" cy="28" rx="20" ry="24"/>
                  <rect x="72" y="52" width="56" height="80" rx="12"/>
                  <line x1="72" y1="60" x2="30" y2="130"/><line x1="128" y1="60" x2="170" y2="130"/>
                  <line x1="86" y1="132" x2="76" y2="240"/><line x1="114" y1="132" x2="124" y2="240"/>
                </g>
              )}

              {/* Current body — wireframe silhouette */}
              {/* Head */}
              <ellipse cx="100" cy="26" rx="22" ry="26" stroke={T.gold} strokeWidth="1.5" fill="rgba(255,198,26,0.04)"/>
              {/* Neck */}
              <rect x="93" y="50" width="14" height="16" rx="4" stroke={T.gold} strokeWidth="1.5" fill="rgba(255,198,26,0.04)"/>
              {/* Torso */}
              <path d="M68 66 C65 70,62 100,66 130 L80 134 L120 134 L134 130 C138 100,135 70,132 66 C120 60,80 60,68 66 Z" stroke={T.gold} strokeWidth="1.5" fill="rgba(255,198,26,0.04)"/>
              {/* Left arm */}
              <path d="M68 70 C55 75,40 100,34 128 C32 138,34 144,38 144" stroke={T.gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Right arm */}
              <path d="M132 70 C145 75,160 100,166 128 C168 138,166 144,162 144" stroke={T.gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Legs */}
              <path d="M80 134 L76 230 L80 280" stroke={T.gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M120 134 L124 230 L120 280" stroke={T.gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              {/* Feet */}
              <path d="M76 280 C74 290,70 296,64 296" stroke={T.gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M120 280 C122 290,126 296,136 296" stroke={T.gold} strokeWidth="1.5" fill="none" strokeLinecap="round"/>

              {/* Landmark nodes */}
              {[
                { cx: 68, cy: 70, label: "Shoulder L" },
                { cx: 132, cy: 70, label: "Shoulder R" },
                { cx: 34, cy: 128, label: "Elbow L" },
                { cx: 166, cy: 128, label: "Elbow R" },
                { cx: 80, cy: 134, label: "Hip L" },
                { cx: 120, cy: 134, label: "Hip R" },
                { cx: 76, cy: 230, label: "Knee L" },
                { cx: 124, cy: 230, label: "Knee R" },
              ].map((node, i) => (
                <circle key={i} cx={node.cx} cy={node.cy} r={5}
                  fill={T.gold} opacity="0.6" style={{ cursor: "grab" }}/>
              ))}

              {/* Selected measurement highlight — shoulder width */}
              {selectedM.id === "shoulder-w" && (
                <>
                  <line x1="68" y1="70" x2="132" y2="70" stroke={T.gold} strokeWidth="2.5" opacity="0.9"/>
                  <line x1="68" y1="62" x2="68" y2="78" stroke={T.gold} strokeWidth="2"/>
                  <line x1="132" y1="62" x2="132" y2="78" stroke={T.gold} strokeWidth="2"/>
                  <rect x="84" y="55" width="32" height="18" rx="6" fill="rgba(13,11,8,0.9)" stroke={T.gold} strokeWidth="1.5"/>
                  <text x="100" y="67" textAnchor="middle" fontSize="9" fontFamily="Inter" fontWeight="700" fill={T.gold}>{selectedM.value} cm</text>
                </>
              )}
            </svg>
          </div>
        </Panel>

        {/* RIGHT: Detail editor */}
        <Panel style={{ padding: "20px 20px 24px", overflow: "hidden" }}>
          <SectionLabel>Detail Editor</SectionLabel>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {CONF_STYLES[selectedM.confidence].dot}
              <span style={{ color: T.textPrimary, fontFamily: "Inter", fontSize: 15, fontWeight: 700 }}>{selectedM.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: CONF_STYLES[selectedM.confidence].color, fontFamily: "Inter", fontSize: 11 }}>
                {CONF_STYLES[selectedM.confidence].label}
              </span>
              {selectedM.locked && <span style={{ color: T.ember, fontSize: 11 }}>· Locked</span>}
            </div>
          </div>

          {/* Large numeric field */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: T.surface, borderRadius: 12, padding: "12px 16px",
            border: `1.5px solid rgba(255,198,26,0.3)`, marginBottom: 14,
          }}>
            <input type="number" value={selectedM.value}
              onChange={e => updateValue(selectedM.id, Number(e.target.value))}
              style={{ background: "none", border: "none", color: T.gold, fontFamily: "Chakra Petch,sans-serif", fontSize: 32, fontWeight: 700, width: 120, textAlign: "center", outline: "none" }}/>
            <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 16 }}>{selectedM.unit}</span>
          </div>

          {/* Coarse slider */}
          <div style={{ marginBottom: 14 }}>
            <input type="range" min={0} max={300} value={selectedM.value}
              onChange={e => updateValue(selectedM.id, Number(e.target.value))}
              style={{ width: "100%", accentColor: T.gold, height: 4 }}/>
            {/* Fine scrub strip */}
            <div style={{ height: 8, background: T.surface, borderRadius: 4, marginTop: 4, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: `${(selectedM.value / 300) * 100}%`, top: 0, bottom: 0, width: 2, background: T.gold, transform: "translateX(-50%)" }}/>
            </div>
          </div>

          {/* Steppers */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[["−10","−10mm",-10],["−1","−1mm",-1],["+1","+1mm",1],["+10","+10mm",10]].map(([label,title,delta]) => (
              <button key={String(label)} title={String(title)}
                onClick={() => updateValue(selectedM.id, Math.max(0, selectedM.value + Number(delta)))}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                  background: T.surface,
                  border: "1px solid rgba(255,246,230,0.1)",
                  color: T.textSecondary, fontFamily: "Inter", fontSize: 12, fontWeight: 600,
                }}>{label}</button>
            ))}
          </div>

          {/* Population percentile */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: T.textTertiary, fontSize: 10, fontFamily: "Inter", fontWeight: 600 }}>POPULATION PERCENTILE</span>
              <span style={{ color: T.gold, fontSize: 10, fontFamily: "Inter", fontWeight: 700 }}>P68</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,246,230,0.08)", borderRadius: 2 }}>
              <div style={{ width: "68%", height: "100%", background: `linear-gradient(90deg,${T.amber},${T.gold})`, borderRadius: 2 }}/>
            </div>
          </div>

          {/* Symmetry lock */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setSymmetry(s => !s)} style={{
              width: 28, height: 28, borderRadius: 6,
              background: symmetry ? "rgba(255,198,26,0.12)" : "rgba(255,246,230,0.04)",
              border: `1.5px solid ${symmetry ? T.gold : "rgba(255,246,230,0.15)"}`,
              color: symmetry ? T.gold : T.textTertiary,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, cursor: "pointer",
            }}>⇌</button>
            <span style={{ color: T.textTertiary, fontFamily: "Inter", fontSize: 11 }}>Mirror left / right</span>
          </div>

          {/* Provenance */}
          <div style={{ background: T.surface, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
            <p style={{ color: T.textTertiary, fontSize: 10, fontFamily: "Inter", fontWeight: 600, letterSpacing: "0.08em", margin: "0 0 6px" }}>WHERE THIS COMES FROM</p>
            <p style={{ color: T.textSecondary, fontSize: 11, fontFamily: "Inter", lineHeight: 1.5, margin: 0 }}>
              Captured directly from headset tracking during T-pose scan. Confidence: high. No derived dependencies.
            </p>
          </div>

          {/* Re-measure */}
          <button style={{
            width: "100%", padding: "10px 16px", borderRadius: 10, cursor: "pointer",
            background: "rgba(255,198,26,0.08)",
            border: `1.5px solid rgba(255,198,26,0.3)`,
            color: T.gold, fontFamily: "Inter", fontSize: 13, fontWeight: 600,
          }}>Re-measure this dimension</button>
        </Panel>
      </div>
    </div>
  );
}
