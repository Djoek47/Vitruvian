import { useState, useEffect, useRef } from "react";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  gold: "#FFC61A",
  amber: "#F5A81C",
  ember: "#FF3D00",
  panel: "#0D0B08",
  surface: "#1A1611",
  surface2: "#231E17",
  text: "#FFF6E6",
  textSec: "#C9BFB0",
  textTert: "#8A8176",
  info: "#5BC8FF",
  success: "#3DD68C",
  error: "#FF2E88",
};

type CompState = "rest" | "rayhover" | "pinchactive" | "pressed" | "disabled" | "focused";
const STATES: CompState[] = ["rest", "rayhover", "pinchactive", "pressed", "disabled", "focused"];
const STATE_LABELS: Record<CompState, string> = {
  rest: "Rest",
  rayhover: "RayHover",
  pinchactive: "PinchActive",
  pressed: "Pressed",
  disabled: "Disabled",
  focused: "Focused",
};

// ─── State styling helpers ──────────────────────────────────────────────────────
function stateOutline(s: CompState): string {
  if (s === "rayhover") return `0 0 0 3px ${C.gold}`;
  if (s === "focused") return `0 0 0 3px ${C.info}`;
  return "none";
}
function stateFill(s: CompState, base: string, goldFill = C.gold): string {
  if (s === "pinchactive") return goldFill;
  if (s === "pressed") return C.amber;
  return base;
}
function stateScale(s: CompState): string {
  if (s === "rayhover") return "scale(1.02)";
  if (s === "pinchactive") return "scale(0.98)";
  return "scale(1)";
}
function stateOpacity(s: CompState): number {
  return s === "disabled" ? 0.35 : 1;
}
function stateColor(s: CompState, base: string): string {
  return s === "pinchactive" ? C.panel : base;
}

// ─── Dwell ring (focused state indicator) ──────────────────────────────────────
function DwellRing({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ position: "absolute", inset: -4, width: "calc(100% + 8px)", height: "calc(100% + 8px)", overflow: "visible", pointerEvents: "none" }}>
      <circle cx="16" cy="16" r="14" fill="none" stroke={C.info} strokeWidth="2" strokeDasharray="44 88" strokeLinecap="round" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate" from="0 16 16" to="360 16 16" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 64 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 22, color: C.gold, letterSpacing: "0.04em" }}>{title}</h2>
        {subtitle && <p style={{ margin: "4px 0 0", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.textTert, letterSpacing: "0.1em", textTransform: "uppercase" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ComponentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <p style={{ margin: "0 0 16px", fontFamily: "Inter, sans-serif", fontSize: 11, color: C.textTert, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {children}
      </div>
    </div>
  );
}

function StateLabel({ s }: { s: CompState }) {
  return <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, letterSpacing: "0.08em", textAlign: "center" }}>{STATE_LABELS[s]}</p>;
}

function StateCell({ s, children }: { s: CompState; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {children}
      <StateLabel s={s} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH 1 — INPUT GLYPH SET
// ═══════════════════════════════════════════════════════════════════════════════

// Touch Plus controller silhouette (simplified)
function ControllerBody({ highlight, side = "right" }: { highlight: string; side?: "left" | "right" }) {
  const flip = side === "left" ? -1 : 1;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      {/* Body */}
      <g opacity="0.3" stroke={C.gold} strokeWidth="1.5" fill="none">
        <path d="M24 8 C16 8 10 14 9 22 L8 36 C8 40 11 42 14 42 L22 42 L26 36 L32 38 C36 38 40 34 40 30 L39 20 C38 12 32 8 24 8Z" />
        <circle cx="24" cy="22" r="5" /> {/* thumbstick */}
        <circle cx="19" cy="32" r="3.5" /> {/* button A area */}
        <circle cx="27" cy="30" r="3.5" /> {/* button B area */}
        <rect x="11" y="28" width="6" height="10" rx="2" /> {/* trigger */}
      </g>
      {/* Highlight specific input */}
      <g stroke={C.gold} strokeWidth="2.5" fill="none" strokeLinecap="round">
        {highlight === "thumbstick_move" && <circle cx="24" cy="22" r="5" stroke={C.gold} fill={C.gold} fillOpacity="0.2" />}
        {highlight === "thumbstick_move" && <>
          <line x1="24" y1="15" x2="24" y2="11" /><polygon points="24,9 22,13 26,13" fill={C.gold} stroke="none" />
          <line x1="24" y1="29" x2="24" y2="33" /><polygon points="24,35 22,31 26,31" fill={C.gold} stroke="none" />
        </>}
        {highlight === "thumbstick_click" && <circle cx="24" cy="22" r="5" stroke={C.gold} fill={C.gold} fillOpacity="0.6" />}
        {highlight === "button_a" && <circle cx="27" cy="30" r="3.5" stroke={C.gold} fill={C.gold} fillOpacity="0.6" />}
        {highlight === "button_b" && <circle cx="19" cy="32" r="3.5" stroke={C.gold} fill={C.gold} fillOpacity="0.6" />}
        {highlight === "button_x" && <circle cx="27" cy="30" r="3.5" stroke={C.gold} fill={C.gold} fillOpacity="0.6" />}
        {highlight === "button_y" && <circle cx="19" cy="32" r="3.5" stroke={C.gold} fill={C.gold} fillOpacity="0.6" />}
        {highlight === "trigger_press" && <rect x="11" y="28" width="6" height="10" rx="2" stroke={C.gold} fill={C.gold} fillOpacity="0.4" />}
        {highlight === "trigger_hold" && <rect x="11" y="28" width="6" height="10" rx="2" stroke={C.gold} fill={C.gold} fillOpacity="0.8" />}
        {highlight === "grip_press" && <rect x="7" y="34" width="5" height="7" rx="2" stroke={C.gold} fill={C.gold} fillOpacity="0.4" />}
        {highlight === "grip_hold" && <rect x="7" y="34" width="5" height="7" rx="2" stroke={C.gold} fill={C.gold} fillOpacity="0.8" />}
        {highlight === "both_grips" && <>
          <rect x="7" y="34" width="5" height="7" rx="2" stroke={C.gold} fill={C.gold} fillOpacity="0.8" />
          <rect x="36" y="34" width="5" height="7" rx="2" stroke={C.gold} fill={C.gold} fillOpacity="0.8" />
        </>}
        {highlight === "controller_body" && <path d="M24 8 C16 8 10 14 9 22 L8 36 C8 40 11 42 14 42 L22 42 L26 36 L32 38 C36 38 40 34 40 30 L39 20 C38 12 32 8 24 8Z" stroke={C.gold} fill={C.gold} fillOpacity="0.1" />}
      </g>
    </svg>
  );
}

// Simplified hand glyph from 3/4 angle
function HandGlyph({ gesture }: { gesture: string }) {
  // Base hand shape at 3/4 angle
  const baseColor = C.textTert;
  const activeColor = C.gold;

  const thumbActive = ["pinch", "pinch_hold", "pinch_drag", "two_hand_pinch", "thumbs_rest"].includes(gesture);
  const indexActive = ["pinch", "pinch_hold", "pinch_drag", "two_hand_pinch", "poke", "point", "dwell_gaze"].includes(gesture);
  const middleActive = ["full_grab", "pinch_drag"].includes(gesture);
  const ringActive = ["full_grab"].includes(gesture);
  const pinkyActive = ["full_grab"].includes(gesture);
  const allFingers = gesture === "open_hand" || gesture === "palm_up" || gesture === "palm_down";
  const palmActive = ["palm_up", "palm_down"].includes(gesture);

  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      {/* Palm */}
      <ellipse cx="24" cy="34" rx="10" ry="8" fill={palmActive ? activeColor : baseColor} fillOpacity="0.3" stroke={palmActive ? activeColor : baseColor} strokeWidth="1.5" />
      {/* Thumb */}
      <path d="M14 32 C10 30 9 26 11 24 C13 22 16 24 16 27" stroke={thumbActive || allFingers ? activeColor : baseColor} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={thumbActive || allFingers ? 1 : 0.3} />
      {/* Index */}
      <path d="M19 26 C18 22 19 17 21 15 C22 13 24 14 24 17 L23 26" stroke={indexActive || allFingers ? activeColor : baseColor} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={indexActive || allFingers ? 1 : 0.3} />
      {/* Middle */}
      <path d="M23 26 C23 21 24 16 25 14 C26 12 28 13 28 16 L27 26" stroke={middleActive || allFingers ? activeColor : baseColor} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={middleActive || allFingers ? 1 : 0.3} />
      {/* Ring */}
      <path d="M27 26 C27 21 28 17 29 15 C30 13 32 14 31 17 L30 26" stroke={ringActive || allFingers ? activeColor : baseColor} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={ringActive || allFingers ? 1 : 0.3} />
      {/* Pinky */}
      <path d="M30 27 C30 23 31 20 32 18 C33 16 34 17 34 19 L33 27" stroke={pinkyActive || allFingers ? activeColor : baseColor} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity={pinkyActive || allFingers ? 1 : 0.3} />
      {/* Motion arc for drag/move gestures */}
      {(gesture === "pinch_drag" || gesture === "poke") && (
        <path d="M28 20 Q34 18 36 24" stroke={C.gold} strokeWidth="2" fill="none" strokeLinecap="round" markerEnd="url(#arr)" />
      )}
      {gesture === "two_hand_pinch" && (
        <>
          <line x1="28" y1="24" x2="38" y2="22" stroke={C.gold} strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" />
          <circle cx="38" cy="22" r="3" fill="none" stroke={C.gold} strokeWidth="1.5" />
        </>
      )}
      {gesture === "dwell_gaze" && (
        <circle cx="24" cy="16" r="6" fill="none" stroke={C.info} strokeWidth="1.5" strokeDasharray="19 38" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 24 16" to="360 24 16" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

// Dwell timer ring — 8 frames
function DwellTimerRing({ frame }: { frame: number }) {
  const pct = frame / 7;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke={C.surface2} strokeWidth="4" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={C.gold} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 24 24)" />
      <circle cx="24" cy="24" r="4" fill={pct === 1 ? C.gold : C.textTert} />
    </svg>
  );
}

const CONTROLLER_GLYPHS = ["thumbstick_move", "thumbstick_click", "button_a", "button_b", "button_x", "button_y", "trigger_press", "trigger_hold", "grip_press", "grip_hold", "both_grips", "controller_body"];
const HAND_GLYPHS = ["pinch", "pinch_hold", "pinch_drag", "two_hand_pinch", "full_grab", "palm_up", "palm_down", "poke", "point", "open_hand", "thumbs_rest", "dwell_gaze"];

function GlyphCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 12, border: `1px solid rgba(255,198,26,0.1)` }}>
        {children}
      </div>
      <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, textAlign: "center", maxWidth: 64, lineHeight: 1.3 }}>{label.replace(/_/g, " ")}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH 2 — CORE INTERACTIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// FL_Button
type ButtonType = "primary" | "secondary" | "ghost" | "destructive";

function FL_Button({ type = "primary", label = "Button", state = "rest", leadingIcon }: {
  type?: ButtonType; label?: string; state?: CompState; leadingIcon?: React.ReactNode;
}) {
  const fills: Record<ButtonType, string> = {
    primary: C.gold,
    secondary: C.surface,
    ghost: "transparent",
    destructive: C.surface,
  };
  const borders: Record<ButtonType, string> = {
    primary: "none",
    secondary: `2px solid ${C.gold}`,
    ghost: "none",
    destructive: `2px solid ${C.error}`,
  };
  const textColors: Record<ButtonType, string> = {
    primary: C.panel,
    secondary: C.text,
    ghost: C.text,
    destructive: C.error,
  };

  const bg = stateFill(state, fills[type], type === "primary" ? C.gold : C.gold);
  const isGoldFill = state === "pinchactive" || state === "pressed";
  const textColor = isGoldFill ? C.panel : textColors[type];

  return (
    <div style={{
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 48,
      minWidth: 140,
      padding: "0 24px",
      background: isGoldFill ? (state === "pressed" ? C.amber : C.gold) : fills[type],
      border: isGoldFill ? "none" : borders[type],
      borderRadius: 8,
      fontFamily: "Inter, sans-serif",
      fontSize: 13,
      fontWeight: 600,
      color: textColor,
      boxShadow: stateOutline(state),
      transform: stateScale(state),
      opacity: stateOpacity(state),
      transition: "all 0.15s ease",
      cursor: state === "disabled" ? "not-allowed" : "pointer",
      borderBottom: state === "pressed" ? `2px solid rgba(0,0,0,0.2)` : undefined,
      textDecoration: (type === "ghost" && state === "rayhover") ? `underline ${C.gold}` : "none",
      letterSpacing: "0.02em",
      whiteSpace: "nowrap",
    }}>
      {state === "focused" && <DwellRing />}
      {leadingIcon && <span style={{ width: 18, height: 18, display: "flex" }}>{leadingIcon}</span>}
      {label}
    </div>
  );
}

// FL_IconButton
function FL_IconButton({ icon, type = "default", state = "rest" }: {
  icon: React.ReactNode; type?: "default" | "destructive"; state?: CompState;
}) {
  const bg = state === "pinchactive" ? C.gold : state === "pressed" ? C.amber : C.surface;
  const iconColor = (state === "pinchactive" || state === "pressed") ? C.panel : (type === "destructive" ? C.error : C.text);
  return (
    <div style={{
      position: "relative",
      width: 48,
      height: 48,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: bg,
      borderRadius: "50%",
      boxShadow: stateOutline(state),
      transform: stateScale(state),
      opacity: stateOpacity(state),
      transition: "all 0.15s ease",
      cursor: state === "disabled" ? "not-allowed" : "pointer",
      color: iconColor,
    }}>
      {state === "focused" && <DwellRing />}
      {icon}
    </div>
  );
}

// FL_Toggle
function FL_Toggle({ on = false, state = "rest", label = "Label" }: {
  on?: boolean; state?: CompState; label?: string;
}) {
  const trackBg = on ? C.gold : C.surface2;
  const knobX = on ? 32 : 4;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: stateOpacity(state) }}>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.textSec }}>{label}</span>
      <div style={{
        position: "relative",
        width: 60,
        height: 32,
        background: stateFill(state, trackBg),
        borderRadius: 16,
        boxShadow: stateOutline(state),
        transform: stateScale(state),
        transition: "all 0.15s ease",
        cursor: state === "disabled" ? "not-allowed" : "pointer",
        flexShrink: 0,
      }}>
        {state === "focused" && <DwellRing />}
        <div style={{
          position: "absolute",
          top: 4,
          left: knobX,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: on ? C.panel : C.textTert,
          transition: "left 0.2s ease",
        }} />
      </div>
    </div>
  );
}

// FL_Slider
function FL_Slider({ value = 60, variant = "plain", state = "rest" }: {
  value?: number; variant?: "plain" | "withvalue" | "withticks"; state?: CompState;
}) {
  const pct = value / 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: stateOpacity(state), width: 200 }}>
      <div style={{ position: "relative", flex: 1, height: 36, display: "flex", alignItems: "center" }}>
        {/* Track */}
        <div style={{ width: "100%", height: 4, background: C.surface2, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: C.gold }} />
        </div>
        {/* Ticks */}
        {variant === "withticks" && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {[0,25,50,75,100].map(v => <div key={v} style={{ width: 1, height: 4, background: C.textTert }} />)}
          </div>
        )}
        {/* Knob — visible 28px, hit area 44px */}
        <div style={{
          position: "absolute",
          left: `calc(${pct * 100}% - 14px)`,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: stateFill(state, C.gold),
          boxShadow: stateOutline(state),
          transform: stateScale(state),
          transition: "all 0.15s ease",
          cursor: "pointer",
        }} />
      </div>
      {variant === "withvalue" && (
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.text, minWidth: 32, textAlign: "right" }}>{value}</span>
      )}
    </div>
  );
}

// FL_ScrubStrip
function FL_ScrubStrip({ state = "rest" }: { state?: CompState }) {
  return (
    <div style={{
      width: 320,
      height: 36,
      background: C.surface,
      borderRadius: 6,
      border: `1px solid rgba(255,198,26,${state === "rayhover" ? "0.4" : "0.1"})`,
      position: "relative",
      overflow: "hidden",
      opacity: stateOpacity(state),
      cursor: state === "disabled" ? "not-allowed" : "ew-resize",
      display: "flex",
      alignItems: "center",
    }}>
      {/* Tick marks */}
      {Array.from({ length: 41 }, (_, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${(i / 40) * 100}%`,
          width: 1,
          height: i % 10 === 0 ? 16 : i % 5 === 0 ? 10 : 6,
          background: i % 10 === 0 ? C.textSec : C.textTert,
          bottom: "50%",
          transform: "translateY(50%)",
        }} />
      ))}
      {/* Center indicator */}
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", width: 2, height: "100%", background: C.gold }} />
      {state === "rayhover" && <div style={{ position: "absolute", inset: 0, border: `2px solid ${C.gold}`, borderRadius: 6, pointerEvents: "none" }} />}
    </div>
  );
}

// FL_Segmented
function FL_Segmented({ options, selected = 0, state = "rest" }: {
  options: string[]; selected?: number; state?: CompState;
}) {
  return (
    <div style={{
      display: "inline-flex",
      height: 44,
      background: C.surface,
      borderRadius: 8,
      padding: 3,
      gap: 2,
      boxShadow: stateOutline(state),
      opacity: stateOpacity(state),
      transform: stateScale(state),
      transition: "all 0.15s ease",
    }}>
      {state === "focused" && <DwellRing />}
      {options.map((opt, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          borderRadius: 6,
          background: i === selected ? (state === "pinchactive" ? C.gold : C.gold) : "transparent",
          color: i === selected ? (state === "pinchactive" ? C.panel : C.panel) : C.textSec,
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          cursor: state === "disabled" ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          transition: "all 0.15s ease",
        }}>
          {opt}
        </div>
      ))}
    </div>
  );
}

// FL_ListRow
type ListRowVariant = "default" | "withvalue" | "withbadge" | "selected" | "conflicted";

function FL_ListRow({ label = "List item", value, badge, variant = "default", state = "rest" }: {
  label?: string; value?: string; badge?: string; variant?: ListRowVariant; state?: CompState;
}) {
  const isSelected = variant === "selected";
  const isConflicted = variant === "conflicted";
  return (
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: 12,
      height: 48,
      padding: "0 16px 0 20px",
      background: isSelected ? `rgba(255,198,26,0.08)` : stateFill(state, C.surface),
      borderRadius: 8,
      boxShadow: stateOutline(state),
      opacity: stateOpacity(state),
      transform: stateScale(state),
      transition: "all 0.15s ease",
      cursor: state === "disabled" ? "not-allowed" : "pointer",
      overflow: "hidden",
      width: 280,
    }}>
      {isConflicted && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: C.ember, borderRadius: "8px 0 0 8px" }} />}
      {state === "focused" && <DwellRing />}
      {/* Leading icon placeholder */}
      <div style={{ width: 20, height: 20, borderRadius: 4, background: C.surface2, flexShrink: 0 }} />
      <span style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: 13, color: isSelected ? C.gold : C.text }}>{label}</span>
      {value && <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.textTert }}>{value}</span>}
      {badge && (
        <span style={{ padding: "2px 8px", borderRadius: 99, background: C.surface2, fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textSec }}>{badge}</span>
      )}
      {/* Trailing chevron */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M4 2l4 4-4 4" stroke={C.textTert} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// FL_Chip
type ChipType = "suggestion" | "filter" | "colour";

function FL_Chip({ label = "Chip", type = "suggestion", state = "rest", colour }: {
  label?: string; type?: ChipType; state?: CompState; colour?: string;
}) {
  const bg = state === "pinchactive" ? C.gold : state === "pressed" ? C.amber : C.surface2;
  const textColor = (state === "pinchactive" || state === "pressed") ? C.panel : C.text;
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 36,
      padding: "0 16px",
      background: bg,
      borderRadius: 18,
      border: `1.5px solid ${state === "rayhover" ? C.gold : "rgba(255,246,230,0.1)"}`,
      boxShadow: stateOutline(state),
      opacity: stateOpacity(state),
      transform: stateScale(state),
      transition: "all 0.15s ease",
      cursor: state === "disabled" ? "not-allowed" : "pointer",
      fontFamily: "Inter, sans-serif",
      fontSize: 12,
      fontWeight: 500,
      color: textColor,
      whiteSpace: "nowrap",
    }}>
      {type === "colour" && colour && (
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: colour, flexShrink: 0 }} />
      )}
      {label}
    </div>
  );
}

// FL_InputNumeric
function FL_InputNumeric({ value = "185", unit = "cm", state = "rest" }: {
  value?: string; unit?: string; state?: CompState;
}) {
  const isFocused = state === "rayhover" || state === "pinchactive";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      width: 240,
      height: 48,
      background: C.surface,
      borderRadius: 8,
      border: `2px solid ${isFocused ? C.gold : state === "disabled" ? "transparent" : "rgba(255,246,230,0.1)"}`,
      boxShadow: stateOutline(state),
      opacity: stateOpacity(state),
      overflow: "hidden",
      transition: "all 0.15s ease",
      position: "relative",
    }}>
      {state === "focused" && <DwellRing />}
      {/* Minus stepper */}
      <div style={{ width: 48, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRight: `1px solid rgba(255,246,230,0.08)`, cursor: "pointer", color: C.textSec, fontSize: 18, fontFamily: "Inter, sans-serif" }}>−</div>
      {/* Value */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 18, color: C.text }}>{value}</span>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: C.textTert }}>{unit}</span>
        {(state === "pinchactive") && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginLeft: 4 }}>
            <circle cx="7" cy="7" r="6" stroke={C.info} strokeWidth="1.5" />
            <path d="M5 7h4M7 5v4" stroke={C.info} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      {/* Plus stepper */}
      <div style={{ width: 48, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: `1px solid rgba(255,246,230,0.08)`, cursor: "pointer", color: C.textSec, fontSize: 18, fontFamily: "Inter, sans-serif" }}>+</div>
    </div>
  );
}

// FL_InputText
function FL_InputText({ placeholder = "Speak or type…", state = "rest" }: {
  placeholder?: string; state?: CompState;
}) {
  const isFocused = state === "rayhover" || state === "pinchactive";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      width: 320,
      height: 48,
      background: C.surface,
      borderRadius: 8,
      border: `2px solid ${isFocused ? C.gold : "rgba(255,246,230,0.1)"}`,
      boxShadow: stateOutline(state),
      opacity: stateOpacity(state),
      transition: "all 0.15s ease",
      padding: "0 12px 0 16px",
      gap: 8,
      position: "relative",
    }}>
      {state === "focused" && <DwellRing />}
      <span style={{ flex: 1, fontFamily: "Inter, sans-serif", fontSize: 13, color: state === "pressed" ? C.text : C.textTert }}>{state === "pressed" ? "Rechercher un quartier" : placeholder}</span>
      {/* Dictation affordance */}
      <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: state === "pinchactive" ? C.gold : C.surface2 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="5" y="1" width="6" height="10" rx="3" fill={state === "pinchactive" ? C.panel : C.textSec} />
          <path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6" stroke={state === "pinchactive" ? C.panel : C.textSec} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <line x1="8" y1="14" x2="8" y2="16" stroke={state === "pinchactive" ? C.panel : C.textSec} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// FL_Tooltip
type TooltipDir = "above" | "below" | "left" | "right";

function FL_Tooltip({ dir = "above", text = "Louer cet espace" }: { dir?: TooltipDir; text?: string }) {
  const arrow: Record<TooltipDir, React.CSSProperties> = {
    above: { bottom: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)" },
    below: { top: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)" },
    left: { right: -6, top: "50%", transform: "translateY(-50%) rotate(45deg)" },
    right: { left: -6, top: "50%", transform: "translateY(-50%) rotate(45deg)" },
  };
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{
        background: "rgba(13,11,8,0.88)",
        border: `1px solid rgba(255,198,26,0.2)`,
        borderRadius: 12,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        backdropFilter: "blur(8px)",
        whiteSpace: "nowrap",
      }}>
        <div style={{ width: 16, height: 16, background: C.surface2, borderRadius: 4, flexShrink: 0 }} />
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: C.text }}>{text}</span>
      </div>
      <div style={{
        position: "absolute",
        width: 8, height: 8,
        background: "rgba(13,11,8,0.88)",
        border: `1px solid rgba(255,198,26,0.2)`,
        ...arrow[dir],
      }} />
    </div>
  );
}

// FL_ConfirmModal
function FL_ConfirmModal() {
  return (
    <div style={{
      width: 400,
      background: C.surface,
      borderRadius: 16,
      border: `1px solid rgba(255,198,26,0.12)`,
      padding: 32,
      position: "relative",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `rgba(255,198,26,0.4)`, borderRadius: "16px 16px 0 0" }} />
      <h3 style={{ margin: "0 0 12px", fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 18, color: C.text }}>Supprimer le profil</h3>
      <p style={{ margin: "0 0 28px", fontFamily: "Inter, sans-serif", fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>Cette action est irréversible. Votre profil corporel et toutes les données associées seront supprimés définitivement.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <FL_Button type="ghost" label="Annuler" state="rest" />
        <FL_Button type="destructive" label="Supprimer le profil" state="rest" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH 3 — MANIPULATION HANDLES
// ═══════════════════════════════════════════════════════════════════════════════

type HandleState = "rest" | "hover" | "active" | "locked";

function FL_BracketHandle({ state = "rest" }: { state?: HandleState }) {
  const color = state === "locked" ? C.ember : C.gold;
  const op = state === "hover" ? 0.6 : 1;
  const dash = state === "locked" ? "6 4" : "none";
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      {/* One corner bracket — 40dmm arms, 4dmm thick */}
      <path d="M6 20 L6 6 L20 6" stroke={color} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={op} strokeDasharray={dash} />
    </svg>
  );
}

function FL_BracketSet({ state = "rest" }: { state?: HandleState }) {
  const color = state === "locked" ? C.ember : C.gold;
  const op = state === "hover" ? 0.6 : 1;
  const dash = state === "locked" ? "4 3" : "none";
  const s = "M0 10 L0 0 L10 0";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      {/* 8 brackets at corners and midpoints of a box */}
      <g stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={op} strokeDasharray={dash}>
        <path d={`M5 20 L5 5 L20 5`} />
        <path d={`M75 20 L75 5 L60 5`} />
        <path d={`M5 60 L5 75 L20 75`} />
        <path d={`M75 60 L75 75 L60 75`} />
        <path d={`M30 5 L50 5`} />
        <path d={`M30 75 L50 75`} />
        <path d={`M5 30 L5 50`} />
        <path d={`M75 30 L75 50`} />
      </g>
    </svg>
  );
}

function FL_CornerHandle({ state = "rest" }: { state?: HandleState }) {
  const color = state === "hover" ? C.gold : state === "active" ? C.gold : C.gold;
  const op = state === "hover" ? 0.7 : state === "active" ? 1 : 0.85;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="10" fill={color} fillOpacity={op} stroke={color} strokeWidth="2" />
      {state === "active" && <circle cx="24" cy="24" r="18" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />}
    </svg>
  );
}

function FL_EdgeHandle({ state = "rest" }: { state?: HandleState }) {
  const op = state === "hover" ? 0.7 : state === "active" ? 1 : 0.85;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <rect x="10" cy="24" y="16" width="28" height="16" rx="8" fill={C.gold} fillOpacity={op} />
      {state === "active" && <>
        <line x1="8" y1="24" x2="2" y2="24" stroke={C.gold} strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="24" x2="46" y2="24" stroke={C.gold} strokeWidth="2" strokeLinecap="round" />
      </>}
    </svg>
  );
}

function FL_FaceHandle({ state = "rest" }: { state?: HandleState }) {
  const op = state === "hover" ? 0.7 : state === "active" ? 1 : 0.85;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <ellipse cx="24" cy="24" rx="14" ry="6" fill={C.gold} fillOpacity={op} />
      {state === "active" && <path d="M24 16 L24 8" stroke={C.gold} strokeWidth="2" strokeLinecap="round" markerEnd="url(#arr)" />}
    </svg>
  );
}

function FL_RotationRing({ axis = "y", state = "rest" }: { axis?: "x" | "y" | "z"; state?: HandleState }) {
  const axisColor: Record<string, string> = { x: C.ember, y: C.gold, z: C.info };
  const color = axisColor[axis];
  const op = state === "rest" ? 0.8 : state === "hover" ? 1 : 1;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="5" opacity={op} strokeLinecap="round"
        transform={axis === "x" ? "rotate(90 40 40) scaleY(0.3) translate(0 28)" : axis === "z" ? "scaleY(0.3) translate(0 28)" : ""} />
      {(state === "hover") ? (
        <circle cx="40" cy="8" r="4" fill={color} />
      ) : null}
      {state === "active" && (
        <g>
          <circle cx="40" cy="8" r="4" fill={color} />
          {/* Degree readout chip */}
          <rect x="50" y="2" width="36" height="18" rx="4" fill="rgba(13,11,8,0.88)" stroke={color} strokeWidth="1" />
          <text x="68" y="14" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill={color} fontWeight="600">+24°</text>
        </g>
      )}
    </svg>
  );
}

function FL_NodeHandle({ state = "rest" }: { state?: HandleState }) {
  const isAuto = state === "rest"; // auto = hollow (derived)
  const isLocked = state === "locked";
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="10"
        fill={isAuto ? "none" : isLocked ? C.ember : state === "active" ? C.gold : C.surface2}
        stroke={isLocked ? C.ember : C.gold}
        strokeWidth={isAuto ? "2" : "3"}
        fillOpacity={state === "hover" ? 0.5 : 1}
      />
      {isLocked && (
        <>
          <line x1="20" y1="20" x2="28" y2="28" stroke={C.ember} strokeWidth="2" strokeLinecap="round" />
          <line x1="28" y1="20" x2="20" y2="28" stroke={C.ember} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function FL_ReadoutScale() {
  return (
    <div style={{ position: "relative", width: 220, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Connecting line */}
      <div style={{ position: "absolute", left: 20, right: 20, top: "50%", height: 2, background: C.gold, transform: "translateY(-50%)" }} />
      {/* Grip points */}
      <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: "50%", background: C.gold }} />
      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: "50%", background: C.gold }} />
      {/* Midpoint chip */}
      <div style={{ background: "rgba(13,11,8,0.9)", border: `1px solid ${C.gold}`, borderRadius: 8, padding: "4px 12px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontSize: 16, color: C.gold }}>1.42×</span>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textSec }}>2.84 m × 1.96 m</span>
      </div>
    </div>
  );
}

function FL_ReadoutMeasure({ variant = "horizontal" }: { variant?: "horizontal" | "vertical" | "angled" }) {
  const isV = variant === "vertical";
  const isA = variant === "angled";
  return (
    <svg width={isV ? 60 : 200} height={isV ? 120 : 60} viewBox={isV ? "0 0 60 120" : "0 0 200 60"}>
      {/* Dimension line */}
      {!isV && !isA && <>
        <line x1="20" y1="30" x2="180" y2="30" stroke={C.gold} strokeWidth="1.5" />
        <line x1="20" y1="22" x2="20" y2="38" stroke={C.gold} strokeWidth="1.5" />
        <line x1="180" y1="22" x2="180" y2="38" stroke={C.gold} strokeWidth="1.5" />
        {/* Label chip */}
        <rect x="72" y="18" width="56" height="24" rx="4" fill="rgba(13,11,8,0.9)" stroke={C.gold} strokeWidth="1" />
        <text x="100" y="33" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fill={C.gold} fontWeight="600">3.2 m</text>
      </>}
      {isV && <>
        <line x1="30" y1="15" x2="30" y2="105" stroke={C.gold} strokeWidth="1.5" />
        <line x1="22" y1="15" x2="38" y2="15" stroke={C.gold} strokeWidth="1.5" />
        <line x1="22" y1="105" x2="38" y2="105" stroke={C.gold} strokeWidth="1.5" />
        <rect x="6" y="52" width="48" height="20" rx="4" fill="rgba(13,11,8,0.9)" stroke={C.gold} strokeWidth="1" />
        <text x="30" y="65" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill={C.gold} fontWeight="600">1.85 m</text>
      </>}
      {isA && <>
        <line x1="20" y1="45" x2="175" y2="15" stroke={C.gold} strokeWidth="1.5" />
        <line x1="12" y1="40" x2="28" y2="50" stroke={C.gold} strokeWidth="1.5" />
        <line x1="167" y1="10" x2="183" y2="20" stroke={C.gold} strokeWidth="1.5" />
        <rect x="82" y="20" width="48" height="20" rx="4" fill="rgba(13,11,8,0.9)" stroke={C.gold} strokeWidth="1" />
        <text x="106" y="33" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill={C.gold} fontWeight="600">4.1 m</text>
      </>}
    </svg>
  );
}

// FL_Handle/TargetLock — 3 frames + locked state
function FL_TargetLock({ frame = 3 }: { frame?: 0 | 1 | 2 | 3 }) {
  const convergence = [0.6, 0.8, 0.95, 1.0][frame];
  const cx = 40, cy = 40, size = 24;
  const offset = size * convergence;
  return (
    <svg width="80" height="90" viewBox="0 0 80 90">
      {/* Four converging brackets */}
      {[
        [cx - offset, cy - offset, "M0 10 L0 0 L10 0"],   // TL
        [cx + offset - 10, cy - offset, "M0 0 L10 0 L10 10"], // TR
        [cx - offset, cy + offset - 10, "M0 0 L0 10 L10 10"], // BL
        [cx + offset - 10, cy + offset - 10, "M10 0 L10 10 L0 10"], // BR
      ].map(([x, y, d], i) => (
        <path key={i} d={d as string} stroke={frame === 3 ? C.gold : C.info} strokeWidth="3" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          transform={`translate(${x}, ${y})`}
          opacity={frame === 3 ? 1 : 0.6 + (frame * 0.15)} />
      ))}
      {/* Center dot when locked */}
      {frame === 3 && <circle cx={cx} cy={cy} r="3" fill={C.gold} />}
      {/* Name label beneath */}
      {frame === 3 && (
        <>
          <rect x="14" y="70" width="52" height="16" rx="4" fill="rgba(13,11,8,0.9)" stroke={`rgba(255,198,26,0.3)`} strokeWidth="1" />
          <text x="40" y="81" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="9" fill={C.gold} fontWeight="600">VITRUVIAN SQ.</text>
        </>
      )}
    </svg>
  );
}

// ─── Icon grid from command registry ────────────────────────────────────────────
function IconSet() {
  type IconDef = { id: string; path: string };
  const icons: IconDef[] = [
    { id: "icon_star", path: "M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" },
    { id: "icon_x", path: "M4 4 L20 20 M20 4 L4 20" },
    { id: "icon_replay", path: "M12 4 L8 8 L12 12 M8 8 A8 8 0 1 1 4.5 14" },
    { id: "icon_pin", path: "M12 2 L16 8 L22 8 L16 14 L17 22 L12 19 L7 22 L8 14 L2 8 L8 8 Z" },
    { id: "icon_chevron", path: "M8 5 L16 12 L8 19" },
    { id: "icon_list", path: "M3 7 L21 7 M3 12 L21 12 M3 17 L21 17" },
    { id: "icon_map", path: "M9 3 L3 6 L3 21 L9 18 L15 21 L21 18 L21 3 L15 6 Z M9 3 L9 18 M15 6 L15 21" },
    { id: "icon_teleport", path: "M12 2 L12 8 M12 16 L12 22 M2 12 L8 12 M16 12 L22 12 M12 8 L8 16 L12 14 L16 16 Z" },
    { id: "icon_move", path: "M12 2 L9 6 L12 4 L15 6 Z M12 22 L9 18 L12 20 L15 18 Z M2 12 L6 9 L4 12 L6 15 Z M22 12 L18 9 L20 12 L18 15 Z M12 12 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0" },
    { id: "icon_recenter", path: "M3 12 A9 9 0 0 0 12 21 A9 9 0 0 0 21 12 M12 8 L12 16 M8 12 L16 12" },
    { id: "icon_home", path: "M3 12 L12 3 L21 12 V21 H15 V16 H9 V21 H3 Z" },
    { id: "icon_search", path: "M11 3 A8 8 0 1 0 11 19 A8 8 0 0 0 11 3 Z M21 21 L16.65 16.65" },
    { id: "icon_bookmark", path: "M5 3 H19 A1 1 0 0 1 20 4 V21 L12 17 L4 21 V4 A1 1 0 0 1 5 3 Z" },
    { id: "icon_back", path: "M19 12 H5 M5 12 L11 6 M5 12 L11 18" },
    { id: "icon_cursor", path: "M5 3 L5 18 L9 15 L12 21 L14 20 L11 14 L16 14 Z" },
    { id: "icon_rotate", path: "M12 4 A8 8 0 0 1 20 12 M20 12 L16 8 M4 12 A8 8 0 0 0 12 20 M4 12 L8 16" },
    { id: "icon_scale", path: "M14 5 L19 5 L19 10 M10 19 L5 19 L5 14 M19 5 L12 12 M5 19 L12 12" },
    { id: "icon_ruler", path: "M5 5 L19 19 M5 5 L3 8 M8 5 L6.5 7 M11 8 L9.5 10 M14 11 L12.5 13 M8 19 L19 19 L19 8" },
    { id: "icon_grab", path: "M8 12 L8 6 A1 1 0 0 1 10 6 L10 12 M10 11 L10 5 A1 1 0 0 1 12 5 L12 11 M12 11 L12 5 A1 1 0 0 1 14 5 L14 11 M14 12 L14 7 A1 1 0 0 1 16 7 L16 18 C16 20 14 22 12 22 L9 22 C7 22 5 20 5 18 L5 15 C5 13.3 6.3 12 8 12" },
    { id: "icon_chain", path: "M10 13 A5 5 0 0 0 14 13 M9 9 L6 6 A3.5 3.5 0 0 0 6 11 L9 14 M15 9 L18 6 A3.5 3.5 0 0 1 18 11 L15 14" },
    { id: "icon_grid", path: "M3 3 H21 V21 H3 Z M3 9 H21 M3 15 H21 M9 3 V21 M15 3 V21" },
    { id: "icon_copy", path: "M8 8 H20 V20 H8 Z M4 4 H16 V8" },
    { id: "icon_trash", path: "M3 6 H21 M8 6 V4 H16 V6 M19 6 L18 20 H6 L5 6" },
    { id: "icon_undo", path: "M9 14 L3 8 L9 2 M3 8 H15 A6 6 0 0 1 15 20 H12" },
    { id: "icon_redo", path: "M15 14 L21 8 L15 2 M21 8 H9 A6 6 0 0 0 9 20 H12" },
    { id: "icon_reset", path: "M12 3 A9 9 0 1 0 19.5 7 M19.5 3 L19.5 7 L15.5 7" },
    { id: "icon_lock", path: "M8 11 V8 A4 4 0 0 1 16 8 V11 M5 11 H19 V21 H5 Z M12 16 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0" },
    { id: "icon_vitruvian", path: "M12 3 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M12 7 L10 14 L7 22 M12 7 L14 14 L17 22 M12 7 L12 16 M10 14 L14 14 M8 10 L16 10" },
    { id: "icon_sliders", path: "M4 6 H20 M4 12 H20 M4 18 H20 M8 4 V8 M16 10 V14 M10 16 V20" },
    { id: "icon_scan", path: "M3 7 V4 H6 M21 7 V4 H18 M3 17 V20 H6 M21 17 V20 H18 M8 12 L11 15 L16 9" },
    { id: "icon_shield", path: "M12 2 L4 6 V13 C4 17.4 7.4 21.5 12 22 C16.6 21.5 20 17.4 20 13 V6 Z M9 12 L11 14 L15 10" },
    { id: "icon_pencil", path: "M15 5 L19 9 L8 20 L3 21 L4 16 Z M15 5 L17 3 A1.4 1.4 0 0 1 21 7 L19 9" },
    { id: "icon_mirror", path: "M12 3 V21 M5 7 L9 12 L5 17 M19 7 L15 12 L19 17" },
    { id: "icon_units", path: "M3 6 H21 M3 12 H14 M3 18 H9 M17 15 H21 M19 12 V21" },
    { id: "icon_node", path: "M12 12 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M12 3 V8 M12 16 V21 M3 12 H8 M16 12 H21" },
    { id: "icon_ghost", path: "M12 2 A7 7 0 0 0 5 9 V20 L7.5 18 L10 20 L12 18 L14 20 L16.5 18 L19 20 V9 A7 7 0 0 0 12 2 Z M9.5 10 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M14.5 10 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0" },
    { id: "icon_save", path: "M19 21 H5 A2 2 0 0 1 3 19 V5 A2 2 0 0 1 5 3 H16 L21 8 V19 A2 2 0 0 1 19 21 Z M17 21 V13 H7 V21 M7 3 V8 H15" },
    { id: "icon_export", path: "M21 15 V19 A2 2 0 0 1 19 21 H5 A2 2 0 0 1 3 19 V15 M17 8 L12 3 L7 8 M12 3 V15" },
    { id: "icon_avatar", path: "M12 2 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4 22 A8 8 0 0 1 20 22" },
    { id: "icon_info", path: "M12 3 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 8 V12 M12 16 V16.5" },
    { id: "icon_key", path: "M8 11 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M13 11 H21 M18 11 V14 M15 11 V13.5" },
    { id: "icon_document", path: "M14 2 H6 A2 2 0 0 0 4 4 V20 A2 2 0 0 0 6 22 H18 A2 2 0 0 0 20 20 V8 Z M14 2 V8 H20 M16 13 H8 M16 17 H8 M10 9 H8" },
    { id: "icon_cart", path: "M6 2 L3 6 V7 H21 L19 15 H7 L5 7 M9 21 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 M20 21 m-1 0 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0" },
    { id: "icon_card", path: "M2 6 H22 V18 H2 Z M2 10 H22" },
    { id: "icon_garment", path: "M9 2 L7 4 L3 5 L5 12 L8 10 L8 22 H16 V10 L19 12 L21 5 L17 4 L15 2 C14 4 10 4 9 2 Z" },
    { id: "icon_palette", path: "M12 2 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 17 m-2 0 a2 2 0 1 0 4 0 A5 5 0 0 0 12 12 A5 5 0 0 0 12 17" },
    { id: "icon_person_add", path: "M12 2 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4 22 A8 8 0 0 1 20 22 M19 8 V14 M16 11 H22" },
    { id: "icon_mic_off", path: "M8 8 L8 12 A4 4 0 0 0 12 16 A4 4 0 0 0 15.5 14.5 M12 2 m-4 0 a4 4 0 0 1 4 4 V12 M3 3 L21 21 M12 16 V20 M8 20 H16" },
    { id: "icon_people", path: "M9 6 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M2 20 A7 7 0 0 1 16 20 M16 6 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M22 20 A5 5 0 0 0 16 15" },
    { id: "icon_exit", path: "M16 17 L21 12 L16 7 M21 12 H9 M9 21 H5 A2 2 0 0 1 3 19 V5 A2 2 0 0 1 5 3 H9" },
    { id: "icon_gear", path: "M12 2 m-1.5 0 v2.3 A8 8 0 0 0 6.2 6 L4.5 4.5 L3 6 L4.5 7.5 A8 8 0 0 0 2.5 12 H0.5 V13.5 H2.5 A8 8 0 0 0 4.5 16.5 L3 18 L4.5 19.5 L6 18 A8 8 0 0 0 10.5 20 V22 H13.5 V20 A8 8 0 0 0 17.8 18 L19.5 19.5 L21 18 L19.5 16.5 A8 8 0 0 0 21.5 12 H23.5 V10.5 H21.5 A8 8 0 0 0 19.5 7.5 L21 6 L19.5 4.5 L18 6 A8 8 0 0 0 13.5 4.3 V2 Z M12 9 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0" },
    { id: "icon_help", path: "M12 2 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M9 9 A3 3 0 0 1 15 9 C15 11.5 12 12 12 14 M12 17 V18" },
    { id: "icon_controller", path: "M8 5 H16 A6 6 0 0 1 22 11 L21 19 A3 3 0 0 1 18 22 L17 18 H7 L6 22 A3 3 0 0 1 3 19 L2 11 A6 6 0 0 1 8 5 Z M12 8 V14 M9 11 H15" },
    { id: "icon_opacity", path: "M12 3 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 3 V21 A9 9 0 0 0 12 3 Z" },
    { id: "icon_language", path: "M2 12 H22 M2 12 A10 10 0 0 0 22 12 M2 12 A10 10 0 0 1 22 12 M12 2 A10 10 0 0 1 12 22 M12 2 A10 10 0 0 0 12 22 M2 12 m-10 0 a10 10 0 1 0 20 0" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {icons.map(({ id, path }) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d={path} stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 8, color: C.textTert, textAlign: "center", maxWidth: 48, lineHeight: 1.2 }}>{id.replace("icon_", "")}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Interactive state cycler ───────────────────────────────────────────────────
function StateCycler({ children, initialState = "rest" }: {
  children: (s: CompState) => React.ReactNode; initialState?: CompState;
}) {
  const [s, setS] = useState<CompState>(initialState);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* State matrix row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {STATES.map(st => (
          <StateCell key={st} s={st}>
            <div onClick={() => setS(st)} style={{ cursor: "pointer" }}>
              {children(st)}
            </div>
          </StateCell>
        ))}
      </div>
    </div>
  );
}

// ─── Coverage frame ─────────────────────────────────────────────────────────────
function CoverageFrame() {
  const items = [
    { batch: 1, name: "FL_Glyph/Controller", variants: "12 glyphs" },
    { batch: 1, name: "FL_Glyph/Hands", variants: "12 glyphs" },
    { batch: 1, name: "FL_Glyph/Dwell", variants: "8 frames" },
    { batch: 2, name: "FL_Button", variants: "4 types × 6 states × 3 width modes = 72" },
    { batch: 2, name: "FL_IconButton", variants: "2 types × 6 states = 12" },
    { batch: 2, name: "FL_Toggle", variants: "On/Off × 6 states = 12" },
    { batch: 2, name: "FL_Slider", variants: "3 variants × 6 states = 18" },
    { batch: 2, name: "FL_ScrubStrip", variants: "2 states (Rest, Dragging)" },
    { batch: 2, name: "FL_Segmented", variants: "3 segment counts × 6 states = 18" },
    { batch: 2, name: "FL_ListRow", variants: "5 variants × 6 states = 30" },
    { batch: 2, name: "FL_Chip", variants: "3 types × 6 states = 18" },
    { batch: 2, name: "FL_InputNumeric", variants: "4 states" },
    { batch: 2, name: "FL_InputText", variants: "4 states (Rest, Focused, Dictating, Filled)" },
    { batch: 2, name: "FL_Tooltip", variants: "4 directions" },
    { batch: 2, name: "FL_ConfirmModal", variants: "1 (uses FL_Button variants)" },
    { batch: 3, name: "FL_Handle/Bracket", variants: "3 states + Locked" },
    { batch: 3, name: "FL_Handle/BracketSet", variants: "3 states + Locked" },
    { batch: 3, name: "FL_Handle/Corner", variants: "Rest, Hover, Active + sibling-dimmed" },
    { batch: 3, name: "FL_Handle/Edge", variants: "Rest, Hover, Active + sibling-dimmed" },
    { batch: 3, name: "FL_Handle/Face", variants: "Rest, Hover, Active + sibling-dimmed" },
    { batch: 3, name: "FL_Handle/RotationRing", variants: "3 axes × 3 states = 9" },
    { batch: 3, name: "FL_Handle/Node", variants: "5 states (Rest/Auto, Hover, Drag, Lock, Measured)" },
    { batch: 3, name: "FL_Readout/Scale", variants: "1 + snap-passed flash" },
    { batch: 3, name: "FL_Readout/Measure", variants: "3 variants (H, V, Angled)" },
    { batch: 3, name: "FL_Handle/TargetLock", variants: "3 convergence frames + Locked" },
    { batch: 0, name: "FL_Icon/<icon_id>", variants: `${54} icons from command registry` },
  ];

  const batchColors: Record<number, string> = { 0: C.info, 1: C.success, 2: C.gold, 3: C.amber };
  const batchLabels: Record<number, string> = { 0: "ICONS", 1: "BATCH 1", 2: "BATCH 2", 3: "BATCH 3" };

  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: 24, border: `1px solid rgba(255,198,26,0.1)` }}>
      <h3 style={{ margin: "0 0 20px", fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 16, color: C.text, letterSpacing: "0.04em" }}>COVERAGE</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map(({ batch, name, variants }) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 6, background: "rgba(255,246,230,0.02)" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, color: batchColors[batch], minWidth: 52, letterSpacing: "0.06em" }}>{batchLabels[batch]}</span>
            <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 12, color: C.text, flex: 1 }}>{name}</span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: C.textTert }}>{variants}</span>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────────
export default function FaberlandComponents() {
  const [dwellFrame, setDwellFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDwellFrame(f => (f + 1) % 8), 300);
    return () => clearInterval(t);
  }, []);

  const handleStates: HandleState[] = ["rest", "hover", "active", "locked"];

  return (
    <div style={{ background: "#0D0B08", minHeight: "100vh", padding: "48px 48px 96px", color: C.text, fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: 56, borderBottom: `1px solid rgba(255,198,26,0.1)`, paddingBottom: 32 }}>
        <h1 style={{ margin: "0 0 8px", fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 32, color: C.gold, letterSpacing: "0.04em" }}>FL Component Bank</h1>
        <p style={{ margin: 0, color: C.textTert, fontSize: 13, letterSpacing: "0.08em" }}>FABERLAND XR · PAGE 01 COMPONENTS · QUEST 3 / 3S</p>
      </div>

      {/* ── BATCH 1: GLYPH SET ── */}
      <Section title="BATCH 1 — INPUT GLYPH SET" subtitle="48 dmm bounding box · 3 dmm min stroke · flat gold · no fill gradients">
        <ComponentRow label="FL_Glyph/Controller — 12 glyphs">
          {CONTROLLER_GLYPHS.map(g => (
            <GlyphCard key={g} label={g}><ControllerBody highlight={g} /></GlyphCard>
          ))}
        </ComponentRow>
        <ComponentRow label="FL_Glyph/Hands — 12 glyphs">
          {HAND_GLYPHS.map(g => (
            <GlyphCard key={g} label={g}><HandGlyph gesture={g} /></GlyphCard>
          ))}
        </ComponentRow>
        <ComponentRow label="FL_Glyph/Dwell — 8 frames, radial fill timer">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(f => (
            <GlyphCard key={f} label={`${Math.round(f / 7 * 100)}%`}>
              <DwellTimerRing frame={f} />
            </GlyphCard>
          ))}
        </ComponentRow>
      </Section>

      {/* ── BATCH 2: CORE COMPONENTS ── */}
      <Section title="BATCH 2 — CORE INTERACTIVE COMPONENTS" subtitle="Full state matrix · Rest · RayHover · PinchActive · Pressed · Disabled · Focused">

        {/* FL_Button — Primary */}
        <ComponentRow label="FL_Button — Type=Primary">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <FL_Button type="primary" label="Louer cet espace" state={s} />
            </StateCell>
          ))}
        </ComponentRow>
        <ComponentRow label="FL_Button — Type=Secondary">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <FL_Button type="secondary" label="Voir les conditions" state={s} />
            </StateCell>
          ))}
        </ComponentRow>
        <ComponentRow label="FL_Button — Type=Ghost">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <FL_Button type="ghost" label="Annuler" state={s} />
            </StateCell>
          ))}
        </ComponentRow>
        <ComponentRow label="FL_Button — Type=Destructive">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <FL_Button type="destructive" label="Supprimer le profil" state={s} />
            </StateCell>
          ))}
        </ComponentRow>

        {/* FL_IconButton */}
        <ComponentRow label="FL_IconButton — Type=Default">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <FL_IconButton state={s} icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              } />
            </StateCell>
          ))}
        </ComponentRow>
        <ComponentRow label="FL_IconButton — Type=Destructive">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <FL_IconButton type="destructive" state={s} icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              } />
            </StateCell>
          ))}
        </ComponentRow>

        {/* FL_Toggle */}
        <ComponentRow label="FL_Toggle — On / Off × state matrix">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <FL_Toggle on={true} state={s} label="Aimantation" />
                <FL_Toggle on={false} state={s} label="Aimantation" />
              </div>
            </StateCell>
          ))}
        </ComponentRow>

        {/* FL_Slider */}
        <ComponentRow label="FL_Slider — Plain">
          {STATES.map(s => <StateCell key={s} s={s}><FL_Slider variant="plain" value={65} state={s} /></StateCell>)}
        </ComponentRow>
        <ComponentRow label="FL_Slider — WithValue">
          {STATES.map(s => <StateCell key={s} s={s}><FL_Slider variant="withvalue" value={72} state={s} /></StateCell>)}
        </ComponentRow>
        <ComponentRow label="FL_Slider — WithTicks">
          {STATES.map(s => <StateCell key={s} s={s}><FL_Slider variant="withticks" value={50} state={s} /></StateCell>)}
        </ComponentRow>

        {/* FL_ScrubStrip */}
        <ComponentRow label="FL_ScrubStrip — Rest / Dragging">
          {(["rest", "rayhover"] as CompState[]).map(s => <StateCell key={s} s={s}><FL_ScrubStrip state={s} /></StateCell>)}
        </ComponentRow>

        {/* FL_Segmented */}
        <ComponentRow label="FL_Segmented — 2 / 3 / 4 segments">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FL_Segmented options={["cm", "in"]} selected={0} state={s} />
                <FL_Segmented options={["Move", "Rotate", "Scale"]} selected={1} state={s} />
                <FL_Segmented options={["FR", "EN", "DE", "JP"]} selected={0} state={s} />
              </div>
            </StateCell>
          ))}
        </ComponentRow>

        {/* FL_ListRow */}
        <ComponentRow label="FL_ListRow — Variants">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["default", "withvalue", "withbadge", "selected", "conflicted"] as ListRowVariant[]).map(v => (
              <FL_ListRow key={v} variant={v} label="Examiner l'espace" value={v === "withvalue" ? "3.2 m²" : undefined} badge={v === "withbadge" ? "NEW" : undefined} state="rest" />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 32 }}>
            {(["rest", "rayhover", "pinchactive", "pressed"] as CompState[]).map(s => (
              <FL_ListRow key={s} label="Louer cet espace" value="$4 200/mo" state={s} />
            ))}
          </div>
        </ComponentRow>

        {/* FL_Chip */}
        <ComponentRow label="FL_Chip — Suggestion / Filter / Colour">
          {STATES.map(s => (
            <StateCell key={s} s={s}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <FL_Chip type="suggestion" label="Essayer sur moi" state={s} />
                <FL_Chip type="filter" label="Disponible" state={s} />
                <FL_Chip type="colour" label="Noir mat" colour="#222" state={s} />
              </div>
            </StateCell>
          ))}
        </ComponentRow>

        {/* FL_InputNumeric */}
        <ComponentRow label="FL_InputNumeric — Rest / RayHover / Editing / Invalid">
          {(["rest", "rayhover", "pinchactive", "pressed", "disabled", "focused"] as CompState[]).map(s => (
            <StateCell key={s} s={s}><FL_InputNumeric value="185" unit="cm" state={s} /></StateCell>
          ))}
        </ComponentRow>

        {/* FL_InputText */}
        <ComponentRow label="FL_InputText — Rest / Focused / Dictating / Filled">
          {STATES.map(s => <StateCell key={s} s={s}><FL_InputText state={s} /></StateCell>)}
        </ComponentRow>

        {/* FL_Tooltip */}
        <ComponentRow label="FL_Tooltip — Above / Below / Left / Right">
          {(["above", "below", "left", "right"] as TooltipDir[]).map(d => (
            <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <FL_Tooltip dir={d} text="Louer cet espace" />
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{d}</p>
            </div>
          ))}
        </ComponentRow>

        {/* FL_ConfirmModal */}
        <ComponentRow label="FL_ConfirmModal — Destructive confirm (Ghost cancel left, Destructive right)">
          <FL_ConfirmModal />
        </ComponentRow>
      </Section>

      {/* ── BATCH 3: HANDLES ── */}
      <Section title="BATCH 3 — MANIPULATION HANDLES" subtitle="World-space gizmos · flat for library · developer places in 3D">

        <ComponentRow label="FL_Handle/Bracket — single bracket">
          {handleStates.map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_BracketHandle state={s} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{s}</p>
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Handle/BracketSet — 8-bracket assembly">
          {handleStates.map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_BracketSet state={s} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{s}</p>
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Handle/Corner — sphere, uniform scale">
          {(["rest", "hover", "active"] as HandleState[]).map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_CornerHandle state={s} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{s}</p>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8, position: "relative" }}>
              <FL_CornerHandle state="rest" />
              <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "rgba(13,11,8,0.5)" }} />
            </div>
            <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>sibling-dimmed</p>
          </div>
        </ComponentRow>

        <ComponentRow label="FL_Handle/Edge — capsule, single-axis scale">
          {(["rest", "hover", "active"] as HandleState[]).map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_EdgeHandle state={s} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{s}</p>
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Handle/Face — flat disc, push-pull">
          {(["rest", "hover", "active"] as HandleState[]).map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_FaceHandle state={s} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{s}</p>
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Handle/RotationRing — X=ember · Y=gold · Z=info">
          {(["x", "y", "z"] as ("x" | "y" | "z")[]).map(axis => (
            <div key={axis} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(["rest", "hover", "active"] as HandleState[]).map(s => (
                <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                    <FL_RotationRing axis={axis} state={s} />
                  </div>
                  <p style={{ margin: "6px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{axis.toUpperCase()} · {s}</p>
                </div>
              ))}
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Handle/Node — Rest(auto/hollow) · Hover · Drag · Lock · Measured">
          {(["rest", "hover", "active", "locked"] as HandleState[]).map(s => (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_NodeHandle state={s} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{s === "rest" ? "auto (hollow)" : s}</p>
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Readout/Scale — connecting line + midpoint chip + snap flash">
          <div style={{ background: C.surface, borderRadius: 12, padding: 16 }}>
            <FL_ReadoutScale />
          </div>
        </ComponentRow>

        <ComponentRow label="FL_Readout/Measure — Horizontal · Vertical · Angled">
          {(["horizontal", "vertical", "angled"] as ("horizontal" | "vertical" | "angled")[]).map(v => (
            <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ background: C.surface, borderRadius: 8, padding: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FL_ReadoutMeasure variant={v} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{v}</p>
            </div>
          ))}
        </ComponentRow>

        <ComponentRow label="FL_Handle/TargetLock — 3 convergence frames + locked resting state">
          {([0, 1, 2, 3] as (0 | 1 | 2 | 3)[]).map(f => (
            <div key={f} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 96, height: 96, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, borderRadius: 8 }}>
                <FL_TargetLock frame={f} />
              </div>
              <p style={{ margin: "8px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{f < 3 ? `Frame ${f + 1}` : "Locked"}</p>
            </div>
          ))}
        </ComponentRow>
      </Section>

      {/* ── ICON REGISTRY ── */}
      <Section title="FL_Icon — Command Registry" subtitle={`54 icon IDs from faberland_command_registry.csv · naming: FL_Icon/<icon_id>`}>
        <IconSet />
      </Section>

      {/* ── COVERAGE FRAME ── */}
      <CoverageFrame />
    </div>
  );
}
