import { useState, useEffect, useRef } from "react";
import QuestController from "./QuestController";
import { ScreenInputGlyphs, ScreenManipulation, ScreenHUD, ScreenVitruvianEditor } from "./FaberlandScreens2";
import FaberlandComponents from "./FaberlandComponents";
import ScreenMeasurementStudio from "./ScreenMeasurementStudio";

// ─── Faberland Star ────────────────────────────────────────────────────────────
type StarState = "dormant" | "wake" | "listening" | "thinking" | "speaking" | "error";
type StarSize = "small" | "default" | "hero";

function FaberStar({
  state = "dormant",
  size = "default",
  className = "",
}: {
  state?: StarState;
  size?: StarSize;
  className?: string;
}) {
  const dims: Record<StarSize, number> = { small: 36, default: 80, hero: 200 };
  const d = dims[size];

  const animClass: Record<StarState, string> = {
    dormant: "",
    wake: "animate-star-wake",
    listening: "animate-star-listen",
    thinking: "animate-star-think",
    speaking: "animate-star-speak",
    error: "",
  };

  const filterMap: Record<StarState, string> = {
    dormant: "none",
    wake: "drop-shadow(0 0 16px rgba(255,198,26,0.7)) drop-shadow(0 0 32px rgba(255,100,0,0.4))",
    listening: "drop-shadow(0 0 12px rgba(255,198,26,0.5))",
    thinking: "drop-shadow(0 0 10px rgba(255,198,26,0.4))",
    speaking: "drop-shadow(0 0 14px rgba(255,198,26,0.6))",
    error: "drop-shadow(0 0 12px rgba(255,46,136,0.7)) hue-rotate(200deg)",
  };

  return (
    <img
      src="/src/assets/faberland-logo-3.png"
      alt="Faberland"
      className={`${animClass[state]} ${className}`}
      style={{
        width: d,
        height: d,
        objectFit: "contain",
        opacity: state === "dormant" ? 0.35 : 1,
        filter: filterMap[state],
        transition: "opacity 0.4s ease, filter 0.4s ease",
      }}
    />
  );
}

// ─── Gold gradient text helper ─────────────────────────────────────────────────
function GoldText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        background: "linear-gradient(135deg, #FFC61A 0%, #F5A81C 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {children}
    </span>
  );
}

// ─── Panel chrome wrapper ──────────────────────────────────────────────────────
function Panel({
  children,
  primary = false,
  grabHandle = false,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  primary?: boolean;
  grabHandle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`panel-chrome ${primary ? "panel-chrome-primary" : ""} ${grabHandle ? "grab-handle" : ""} ${className}`}
      style={{
        background: "rgba(13, 11, 8, 0.72)",
        border: "none",
        position: "relative",
        ...style,
      }}
    >
      {/* Gold top edge */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(255,198,26,0.6) 20%, rgba(255,198,26,0.6) 80%, transparent)",
          borderRadius: primary ? "24px 24px 0 0" : "16px 16px 0 0",
        }}
      />
      {children}
      {grabHandle && (
        <div style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 4,
          background: "#FFC61A",
          borderRadius: 2,
        }} />
      )}
    </div>
  );
}

// ─── Button component ──────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "ghost" | "destructive";
function Btn({
  children,
  variant = "secondary",
  onClick,
  fullWidth = false,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  onClick?: () => void;
  fullWidth?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    padding: "0 28px",
    borderRadius: 12,
    fontFamily: "Inter, sans-serif",
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: "0.01em",
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s ease",
    width: fullWidth ? "100%" : undefined,
    userSelect: "none",
  };

  const variantStyles: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: pressed ? "#F5A81C" : hovered ? "#FFD44A" : "#FFC61A",
      color: "#0D0B08",
      boxShadow: hovered && !pressed ? "0 0 20px rgba(255,198,26,0.3)" : "none",
    },
    secondary: {
      background: pressed ? "#2A2420" : hovered ? "#231E17" : "#1A1611",
      color: "#FFF6E6",
      outline: `1.5px solid ${hovered ? "rgba(255,198,26,0.5)" : "rgba(255,246,230,0.12)"}`,
    },
    ghost: {
      background: pressed ? "rgba(255,198,26,0.08)" : hovered ? "rgba(255,198,26,0.05)" : "transparent",
      color: hovered ? "#FFC61A" : "#C9BFB0",
    },
    destructive: {
      background: pressed ? "#CC0060" : hovered ? "#FF4499" : "#FF2E88",
      color: "#FFF6E6",
    },
  };

  return (
    <button
      style={{ ...baseStyle, ...variantStyles[variant] }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {children}
    </button>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 18px",
        borderRadius: 100,
        background: hovered ? "rgba(255,198,26,0.12)" : "rgba(255,246,230,0.06)",
        border: `1.5px solid ${hovered ? "rgba(255,198,26,0.5)" : "rgba(255,246,230,0.1)"}`,
        color: hovered ? "#FFC61A" : "#C9BFB0",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// ─── Waveform animation ────────────────────────────────────────────────────────
function Waveform() {
  const bars = 32;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 48 }}>
      <style>{`
        @keyframes waveBar {
          0%, 100% { transform: scaleY(0.15); }
          50%       { transform: scaleY(1); }
        }
      `}</style>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: "100%",
            background: "#FFC61A",
            borderRadius: 2,
            transformOrigin: "center",
            animation: `waveBar ${0.6 + Math.random() * 0.8}s ${Math.random() * 0.5}s ease-in-out infinite`,
            opacity: 0.7 + Math.random() * 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ─── Confidence meter ──────────────────────────────────────────────────────────
function ConfidenceMeter({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, fontWeight: 500, width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: "rgba(255,246,230,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${value}%`,
          background: value > 90 ? "#3DD68C" : value > 70 ? "#FFC61A" : "#5BC8FF",
          borderRadius: 2,
          transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{ color: "#C9BFB0", fontFamily: "Inter", fontSize: 12, fontWeight: 600, width: 36, textAlign: "right" }}>{value}%</span>
    </div>
  );
}

// ─── Screen definitions ────────────────────────────────────────────────────────
type ScreenId =
  | "dormant" | "wake" | "listening" | "thinking" | "response"
  | "palm-menu" | "vitruvian-scan" | "vitruvian-results"
  | "property" | "notification" | "error-states" | "onboarding"
  | "input-glyphs" | "manipulation" | "hud-layer" | "vitruvian-editor" | "measurement-studio";

const SCREENS: { id: ScreenId; label: string; group?: string }[] = [
  { id: "dormant",           label: "01 · Dormant",            group: "Assistant Flow" },
  { id: "wake",              label: "02 · Wake",               group: "Assistant Flow" },
  { id: "listening",         label: "03 · Listening",          group: "Assistant Flow" },
  { id: "thinking",          label: "04 · Thinking",           group: "Assistant Flow" },
  { id: "response",          label: "05 · Response Card",      group: "Assistant Flow" },
  { id: "palm-menu",         label: "06 · Palm Menu",          group: "Assistant Flow" },
  { id: "vitruvian-scan",    label: "09 · Vitruvian Scan",     group: "Assistant Flow" },
  { id: "vitruvian-results", label: "10 · Vitruvian Results",  group: "Assistant Flow" },
  { id: "property",          label: "11 · Property Panel",     group: "Assistant Flow" },
  { id: "notification",      label: "13 · Notification",       group: "Assistant Flow" },
  { id: "error-states",      label: "15 · Errors",             group: "Assistant Flow" },
  { id: "onboarding",        label: "16 · Onboarding",         group: "Assistant Flow" },
  { id: "input-glyphs",      label: "Input Glyphs",            group: "Input System" },
  { id: "manipulation",      label: "Manipulation",            group: "Input System" },
  { id: "hud-layer",         label: "HUD Layer",               group: "Input System" },
  { id: "vitruvian-editor",    label: "Body Editor",             group: "Input System" },
  { id: "measurement-studio", label: "Measurement Studio",      group: "Input System" },
];

// ─── Individual screens ────────────────────────────────────────────────────────

function ScreenDormant() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 24 }}>
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>HEAD-LOCKED · PERSISTENT</p>
      <FaberStar state="dormant" size="default" />
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 13 }}>Assistant dormant — periphery anchor</p>
    </div>
  );
}

function ScreenWake() {
  const [state, setState] = useState<StarState>("dormant");
  const [logoVisible, setLogoVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setState("wake"), 300);
    const t2 = setTimeout(() => setLogoVisible(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const reset = () => { setState("dormant"); setLogoVisible(false); };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 28 }}>
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        BOOT FRAME · BODY-LOCKED · 1.5m
      </p>

      {/* Radial glow + hero star logo */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          position: "absolute",
          width: 380, height: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,198,26,0.15) 0%, rgba(255,61,0,0.06) 50%, transparent 70%)",
        }} />
        <img
          src="/src/assets/faberland-logo-3.png"
          alt="Faberland Star"
          style={{
            width: 200,
            height: 200,
            objectFit: "contain",
            filter: state === "wake" ? "drop-shadow(0 0 32px rgba(255,198,26,0.6)) drop-shadow(0 0 64px rgba(255,100,0,0.3))" : "drop-shadow(0 0 12px rgba(255,198,26,0.3))",
            transition: "filter 0.8s ease",
            animation: state === "dormant" ? "none" : "starPulse 3s ease-in-out infinite",
          }}
        />
      </div>

      {/* Wordmark — appears after star animates, once per session */}
      <div style={{
        opacity: logoVisible ? 1 : 0,
        transform: logoVisible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}>
        <img
          src="/src/assets/faberland-wordmark.png"
          alt="Faberland"
          style={{ height: 72, display: "block", maxWidth: 480 }}
        />
        <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, margin: 0, letterSpacing: "0.1em" }}>
          Assistant initialising
          <span style={{ animation: "blink 1.2s step-end infinite" }}>…</span>
        </p>
      </div>

      <Btn variant="ghost" onClick={reset}>Reset</Btn>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}

function ScreenListening() {
  const [transcript, setTranscript] = useState("Take me to the commercial district near—");
  const partial = "...Vitruvian Square";
  const [shown, setShown] = useState("");
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      setShown(partial.slice(0, i));
      i++;
      if (i > partial.length) clearInterval(t);
    }, 60);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 0 }}>
      <Panel primary grabHandle className="" style={{ width: "100%", maxWidth: 720, padding: "40px 40px 52px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <FaberStar state="listening" size="small" />
            <div>
              <p style={{ color: "#8A8176", fontSize: 11, fontFamily: "Inter", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>BODY-LOCKED · LISTENING</p>
              <p style={{ color: "#C9BFB0", fontSize: 13, fontFamily: "Inter", margin: "2px 0 0" }}>Speak now — or say "cancel"</p>
            </div>
          </div>

          <Waveform />

          <div style={{
            background: "rgba(255,246,230,0.04)",
            borderRadius: 12,
            padding: "16px 20px",
            minHeight: 72,
          }}>
            <p style={{ color: "#FFF6E6", fontFamily: "Inter", fontSize: 15, fontWeight: 500, margin: 0, lineHeight: 1.6 }}>
              {transcript}
              <span style={{ color: "#FFC61A" }}>{shown}</span>
              <span style={{
                display: "inline-block", width: 2, height: 16, background: "#FFC61A",
                marginLeft: 2, verticalAlign: "middle",
                animation: "blink 1s step-end infinite",
              }} />
            </p>
            <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn variant="ghost">Cancel</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ScreenThinking() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 24 }}>
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>BODY-LOCKED · 1.5m · 1200×800 dmm</p>
      <FaberStar state="thinking" size="default" />
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 13 }}>Processing — no spinner, no chrome</p>
    </div>
  );
}

function ScreenResponse() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Panel primary grabHandle style={{ width: "100%", maxWidth: 720, padding: "36px 40px 52px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <FaberStar state="speaking" size="small" />
            <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>BODY-LOCKED · RESPONSE</p>
          </div>

          <div style={{ borderLeft: "3px solid #FFC61A", paddingLeft: 20 }}>
            <p style={{ color: "#FFF6E6", fontFamily: "Inter", fontSize: 16, fontWeight: 500, lineHeight: 1.65, margin: 0 }}>
              Vitruvian Square is a commercial hub in the East District, 340 meters from your current position. It hosts 24 leasable storefronts from 80 to 600 m², plus a central atrium available for experiences. Current occupancy is 71%.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            <Chip>Show available units</Chip>
            <Chip>Teleport there now</Chip>
            <Chip>Compare other districts</Chip>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 4 }}>
            <Btn variant="ghost">Dismiss</Btn>
            <Btn variant="secondary">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M8 2v12" stroke="#C9BFB0" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Pin panel
            </Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ScreenPalmMenu() {
  const sectors = [
    { label: "Navigate", icon: "◈" },
    { label: "Measure", icon: "⊙" },
    { label: "Properties", icon: "▣" },
    { label: "Commands", icon: "≡" },
    { label: "Settings", icon: "⊕" },
    { label: "Help", icon: "?" },
  ];
  const [active, setActive] = useState<number | null>(null);
  const r = 130;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16 }}>
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>HEAD-LOCKED · PALM UP</p>
      <div style={{ position: "relative", width: 360, height: 360 }}>
        {/* Center star */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
          <FaberStar state="dormant" size="small" />
        </div>
        {/* Radial sectors */}
        {sectors.map((s, i) => {
          const angle = (i * 360) / sectors.length - 90;
          const rad = (angle * Math.PI) / 180;
          const x = 180 + r * Math.cos(rad);
          const y = 180 + r * Math.sin(rad);
          const isActive = active === i;
          return (
            <button
              key={i}
              onClick={() => setActive(isActive ? null : i)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{
                position: "absolute",
                left: x - 44,
                top: y - 44,
                width: 88,
                height: 88,
                borderRadius: 16,
                background: isActive ? "rgba(255,198,26,0.18)" : "rgba(13,11,8,0.72)",
                border: `1.5px solid ${isActive ? "#FFC61A" : "rgba(255,246,230,0.1)"}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isActive ? "0 0 0 1px rgba(255,198,26,0.3)" : "none",
              }}
            >
              <span style={{ fontSize: 22, color: isActive ? "#FFC61A" : "#C9BFB0" }}>{s.icon}</span>
              <span style={{ fontFamily: "Inter", fontSize: 11, fontWeight: 600, color: isActive ? "#FFC61A" : "#8A8176", letterSpacing: "0.05em" }}>{s.label}</span>
            </button>
          );
        })}
        {/* Connecting lines */}
        <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="360" height="360">
          {sectors.map((_, i) => {
            const angle = (i * 360) / sectors.length - 90;
            const rad = (angle * Math.PI) / 180;
            const x2 = 180 + (r - 44) * Math.cos(rad);
            const y2 = 180 + (r - 44) * Math.sin(rad);
            return (
              <line key={i} x1="180" y1="180" x2={x2} y2={y2}
                stroke={active === i ? "rgba(255,198,26,0.3)" : "rgba(255,246,230,0.05)"}
                strokeWidth={active === i ? 1.5 : 1} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function ScreenVitruvianScan() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"posture" | "scanning" | "done">("posture");
  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(t); setPhase("done"); return 100; }
        return p + 2;
      });
    }, 80);
    return () => clearInterval(t);
  }, [phase]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Panel primary grabHandle style={{ width: "100%", maxWidth: 780, padding: "40px 48px 60px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontFamily: "Chakra Petch, sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 28, color: "#FFC61A", margin: 0 }}>VITRUVIAN</p>
              <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", margin: "4px 0 0" }}>Body Measurement System</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Posture", "Scan", "Results", "Confirm"].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 100,
                    background: i === 0 ? "#FFC61A" : "rgba(255,246,230,0.06)",
                    border: `1.5px solid ${i === 0 ? "#FFC61A" : "rgba(255,246,230,0.1)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "Inter", fontSize: 11, fontWeight: 700,
                    color: i === 0 ? "#0D0B08" : "#8A8176",
                  }}>{i + 1}</div>
                  {i < 3 && <div style={{ width: 16, height: 1, background: "rgba(255,246,230,0.1)" }} />}
                </div>
              ))}
            </div>
          </div>

          {phase === "posture" && (
            <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
              {/* T-pose silhouette */}
              <div style={{
                width: 200, height: 260,
                background: "rgba(255,246,230,0.04)",
                borderRadius: 16,
                border: "1.5px dashed rgba(255,198,26,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="100" height="160" viewBox="0 0 100 160" fill="none">
                  {/* Head */}
                  <circle cx="50" cy="16" r="12" stroke="#FFC61A" strokeWidth="2" />
                  {/* Body */}
                  <line x1="50" y1="28" x2="50" y2="100" stroke="#FFC61A" strokeWidth="2" />
                  {/* Arms */}
                  <line x1="8" y1="52" x2="92" y2="52" stroke="#FFC61A" strokeWidth="2" />
                  {/* Legs */}
                  <line x1="50" y1="100" x2="20" y2="155" stroke="#FFC61A" strokeWidth="2" />
                  <line x1="50" y1="100" x2="80" y2="155" stroke="#FFC61A" strokeWidth="2" />
                </svg>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ color: "#FFF6E6", fontFamily: "Inter", fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.5 }}>Assume T-pose</p>
                <p style={{ color: "#C9BFB0", fontFamily: "Inter", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                  Stand with arms extended horizontally, palms facing forward. Keep feet shoulder-width apart. Hold still for 3 seconds once the scan begins.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {["Arms fully extended, parallel to ground", "Palms forward, fingers together", "Look straight ahead, neutral expression"].map((tip, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 100, background: "#FFC61A", flexShrink: 0 }} />
                      <span style={{ color: "#C9BFB0", fontFamily: "Inter", fontSize: 13 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {phase === "scanning" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", width: 200, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="100" height="160" viewBox="0 0 100 160" fill="none">
                  <circle cx="50" cy="16" r="12" stroke="#FFC61A" strokeWidth="2" opacity="0.5" />
                  <line x1="50" y1="28" x2="50" y2="100" stroke="#FFC61A" strokeWidth="2" opacity="0.5" />
                  <line x1="8" y1="52" x2="92" y2="52" stroke="#FFC61A" strokeWidth="2" opacity="0.5" />
                  <line x1="50" y1="100" x2="20" y2="155" stroke="#FFC61A" strokeWidth="2" opacity="0.5" />
                  <line x1="50" y1="100" x2="80" y2="155" stroke="#FFC61A" strokeWidth="2" opacity="0.5" />
                  {/* Scan line */}
                  <line x1="0" y1={progress * 1.6} x2="100" y2={progress * 1.6} stroke="#5BC8FF" strokeWidth="1.5" opacity="0.8" />
                </svg>
              </div>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12 }}>Scanning body geometry</span>
                  <span style={{ color: "#FFC61A", fontFamily: "Inter", fontSize: 12, fontWeight: 600 }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,246,230,0.08)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #FFC61A, #5BC8FF)", borderRadius: 2, transition: "width 0.1s linear" }} />
                </div>
              </div>
            </div>
          )}

          {phase === "done" && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: "rgba(61,214,140,0.08)", borderRadius: 12, border: "1.5px solid rgba(61,214,140,0.3)" }}>
              <span style={{ fontSize: 24 }}>✓</span>
              <p style={{ color: "#3DD68C", fontFamily: "Inter", fontSize: 15, fontWeight: 600, margin: 0 }}>Scan complete — 47 measurement points captured</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            {phase === "posture" && <Btn variant="primary" onClick={() => setPhase("scanning")}>Begin Scan</Btn>}
            {phase === "scanning" && <Btn variant="ghost">Cancel</Btn>}
            {phase === "done" && <Btn variant="primary">View Results →</Btn>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ScreenVitruvianResults() {
  const measurements = [
    { label: "Height", value: "181.4 cm", confidence: 97 },
    { label: "Shoulder width", value: "44.8 cm", confidence: 94 },
    { label: "Chest circumference", value: "96.2 cm", confidence: 91 },
    { label: "Waist circumference", value: "82.7 cm", confidence: 88 },
    { label: "Hip circumference", value: "97.1 cm", confidence: 95 },
    { label: "Inseam", value: "82.0 cm", confidence: 86 },
    { label: "Arm length", value: "63.4 cm", confidence: 92 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Panel primary grabHandle style={{ width: "100%", maxWidth: 720, padding: "36px 40px 56px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <p style={{ fontFamily: "Chakra Petch, sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 24, color: "#FFC61A", margin: 0 }}>MEASUREMENTS</p>
            <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, margin: 0 }}>47 points · Session 2026-09-14</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {measurements.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ color: "#C9BFB0", fontFamily: "Inter", fontSize: 13, fontWeight: 500 }}>{m.label}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ color: "#FFF6E6", fontFamily: "Inter", fontSize: 15, fontWeight: 600 }}>{m.value}</span>
                    <button style={{
                      color: "#8A8176", fontFamily: "Inter", fontSize: 11, fontWeight: 500,
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                      textDecoration: "underline", textDecorationColor: "rgba(138,129,118,0.4)",
                    }}>Override</button>
                  </div>
                </div>
                <ConfidenceMeter value={m.confidence} label="" />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid rgba(255,246,230,0.08)" }}>
            <Btn variant="ghost">Re-scan</Btn>
            <Btn variant="primary">Apply to Avatar →</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ScreenProperty() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Panel primary grabHandle style={{ width: "100%", maxWidth: 680, padding: "36px 40px 56px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>COMMERCIAL SPACE · VITRUVIAN SQUARE</p>
              <p style={{ fontFamily: "Chakra Petch, sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 22, color: "#FFF6E6", margin: 0 }}>Unit 14B — East Atrium</p>
            </div>
            <div style={{ padding: "6px 14px", background: "rgba(61,214,140,0.12)", borderRadius: 100, border: "1.5px solid rgba(61,214,140,0.3)" }}>
              <span style={{ color: "#3DD68C", fontFamily: "Inter", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}>AVAILABLE</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Area", value: "240 m²" },
              { label: "Floor", value: "Level 2, east facing" },
              { label: "Monthly lease", value: "₣ 4,200 / mo" },
              { label: "Lease term", value: "3 / 6 / 12 months" },
              { label: "Foot traffic", value: "~1,400 / day" },
              { label: "Adjacent tenants", value: "Maison Aurore, Kova Studio" },
            ].map((item, i) => (
              <div key={i} style={{ background: "rgba(255,246,230,0.04)", borderRadius: 12, padding: "14px 18px" }}>
                <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 11, fontWeight: 500, margin: "0 0 4px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{item.label}</p>
                <p style={{ color: "#FFF6E6", fontFamily: "Inter", fontSize: 14, fontWeight: 600, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Btn variant="ghost">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2v10" stroke="#C9BFB0" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Pin
            </Btn>
            <Btn variant="secondary">Schedule tour</Btn>
            <Btn variant="primary">Rent this space →</Btn>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ScreenNotification() {
  const [visible, setVisible] = useState(true);
  const [timer, setTimer] = useState(5);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setTimer(p => {
      if (p <= 1) { clearInterval(t); setVisible(false); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [visible]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 24 }}>
      <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>BODY-LOCKED · TRANSIENT TOAST</p>

      {visible ? (
        <Panel style={{ width: "100%", maxWidth: 480, padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: 100, background: "#5BC8FF", flexShrink: 0 }} />
            <p style={{ color: "#FFF6E6", fontFamily: "Inter", fontSize: 14, fontWeight: 500, margin: 0, flex: 1, lineHeight: 1.5 }}>
              Render server updated — visual quality improved
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 12 }}>{timer}s</span>
              <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", color: "#8A8176", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          </div>
          {/* Auto-dismiss progress bar */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,246,230,0.08)", borderRadius: "0 0 16px 16px" }}>
            <div style={{ height: "100%", background: "#5BC8FF", borderRadius: "inherit", width: `${(timer / 5) * 100}%`, transition: "width 1s linear" }} />
          </div>
        </Panel>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 13 }}>Toast dismissed</p>
          <Btn variant="ghost" onClick={() => { setVisible(true); setTimer(5); }}>Replay</Btn>
        </div>
      )}
    </div>
  );
}

function ScreenErrors() {
  const errors = [
    { type: "No network", icon: "⊘", message: "Connection lost. Faberland requires network access to operate. Check your headset's Wi-Fi settings.", action: "Retry connection" },
    { type: "Mic denied", icon: "⊙", message: "Microphone access was denied. Voice commands require microphone permission to function.", action: "Open settings" },
    { type: "Scan failed", icon: "⊛", message: "Body scan could not complete. Ensure adequate lighting and that your full body is visible.", action: "Try again" },
    { type: "Assistant unavailable", icon: "✦", message: "Assistant service is temporarily unavailable. Basic navigation still works.", action: "Check status" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 12 }}>
        {errors.map((e, i) => (
          <Panel key={i} style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <span style={{ fontSize: 20, color: "#FF2E88", flexShrink: 0, marginTop: 2 }}>{e.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#FF2E88", fontFamily: "Inter", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px" }}>{e.type}</p>
                <p style={{ color: "#C9BFB0", fontFamily: "Inter", fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>{e.message}</p>
                <Btn variant="ghost">{e.action}</Btn>
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function ScreenOnboarding() {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: "Pinch to select",
      desc: "Bring your thumb and index finger together on any highlighted control. You'll feel haptic feedback on confirmed selection.",
      svg: (
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="40" stroke="rgba(255,198,26,0.2)" strokeWidth="1.5" />
          <circle cx="48" cy="44" r="10" stroke="#FFC61A" strokeWidth="2" />
          <circle cx="72" cy="44" r="10" stroke="#C9BFB0" strokeWidth="2" strokeDasharray="3 2" />
          <line x1="48" y1="54" x2="48" y2="80" stroke="#FFC61A" strokeWidth="2" />
          <line x1="72" y1="54" x2="72" y2="76" stroke="#C9BFB0" strokeWidth="2" strokeDasharray="3 2" />
          <path d="M48 80 Q60 92 72 76" stroke="#FFC61A" strokeWidth="1.5" fill="none" />
        </svg>
      ),
    },
    {
      title: "Ray-cast to aim",
      desc: "A gold ray extends from your dominant hand. Point at any panel or control in the world to highlight it before pinching.",
      svg: (
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="30" cy="90" r="8" stroke="#C9BFB0" strokeWidth="2" />
          <line x1="30" y1="82" x2="90" y2="30" stroke="#FFC61A" strokeWidth="2" strokeDasharray="6 2" />
          <rect x="80" y="20" width="28" height="18" rx="4" stroke="#FFC61A" strokeWidth="1.5" />
          <circle cx="94" cy="29" r="3" fill="#FFC61A" opacity="0.5" />
        </svg>
      ),
    },
    {
      title: "Palm up for menu",
      desc: "Turn your non-dominant palm upward to open the radial command menu. Keep it steady for a moment to confirm.",
      svg: (
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <ellipse cx="60" cy="80" rx="28" ry="12" stroke="#C9BFB0" strokeWidth="2" />
          {[0, 60, 120, 180, 240, 300].map((a, i) => {
            const r2 = (a * Math.PI) / 180;
            return <line key={i} x1="60" y1="80" x2={60 + 32 * Math.cos(r2)} y2={80 + 32 * Math.sin(r2)} stroke="#FFC61A" strokeWidth="1.5" opacity="0.6" />;
          })}
          <circle cx="60" cy="80" r="6" fill="#FFC61A" opacity="0.5" />
        </svg>
      ),
    },
  ];
  const s = steps[step];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Panel primary grabHandle style={{ width: "100%", maxWidth: 680, padding: "40px 48px 60px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, alignItems: "center", textAlign: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {steps.map((_, i) => (
              <div key={i} style={{ width: i === step ? 24 : 8, height: 4, borderRadius: 2, background: i === step ? "#FFC61A" : "rgba(255,246,230,0.15)", transition: "all 0.3s ease" }} />
            ))}
          </div>
          <div style={{ padding: 24, background: "rgba(255,246,230,0.03)", borderRadius: 20, border: "1.5px solid rgba(255,198,26,0.15)" }}>
            {s.svg}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontFamily: "Chakra Petch, sans-serif", fontWeight: 700, fontSize: 20, color: "#FFC61A", margin: 0 }}>{s.title}</p>
            <p style={{ color: "#C9BFB0", fontFamily: "Inter", fontSize: 14, lineHeight: 1.65, margin: 0, maxWidth: 480 }}>{s.desc}</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {step > 0 && <Btn variant="ghost" onClick={() => setStep(s => s - 1)}>← Back</Btn>}
            {step < steps.length - 1
              ? <Btn variant="primary" onClick={() => setStep(s => s + 1)}>Next →</Btn>
              : <Btn variant="primary">Enter Faberland</Btn>
            }
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── Screen router ─────────────────────────────────────────────────────────────
function renderScreen(id: ScreenId) {
  switch (id) {
    case "dormant":         return <ScreenDormant />;
    case "wake":            return <ScreenWake />;
    case "listening":       return <ScreenListening />;
    case "thinking":        return <ScreenThinking />;
    case "response":        return <ScreenResponse />;
    case "palm-menu":       return <ScreenPalmMenu />;
    case "vitruvian-scan":  return <ScreenVitruvianScan />;
    case "vitruvian-results": return <ScreenVitruvianResults />;
    case "property":        return <ScreenProperty />;
    case "notification":    return <ScreenNotification />;
    case "error-states":    return <ScreenErrors />;
    case "onboarding":         return <ScreenOnboarding />;
    case "input-glyphs":      return <ScreenInputGlyphs />;
    case "manipulation":      return <ScreenManipulation />;
    case "hud-layer":         return <ScreenHUD />;
    case "vitruvian-editor":    return <ScreenVitruvianEditor />;
    case "measurement-studio":  return <ScreenMeasurementStudio />;
  }
}

// ─── App shell ─────────────────────────────────────────────────────────────────
type View = "screens" | "controller" | "components";

export default function App() {
  const [view, setView] = useState<View>("screens");
  const [screen, setScreen] = useState<ScreenId>("wake");
  const [navOpen, setNavOpen] = useState(false);
  const current = SCREENS.find(s => s.id === screen)!;

  if (view === "controller") return <QuestController />;
  if (view === "components") return <FaberlandComponents />;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0D0B08",
      display: "flex",
      flexDirection: "column",
      fontFamily: "Inter, sans-serif",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        borderBottom: "1px solid rgba(255,246,230,0.06)",
        flexShrink: 0,
      }}>
        {/* Wordmark area */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FaberStar state="dormant" size="small" />
          <div>
            <img
              src="/src/assets/faberland-wordmark.png"
              alt="Faberland"
              style={{ height: 20, display: "block" }}
            />
            <p style={{ color: "#8A8176", fontFamily: "Inter", fontSize: 11, margin: "3px 0 0", letterSpacing: "0.08em" }}>XR Interface · Quest 3 · Body-Locked @ 1.5m</p>
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: 8, marginRight: 16 }}>
          {([["screens", "XR Screens"], ["controller", "Controller"], ["components", "Components"]] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: view === v ? "rgba(255,198,26,0.12)" : "transparent",
                border: `1.5px solid ${view === v ? "#FFC61A" : "rgba(255,246,230,0.1)"}`,
                color: view === v ? "#FFC61A" : "#8A8176",
                fontFamily: "Inter", fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >{label}</button>
          ))}
        </div>

        {/* Screen picker */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNavOpen(n => !n)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              background: navOpen ? "rgba(255,198,26,0.1)" : "rgba(255,246,230,0.04)",
              border: `1.5px solid ${navOpen ? "rgba(255,198,26,0.4)" : "rgba(255,246,230,0.1)"}`,
              borderRadius: 10,
              color: "#FFF6E6",
              fontFamily: "Inter",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {current.label}
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ transform: navOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}>
              <path d="M1 1l5 5 5-5" stroke="#8A8176" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {navOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#1A1611",
              border: "1.5px solid rgba(255,246,230,0.1)",
              borderRadius: 12,
              padding: "8px",
              zIndex: 100,
              minWidth: 240,
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              maxHeight: "80vh",
              overflowY: "auto",
            }}>
              {Array.from(new Set(SCREENS.map(s => s.group))).map(group => (
                <div key={group}>
                  <div style={{ padding: "6px 14px 4px", color: "#8A8176", fontFamily: "Inter", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em" }}>
                    {group?.toUpperCase()}
                  </div>
                  {SCREENS.filter(s => s.group === group).map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setScreen(s.id); setNavOpen(false); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 14px", borderRadius: 8,
                        background: s.id === screen ? "rgba(255,198,26,0.12)" : "transparent",
                        border: "none",
                        color: s.id === screen ? "#FFC61A" : "#C9BFB0",
                        fontFamily: "Inter", fontSize: 12,
                        fontWeight: s.id === screen ? 600 : 400,
                        cursor: "pointer", transition: "all 0.1s ease",
                      }}
                      onMouseEnter={e => { if (s.id !== screen) (e.target as HTMLElement).style.color = "#FFF6E6"; }}
                      onMouseLeave={e => { if (s.id !== screen) (e.target as HTMLElement).style.color = "#C9BFB0"; }}
                    >{s.label}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panel viewport — simulates 1200×800 dmm panel */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "32px 40px 40px",
        maxWidth: 1200,
        width: "100%",
        margin: "0 auto",
      }}>
        {renderScreen(screen)}
      </div>

      {/* Footer nav — quick-jump arrows */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "16px 32px",
        borderTop: "1px solid rgba(255,246,230,0.06)",
        flexShrink: 0,
      }}>
        {SCREENS.map(s => (
          <button
            key={s.id}
            onClick={() => setScreen(s.id)}
            title={s.label}
            style={{
              width: s.id === screen ? 24 : 8,
              height: 4,
              borderRadius: 2,
              background: s.id === screen ? "#FFC61A" : "rgba(255,246,230,0.15)",
              border: "none",
              cursor: "pointer",
              transition: "all 0.25s ease",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
