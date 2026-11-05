import { useState, useEffect, useRef } from "react";

// ─── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  gold: "#FFC61A", amber: "#F5A81C", ember: "#FF3D00",
  panel: "#0D0B08", surface: "#1A1611", surface2: "#231E17",
  text: "#FFF6E6", textSec: "#C9BFB0", textTert: "#8A8176",
  info: "#5BC8FF", success: "#3DD68C",
};

// ─── Measurement definitions ────────────────────────────────────────────────────
type MeasureDef = {
  id: string;
  label: string;
  labelFr: string;
  instruction: string;
  unit: "cm" | "m";
  typical: [number, number]; // [min, max] in cm
  anatomical: string;
};

const MEASURES: MeasureDef[] = [
  { id: "arm_span",       label: "Arm Span",        labelFr: "Envergure",         instruction: "Extend arms fully, controllers level with shoulders", unit: "cm", typical: [150, 210], anatomical: "Fingertip → Fingertip" },
  { id: "shoulder_width", label: "Shoulder Width",   labelFr: "Largeur épaules",   instruction: "Hold controllers at shoulder height, arms relaxed", unit: "cm", typical: [35, 55],  anatomical: "Acromion → Acromion" },
  { id: "torso_width",    label: "Torso Width",      labelFr: "Largeur torse",     instruction: "Hold controllers at ribcage level, elbows in", unit: "cm", typical: [28, 48],  anatomical: "Lateral torso" },
  { id: "hip_width",      label: "Hip Width",        labelFr: "Largeur hanches",   instruction: "Lower controllers to hip level, arms relaxed at side", unit: "cm", typical: [30, 55],  anatomical: "Greater trochanter" },
  { id: "reach_height",   label: "Reach Height",     labelFr: "Portée verticale",  instruction: "Raise right controller as high as possible, left at hip", unit: "cm", typical: [170, 240], anatomical: "Vertical reach" },
  { id: "chest_depth",    label: "Chest Depth",      labelFr: "Profondeur poitrine",instruction: "Left controller front, right controller back at chest level", unit: "cm", typical: [18, 32], anatomical: "Anterior → Posterior" },
];

// ─── Confidence badge ──────────────────────────────────────────────────────────
type Confidence = "measured" | "derived" | "estimated";
function ConfBadge({ type }: { type: Confidence }) {
  const cfg = {
    measured:  { color: C.gold,    label: "MEASURED",  dot: "●" },
    derived:   { color: C.textSec, label: "DERIVED",   dot: "○" },
    estimated: { color: C.textTert,label: "ESTIMATED", dot: "·" },
  }[type];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "Inter, sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: cfg.color }}>
      <span style={{ fontSize: 10 }}>{cfg.dot}</span>{cfg.label}
    </span>
  );
}

// ─── Controller silhouette (simplified grip, angled top-down) ──────────────────
function ControllerSilhouette({ side, lit = false, state = "idle" }: {
  side: "left" | "right"; lit?: boolean; state?: "idle" | "ready" | "capturing" | "done";
}) {
  const flip = side === "left" ? 1 : -1;
  const stateColor = state === "capturing" ? C.gold : state === "done" ? C.success : state === "ready" ? C.amber : C.textTert;
  const bodyOpacity = lit ? 0.85 : 0.35;

  return (
    <svg width="72" height="120" viewBox="0 0 72 120" style={{ transform: `scaleX(${flip})`, transition: "all 0.4s ease" }}>
      {/* Glow halo when active */}
      {lit && (
        <ellipse cx="36" cy="60" rx="34" ry="54"
          fill="none" stroke={stateColor} strokeWidth="1"
          strokeOpacity="0.3"
          style={{ filter: `drop-shadow(0 0 8px ${stateColor})` }}
        />
      )}
      {/* Main grip body */}
      <path
        d="M28 8 C20 8 14 14 13 24 L11 52 C11 64 8 80 6 96 C4 108 10 116 18 116 L28 116 C32 116 36 112 36 108 L36 72 C44 72 52 68 56 60 L60 40 C62 28 56 14 44 10 Z"
        fill={lit ? `rgba(255,198,26,0.08)` : "rgba(255,246,230,0.04)"}
        stroke={stateColor}
        strokeWidth={lit ? "1.5" : "1"}
        strokeOpacity={bodyOpacity}
      />
      {/* Thumbstick */}
      <ellipse cx="44" cy="28" rx="8" ry="6"
        fill="none" stroke={stateColor} strokeWidth="1.2"
        strokeOpacity={bodyOpacity}
      />
      <circle cx="44" cy="28" r="2.5" fill={stateColor} fillOpacity={bodyOpacity * 0.6} />
      {/* Face buttons */}
      <circle cx="52" cy="44" r="4" fill="none" stroke={stateColor} strokeWidth="1" strokeOpacity={bodyOpacity * 0.7} />
      <circle cx="44" cy="52" r="4" fill="none" stroke={stateColor} strokeWidth="1" strokeOpacity={bodyOpacity * 0.7} />
      {/* Trigger */}
      <path d="M13 56 C10 58 8 64 9 70 C10 76 14 78 17 76" fill="none" stroke={stateColor} strokeWidth="2" strokeLinecap="round" strokeOpacity={bodyOpacity} />
      {/* Grip */}
      <path d="M11 70 C6 72 4 80 5 88 C6 94 10 96 14 94" fill="none" stroke={stateColor} strokeWidth="1.5" strokeLinecap="round" strokeOpacity={bodyOpacity * 0.7} />
      {/* State glow dot at top */}
      {lit && (
        <circle cx="36" cy="8" r="4" fill={stateColor}
          style={{ filter: `drop-shadow(0 0 6px ${stateColor})`, animation: state === "capturing" ? "capturePulse 0.6s ease-in-out infinite" : "none" }}
        />
      )}
    </svg>
  );
}

// ─── Beam between controllers ──────────────────────────────────────────────────
function MeasurementBeam({ active, capturing, captured, distance }: {
  active: boolean; capturing: boolean; captured: boolean; distance: number;
}) {
  const beamColor = captured ? C.success : capturing ? C.gold : active ? C.amber : "rgba(255,198,26,0.2)";
  const beamWidth = capturing ? 3 : active ? 2 : 1;

  return (
    <div style={{ position: "relative", flex: 1, height: 4, display: "flex", alignItems: "center" }}>
      {/* Beam track */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: beamWidth,
        background: `linear-gradient(90deg, transparent 0%, ${beamColor} 15%, ${beamColor} 85%, transparent 100%)`,
        borderRadius: 2,
        transition: "all 0.3s ease",
        boxShadow: active ? `0 0 12px ${beamColor}66, 0 0 24px ${beamColor}33` : "none",
      }} />

      {/* Animated particles along beam */}
      {active && !captured && (
        <>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute",
              width: 4, height: 4,
              borderRadius: "50%",
              background: beamColor,
              boxShadow: `0 0 6px ${beamColor}`,
              animation: `beamParticle ${1.2 + i * 0.3}s linear infinite`,
              animationDelay: `${i * 0.4}s`,
              top: "50%",
              transform: "translateY(-50%)",
            }} />
          ))}
        </>
      )}

      {/* Center readout chip */}
      {active && (
        <div style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          background: captured ? `rgba(61,214,140,0.12)` : capturing ? "rgba(255,198,26,0.12)" : "rgba(13,11,8,0.88)",
          border: `1.5px solid ${beamColor}`,
          borderRadius: 10,
          padding: "8px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          backdropFilter: "blur(8px)",
          boxShadow: `0 0 24px ${beamColor}44`,
          transition: "all 0.3s ease",
          whiteSpace: "nowrap",
          zIndex: 2,
        }}>
          <span style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: 700,
            fontSize: capturing ? 26 : 22,
            color: captured ? C.success : beamColor,
            letterSpacing: "0.02em",
            transition: "all 0.2s ease",
            fontStyle: "italic",
          }}>
            {(distance / 100).toFixed(2)} m
          </span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, letterSpacing: "0.1em" }}>
            {distance.toFixed(0)} cm
          </span>
          {captured && (
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: C.success, letterSpacing: "0.08em", fontWeight: 700 }}>
              ✓ LOCKED
            </span>
          )}
        </div>
      )}

      {/* End ticks */}
      {active && (
        <>
          <div style={{ position: "absolute", left: 0, width: 2, height: 20, background: beamColor, borderRadius: 1, top: "50%", transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", right: 0, width: 2, height: 20, background: beamColor, borderRadius: 1, top: "50%", transform: "translateY(-50%)" }} />
        </>
      )}
    </div>
  );
}

// ─── DaVinci grid overlay ──────────────────────────────────────────────────────
function DaVinciGrid() {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 800 300" preserveAspectRatio="xMidYMid meet">
      {/* Golden ratio construction lines */}
      {[0.236, 0.382, 0.5, 0.618, 0.764].map(x => (
        <line key={x} x1={x * 800} y1="0" x2={x * 800} y2="300"
          stroke="rgba(255,198,26,0.04)" strokeWidth="1" />
      ))}
      {[0.236, 0.382, 0.5, 0.618, 0.764].map(y => (
        <line key={y} x1="0" y1={y * 300} x2="800" y2={y * 300}
          stroke="rgba(255,198,26,0.04)" strokeWidth="1" />
      ))}
      {/* Diagonal construction lines */}
      <line x1="0" y1="0" x2="800" y2="300" stroke="rgba(255,198,26,0.025)" strokeWidth="1" />
      <line x1="800" y1="0" x2="0" y2="300" stroke="rgba(255,198,26,0.025)" strokeWidth="1" />
      {/* Center crosshair */}
      <circle cx="400" cy="150" r="40" fill="none" stroke="rgba(255,198,26,0.06)" strokeWidth="1" />
      <circle cx="400" cy="150" r="80" fill="none" stroke="rgba(255,198,26,0.03)" strokeWidth="1" />
    </svg>
  );
}

// ─── Captured dimension card ────────────────────────────────────────────────────
function DimensionCard({ def, value, onRecapture }: {
  def: MeasureDef; value: number; onRecapture: () => void;
}) {
  const typicalMid = (def.typical[0] + def.typical[1]) / 2;
  const pct = Math.max(0, Math.min(1, (value - def.typical[0]) / (def.typical[1] - def.typical[0])));
  const percentile = Math.round(pct * 100);

  return (
    <div style={{
      background: C.surface,
      borderRadius: 12,
      padding: "16px 20px",
      border: `1px solid rgba(255,198,26,0.12)`,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `rgba(255,198,26,0.35)` }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: 11, color: C.textTert, letterSpacing: "0.1em", textTransform: "uppercase" }}>{def.label}</p>
          <p style={{ margin: "2px 0 0", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{def.anatomical}</p>
        </div>
        <ConfBadge type="measured" />
      </div>

      {/* Value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 14 }}>
        <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700, fontStyle: "italic", fontSize: 32, color: C.gold, letterSpacing: "0.02em" }}>
          {value}
        </span>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: C.textSec }}>cm</span>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: C.textTert, marginLeft: 8 }}>
          / {(value / 100).toFixed(2)} m
        </span>
      </div>

      {/* Percentile bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{def.typical[0]} cm</span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textSec, fontWeight: 600 }}>p{percentile}</span>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert }}>{def.typical[1]} cm</span>
        </div>
        <div style={{ height: 4, background: C.surface2, borderRadius: 2, overflow: "visible", position: "relative" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.amber}, ${C.gold})`, borderRadius: 2 }} />
          <div style={{
            position: "absolute",
            left: `${pct * 100}%`,
            top: -3,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: C.gold,
            transform: "translateX(-50%)",
            boxShadow: `0 0 8px ${C.gold}88`,
          }} />
        </div>
      </div>

      {/* French label */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, fontStyle: "italic" }}>{def.labelFr}</span>
        <button onClick={onRecapture} style={{
          background: "none", border: `1px solid rgba(255,198,26,0.2)`, borderRadius: 6,
          padding: "4px 10px", cursor: "pointer",
          fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert,
          letterSpacing: "0.08em",
          transition: "all 0.15s ease",
        }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.borderColor = C.gold; (e.target as HTMLButtonElement).style.color = C.gold; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.borderColor = "rgba(255,198,26,0.2)"; (e.target as HTMLButtonElement).style.color = C.textTert; }}
        >
          RE-MEASURE
        </button>
      </div>
    </div>
  );
}

// ─── Capture button ─────────────────────────────────────────────────────────────
function CaptureButton({ state, progress, onClick }: {
  state: "idle" | "ready" | "capturing" | "done"; progress: number; onClick: () => void;
}) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

  const labels = { idle: "HOLD READY POSITION", ready: "MEASURING…", capturing: "CAPTURING…", done: "CAPTURED" };
  const colors = { idle: C.textTert, ready: C.amber, capturing: C.gold, done: C.success };

  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: state === "done" ? "default" : "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 0,
    }}>
      <div style={{ position: "relative", width: 88, height: 88 }}>
        {/* Background ring */}
        <svg width="88" height="88" viewBox="0 0 88 88" style={{ position: "absolute", inset: 0 }}>
          <circle cx="44" cy="44" r={r} fill="rgba(13,11,8,0.88)" stroke="rgba(255,246,230,0.08)" strokeWidth="4" />
          {/* Progress ring */}
          <circle cx="44" cy="44" r={r} fill="none"
            stroke={colors[state]}
            strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            style={{ transition: "stroke-dasharray 0.1s linear, stroke 0.3s ease", filter: `drop-shadow(0 0 6px ${colors[state]}88)` }}
          />
        </svg>
        {/* Center icon */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {state === "done" ? (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M6 14 L12 20 L22 8" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="8" fill={colors[state]} fillOpacity="0.2" />
              <circle cx="14" cy="14" r="4" fill={colors[state]}
                style={{ filter: `drop-shadow(0 0 8px ${colors[state]})` }}
              />
              {/* Rulers emanating from center */}
              <line x1="2" y1="14" x2="6" y2="14" stroke={colors[state]} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="22" y1="14" x2="26" y2="14" stroke={colors[state]} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="2" x2="14" y2="6" stroke={colors[state]} strokeWidth="1.5" strokeLinecap="round" />
              <line x1="14" y1="22" x2="14" y2="26" stroke={colors[state]} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700, color: colors[state], letterSpacing: "0.14em" }}>
        {labels[state]}
      </span>
    </button>
  );
}

// ─── Spread indicator ──────────────────────────────────────────────────────────
function SpreadIndicator({ distance, def }: { distance: number; def: MeasureDef }) {
  const [min, max] = def.typical;
  const inRange = distance >= min && distance <= max;
  const pct = Math.max(0, Math.min(1, (distance - min * 0.8) / ((max * 1.2) - min * 0.8)));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, minWidth: 56, textAlign: "right" }}>
        {(min * 0.8).toFixed(0)} cm
      </span>
      <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 3, position: "relative" }}>
        {/* Typical range highlight */}
        <div style={{
          position: "absolute",
          left: `${((min - min * 0.8) / (max * 1.2 - min * 0.8)) * 100}%`,
          width: `${((max - min) / (max * 1.2 - min * 0.8)) * 100}%`,
          height: "100%",
          background: "rgba(255,198,26,0.15)",
          borderRadius: 3,
        }} />
        {/* Current position */}
        <div style={{
          position: "absolute",
          left: `${pct * 100}%`,
          top: -3,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: inRange ? C.gold : C.ember,
          transform: "translateX(-50%)",
          boxShadow: `0 0 8px ${inRange ? C.gold : C.ember}`,
          transition: "left 0.2s ease, background 0.3s ease",
        }} />
      </div>
      <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, minWidth: 56 }}>
        {(max * 1.2).toFixed(0)} cm
      </span>
      <span style={{
        fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
        color: inRange ? C.gold : C.ember,
        minWidth: 60, textAlign: "right",
        letterSpacing: "0.06em",
      }}>
        {inRange ? "IN RANGE" : "OUT OF RANGE"}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════════════════════
export default function ScreenMeasurementStudio() {
  const [activeMeasure, setActiveMeasure] = useState(0);
  const [captureState, setCaptureState] = useState<"idle" | "ready" | "capturing" | "done">("idle");
  const [captureProgress, setCaptureProgress] = useState(0);
  const [capturedValues, setCapturedValues] = useState<Record<string, number>>({});
  const [spread, setSpread] = useState(160); // cm, draggable
  const [isDragging, setIsDragging] = useState(false);
  const beamRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const def = MEASURES[activeMeasure];
  const hasCaptured = capturedValues[def.id] !== undefined;

  // Auto-start measuring when user clicks the beam
  function startCapture() {
    if (captureState === "done") return;
    setCaptureState("ready");
    setCaptureProgress(0);

    // Simulate measurement progression
    let p = 0;
    progressRef.current = setInterval(() => {
      p += 0.025;
      setCaptureProgress(Math.min(p, 1));
      if (p >= 0.3 && captureState !== "capturing") setCaptureState("capturing");
      if (p >= 1) {
        clearInterval(progressRef.current!);
        setCaptureState("done");
        // Add slight random variation ±3cm
        const captured = Math.round(spread + (Math.random() - 0.5) * 6);
        setCapturedValues(v => ({ ...v, [def.id]: captured }));
      }
    }, 60);
  }

  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);

  // Reset when switching measure type
  function switchMeasure(i: number) {
    if (progressRef.current) clearInterval(progressRef.current);
    setActiveMeasure(i);
    setCaptureState("idle");
    setCaptureProgress(0);
  }

  // Mouse drag on beam to adjust spread
  function handleBeamMouseDown(e: React.MouseEvent) {
    if (captureState === "capturing" || captureState === "done") return;
    setIsDragging(true);
    const startX = e.clientX;
    const startSpread = spread;

    const onMove = (me: MouseEvent) => {
      const delta = (me.clientX - startX) * 0.8; // 0.8cm per pixel
      setSpread(Math.max(20, Math.min(300, startSpread + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // Controller horizontal offset based on spread
  const controllerGap = Math.min(Math.max(spread / 3, 40), 160); // px

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, background: C.panel, minHeight: 0, overflow: "auto" }}>
      <style>{`
        @keyframes beamParticle {
          0%   { left: 5%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { left: 95%; opacity: 0; }
        }
        @keyframes capturePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.4); }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(400%); opacity: 0; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: "24px 32px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            BIOMETRIC CAPTURE · CONTROLLER MODE · DUAL-WIELD
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,198,26,0.1)" }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, letterSpacing: "0.1em" }}>
            {Object.keys(capturedValues).length} / {MEASURES.length} DIMENSIONS
          </span>
        </div>
        <h2 style={{ margin: 0, fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 22, color: C.gold, letterSpacing: "0.04em" }}>
          {def.label}
          <span style={{ marginLeft: 16, fontFamily: "Inter, sans-serif", fontStyle: "normal", fontWeight: 400, fontSize: 12, color: C.textTert, letterSpacing: "0.08em" }}>
            {def.anatomical}
          </span>
        </h2>
      </div>

      {/* ── Measure selector tabs ── */}
      <div style={{ padding: "16px 32px", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
        {MEASURES.map((m, i) => {
          const done = capturedValues[m.id] !== undefined;
          return (
            <button key={m.id} onClick={() => switchMeasure(i)} style={{
              background: i === activeMeasure ? "rgba(255,198,26,0.1)" : "rgba(255,246,230,0.03)",
              border: `1.5px solid ${i === activeMeasure ? C.gold : done ? "rgba(61,214,140,0.3)" : "rgba(255,246,230,0.08)"}`,
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 3,
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {done && <span style={{ fontSize: 10, color: C.success }}>✓</span>}
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: i === activeMeasure ? C.gold : done ? C.success : C.textSec, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
                  {m.label}
                </span>
              </div>
              {done && (
                <span style={{ fontFamily: "'Chakra Petch', sans-serif", fontSize: 13, fontWeight: 700, fontStyle: "italic", color: C.gold }}>
                  {capturedValues[m.id]} cm
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main visualization ── */}
      <div style={{ flex: 1, padding: "0 32px", display: "flex", flexDirection: "column", gap: 24, minHeight: 0 }}>

        {/* Controller stage */}
        <div style={{
          position: "relative",
          background: "rgba(26,22,17,0.6)",
          borderRadius: 20,
          border: `1px solid rgba(255,198,26,0.08)`,
          overflow: "hidden",
          height: 280,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "ew-resize" : "crosshair",
        }} onMouseDown={handleBeamMouseDown} ref={beamRef}>

          <DaVinciGrid />

          {/* Scan line animation during capture */}
          {captureState === "capturing" && (
            <div style={{
              position: "absolute", left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, transparent, ${C.gold}88, transparent)`,
              animation: "scanLine 1.5s ease-in-out infinite",
              pointerEvents: "none",
            }} />
          )}

          {/* Instruction text */}
          <div style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: captureState === "idle" ? C.textTert : C.textSec,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transition: "color 0.3s ease",
          }}>
            {captureState === "idle" ? def.instruction : captureState === "ready" ? "Hold steady…" : captureState === "capturing" ? "Locking measurement…" : "Measurement complete"}
          </div>

          {/* Controller pair with beam */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%", maxWidth: 700, padding: "0 40px" }}>
            {/* Left controller */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <ControllerSilhouette side="left" lit={captureState !== "idle"} state={captureState as any} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: C.textTert, letterSpacing: "0.12em" }}>LEFT</span>
            </div>

            {/* Beam */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 8px" }}>
              <MeasurementBeam
                active={captureState !== "idle"}
                capturing={captureState === "capturing" || captureState === "ready"}
                captured={captureState === "done"}
                distance={captureState === "done" ? (capturedValues[def.id] ?? spread) : spread}
              />
            </div>

            {/* Right controller */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <ControllerSilhouette side="right" lit={captureState !== "idle"} state={captureState as any} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 9, color: C.textTert, letterSpacing: "0.12em" }}>RIGHT</span>
            </div>
          </div>

          {/* Corner brackets — DaVinci reference frame */}
          {["tl", "tr", "bl", "br"].map(corner => (
            <div key={corner} style={{
              position: "absolute",
              ...(corner.includes("t") ? { top: 12 } : { bottom: 12 }),
              ...(corner.includes("l") ? { left: 12 } : { right: 12 }),
              width: 20, height: 20,
              borderTop: corner.includes("t") ? `2px solid rgba(255,198,26,0.25)` : "none",
              borderBottom: corner.includes("b") ? `2px solid rgba(255,198,26,0.25)` : "none",
              borderLeft: corner.includes("l") ? `2px solid rgba(255,198,26,0.25)` : "none",
              borderRight: corner.includes("r") ? `2px solid rgba(255,198,26,0.25)` : "none",
            }} />
          ))}

          {/* Drag hint */}
          {captureState === "idle" && (
            <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontFamily: "Inter, sans-serif", fontSize: 9, color: C.textTert, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 4h10M1 4l3-3M1 4l3 3M11 4l-3-3M11 4l-3 3" stroke={C.textTert} strokeWidth="1" strokeLinecap="round" />
              </svg>
              DRAG TO ADJUST SPREAD
            </div>
          )}
        </div>

        {/* ── Range indicator + capture ── */}
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 8px", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Typical range for {def.label}
            </p>
            <SpreadIndicator distance={spread} def={def} />
          </div>

          <CaptureButton
            state={captureState}
            progress={captureProgress}
            onClick={() => {
              if (captureState === "idle") {
                setCaptureState("ready");
                startCapture();
              } else if (captureState === "done") {
                // Reset to re-capture
                setCaptureState("idle");
                setCaptureProgress(0);
                setCapturedValues(v => { const n = { ...v }; delete n[def.id]; return n; });
              }
            }}
          />
        </div>

        {/* ── Captured dimensions ── */}
        {Object.keys(capturedValues).length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <p style={{ margin: "0 0 12px", fontFamily: "Inter, sans-serif", fontSize: 10, color: C.textTert, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Captured Dimensions · {Object.keys(capturedValues).length} of {MEASURES.length}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {Object.entries(capturedValues).map(([id, val]) => {
                const d = MEASURES.find(m => m.id === id)!;
                return (
                  <DimensionCard key={id} def={d} value={val}
                    onRecapture={() => {
                      switchMeasure(MEASURES.findIndex(m => m.id === id));
                      setCapturedValues(v => { const n = { ...v }; delete n[id]; return n; });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── All done CTA ── */}
        {Object.keys(capturedValues).length === MEASURES.length && (
          <div style={{
            background: "rgba(61,214,140,0.06)",
            border: `1px solid rgba(61,214,140,0.25)`,
            borderRadius: 12,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <p style={{ margin: 0, fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 16, color: C.success }}>
                All dimensions captured
              </p>
              <p style={{ margin: "4px 0 0", fontFamily: "Inter, sans-serif", fontSize: 12, color: C.textSec }}>
                Vitruvian profile ready — {MEASURES.length} biometric dimensions measured
              </p>
            </div>
            <button style={{
              background: C.gold, border: "none", borderRadius: 8, padding: "10px 24px",
              fontFamily: "'Chakra Petch', sans-serif", fontStyle: "italic", fontWeight: 700,
              fontSize: 14, color: C.panel, cursor: "pointer", letterSpacing: "0.04em",
            }}>
              SAVE PROFILE
            </button>
          </div>
        )}

        <div style={{ height: 32, flexShrink: 0 }} />
      </div>
    </div>
  );
}
