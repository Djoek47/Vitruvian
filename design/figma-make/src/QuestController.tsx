/**
 * QuestController.tsx
 * Uses hand-traced SVG line-art from AniketMan/quest-controls-mapper (MIT),
 * sourced from Meta's Quest_03.eps. Hotspot coordinates matched from controls.ts.
 * viewBox: 0 0 709.74 446.81 — both controllers in one coordinate space.
 */
import { useState, useRef, useCallback, useEffect, memo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ButtonState = "idle" | "hover" | "press" | "hold";

const HOLD_MS = 500;

function useBtn(holdable: boolean, onEmit: (s: ButtonState) => void) {
  const [state, setState] = useState<ButtonState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const down  = useCallback(() => {
    setState("press"); onEmit("press");
    if (holdable) timer.current = setTimeout(() => { setState("hold"); onEmit("hold"); }, HOLD_MS);
  }, [holdable, onEmit]);
  const up    = useCallback(() => { clear(); setState("idle"); onEmit("idle"); }, [onEmit]);
  const enter = useCallback(() => setState(s => s === "idle" ? "hover" : s), []);
  const leave = useCallback(() => { clear(); setState("idle"); onEmit("idle"); }, [onEmit]);
  useEffect(() => () => clear(), []);
  return { state, down, up, enter, leave };
}

// ── Colours ───────────────────────────────────────────────────────────────────
function sc(s: ButtonState) {
  switch (s) {
    case "hover": return { ring: "#FFC61A", fill: "rgba(255,198,26,0.15)", dot: "#FFC61A", outer: 18 };
    case "press": return { ring: "#FFD84A", fill: "rgba(255,198,26,0.30)", dot: "#FFD84A", outer: 20 };
    case "hold":  return { ring: "#FF3D00", fill: "rgba(255,61,0,0.25)",   dot: "#FF3D00", outer: 22 };
    default:      return { ring: "rgba(255,246,230,0.35)", fill: "transparent", dot: "rgba(255,246,230,0.5)", outer: 13 };
  }
}

// ── Actual traced line-art paths (from quest-controls-mapper / Quest_03.eps) ──
const LeftPaths = memo(function LeftPaths() {
  return (
    <g stroke="currentColor" fill="none" strokeMiterlimit="10">
      <path strokeWidth="1" d="M 113.547 188.148 C 146.840 200.641 186.398 202.191 239.047 166.453 C 269.484 145.793 288.598 118.051 303.715 90.578"/>
      <path strokeWidth="1" d="M 201.656 209.203 C 213.492 223.258 184.797 226.703 167.547 231.203 C 154.195 234.688 129.797 236.453 128.215 256.371 C 126.734 274.984 139.715 279.199 139.715 279.199"/>
      <path strokeWidth="1" d="M 242.652 173.578 C 235.438 187.977 227.555 198.676 217.977 203.090 C 200.727 211.039 171.695 218.320 122.047 226.035 C 95.262 230.199 100.094 261.875 113.492 270.816 C 126.379 279.414 148.156 281.926 173.047 277.926 C 197.934 273.926 197.934 259.258 197.934 259.258 C 197.934 259.258 201.324 232.035 203.547 220.035 C 203.801 218.816 204.039 217.699 204.273 216.676"/>
      <path strokeWidth="1" d="M 148.781 40.672 C 126.688 55.754 105.281 75.629 86.824 101.191 L 84.602 104.594 C 84.602 104.594 72.152 124.922 65.047 150.816 C 38.824 246.371 -53.141 397.719 44.156 440.148 C 103.270 465.926 138.027 406.062 161.852 348.984 C 178.484 309.137 189.047 272.371 189.047 272.371"/>
      <path strokeWidth="1" d="M 214.879 204.453 C 219.215 203.090 274.297 189.621 281.590 186.918 C 284.992 185.656 288.504 184.637 290.914 181.930 C 292.910 179.691 295.031 176.418 296.602 171.703 C 300.602 159.703 321.098 99.191 321.934 93.926 C 324.656 76.785 324.668 56.586 324.156 52.148 C 323.270 44.426 322.824 17.480 299.715 6.371 C 278.891 -4.180 227.977 -1.895 175.844 24.637"/>
      <path strokeWidth="1" d="M 322.430 92.344 C 322.430 92.344 329.441 140.762 329.062 146.371 C 328.562 153.730 321.926 157.703 298.387 166.453"/>
      {/* Thumbstick outer ring */}
      <path strokeWidth="1" d="M 187.199 45.277 C 192.852 43.801 197.121 44.219 198.684 46.742 C 201.398 51.145 194.359 60.414 182.965 67.445 C 171.566 74.480 160.125 76.617 157.410 72.219 C 155.891 69.754 157.594 65.484 161.246 61.215"/>
      <path strokeWidth="1" d="M 187.879 45.238 C 190.344 49.234 186.434 56.121 179.141 60.621 C 171.848 65.121 163.938 65.531 161.473 61.535"/>
      <path strokeWidth="1" d="M 189.379 29.660 C 193.820 36.859 187.863 48.590 176.074 55.867 C 164.289 63.141 151.133 63.207 146.691 56.008 C 142.246 48.812 148.203 37.082 159.992 29.805 C 171.781 22.531 184.938 22.465 189.379 29.660 Z"/>
      <path strokeWidth="1" d="M 180.668 27.133 C 183.180 31.199 177.988 38.961 169.070 44.461 C 160.152 49.965 150.891 51.129 148.379 47.059 C 145.867 42.992 151.062 35.234 159.977 29.730 C 168.895 24.227 178.156 23.062 180.668 27.133 Z"/>
      {/* Face button fills (Y, X, Menu) */}
      <path fillRule="nonzero" fill="currentColor" fillOpacity="0.28" stroke="none" d="M 232.695 64.777 C 236.160 70.395 231.320 79.672 221.879 85.496 C 212.441 91.324 201.977 91.492 198.512 85.875 C 195.043 80.258 199.887 70.980 209.324 65.156 C 218.766 59.328 229.227 59.160 232.695 64.777"/>
      <path fillRule="nonzero" fill="currentColor" fillOpacity="0.28" stroke="none" d="M 171.711 93.473 C 175.305 99.297 170.953 108.500 161.996 114.031 C 153.035 119.559 142.859 119.320 139.266 113.496 C 135.672 107.676 140.020 98.469 148.980 92.941 C 157.938 87.410 168.117 87.648 171.711 93.473"/>
      <path fillRule="nonzero" fill="currentColor" fillOpacity="0.28" stroke="none" d="M 129.066 90.336 C 131.449 94.199 126.887 101.340 118.879 106.281 C 110.867 111.227 102.441 112.105 100.055 108.242 C 97.672 104.379 102.234 97.238 110.242 92.297 C 118.254 87.352 126.680 86.477 129.066 90.336"/>
      <path strokeWidth="1" d="M 316.449 22.016 C 318.562 26.187 325.691 64.340 305.336 102.578 C 283.137 144.289 243.004 173.516 243.004 173.516 C 243.004 173.516 213.605 197.629 168.035 202.371 C 122.465 207.113 90.379 186.816 90.379 186.816 C 90.379 186.816 53.047 166.453 78.035 116.867"/>
      <path strokeWidth="1" d="M 18.066 421.832 C 18.066 421.832 0.500 402.371 11.766 347.035 C 21.496 299.250 76.742 173.578 76.742 173.578"/>
      {/* Y button strokes */}
      <path strokeWidth="2" d="M 150.156 93.926 L 155.488 105.371"/>
      <path strokeWidth="2" d="M 161.379 91.594 C 161.379 91.594 149.379 100.371 142.715 106.480"/>
      {/* X button strokes */}
      <path strokeWidth="2" d="M 210.156 65.926 L 210.609 74.344"/>
      <path strokeWidth="2" d="M 222.715 63.480 C 222.715 63.480 213.434 69.426 207.156 78.926"/>
      {/* Menu strokes */}
      <path strokeWidth="2" d="M 108.340 95.578 L 123.922 95.578"/>
      <path strokeWidth="2" d="M 106.090 99.289 L 121.004 99.289"/>
      <path strokeWidth="2" d="M 103.465 102.578 L 119.172 102.578"/>
    </g>
  );
});

const RightPaths = memo(function RightPaths() {
  return (
    <g stroke="currentColor" fill="none" strokeMiterlimit="10">
      {/* Thumbstick */}
      <path strokeWidth="1" d="M 522.348 45.277 C 516.695 43.801 512.426 44.219 510.867 46.742 C 508.148 51.145 515.188 60.414 526.586 67.445 C 537.980 74.480 549.422 76.617 552.137 72.219 C 553.660 69.754 551.953 65.484 548.301 61.215"/>
      <path strokeWidth="1" d="M 521.668 45.238 C 519.203 49.234 523.113 56.121 530.406 60.621 C 537.699 65.121 545.609 65.531 548.074 61.535"/>
      <path strokeWidth="1" d="M 520.168 29.660 C 515.727 36.859 521.684 48.590 533.473 55.867 C 545.258 63.141 558.414 63.207 562.859 56.008 C 567.301 48.812 561.344 37.082 549.555 29.805 C 537.766 22.531 524.609 22.465 520.168 29.660 Z"/>
      <path strokeWidth="1" d="M 528.879 27.133 C 526.367 31.199 531.562 38.961 540.477 44.461 C 549.395 49.965 558.656 51.129 561.168 47.059 C 563.680 42.992 558.484 35.234 549.570 29.730 C 540.652 24.227 531.391 23.062 528.879 27.133 Z"/>
      {/* Face button fills (B, A, Meta) */}
      <path fillRule="nonzero" fill="currentColor" fillOpacity="0.28" stroke="none" d="M 476.852 64.777 C 473.387 70.395 478.227 79.672 487.668 85.496 C 497.105 91.324 507.570 91.492 511.035 85.875 C 514.504 80.258 509.660 70.980 500.223 65.156 C 490.781 59.328 480.320 59.160 476.852 64.777"/>
      <path fillRule="nonzero" fill="currentColor" fillOpacity="0.28" stroke="none" d="M 537.840 93.473 C 534.242 99.297 538.594 108.500 547.551 114.031 C 556.512 119.559 566.688 119.320 570.281 113.496 C 573.875 107.676 569.527 98.469 560.566 92.941 C 551.609 87.410 541.434 87.648 537.840 93.473"/>
      <path fillRule="nonzero" fill="currentColor" fillOpacity="0.28" stroke="none" d="M 580.480 90.336 C 578.098 94.199 582.660 101.340 590.672 106.281 C 598.684 111.227 607.109 112.105 609.492 108.242 C 611.875 104.379 607.313 97.238 599.305 92.297 C 591.293 87.352 582.867 86.477 580.480 90.336"/>
      {/* Main body */}
      <path strokeWidth="1" d="M 596.191 188.148 C 562.895 200.641 523.340 202.191 470.691 166.453 C 440.254 145.793 421.141 118.051 406.023 90.578"/>
      <path strokeWidth="1" d="M 508.078 209.203 C 496.246 223.258 524.941 226.703 542.191 231.203 C 555.543 234.688 579.941 236.453 581.523 256.371 C 583.004 274.984 570.023 279.199 570.023 279.199"/>
      <path strokeWidth="1" d="M 467.086 173.578 C 474.301 187.977 482.184 198.676 491.762 203.090 C 509.012 211.039 538.039 218.320 587.691 226.035 C 614.477 230.199 609.645 261.875 596.246 270.816 C 583.359 279.414 561.578 281.926 536.691 277.926 C 511.801 273.926 511.801 259.258 511.801 259.258 C 511.801 259.258 508.414 232.035 506.191 220.035 C 505.938 218.816 505.695 217.699 505.465 216.676"/>
      <path strokeWidth="1" d="M 560.953 40.672 C 583.051 55.754 604.457 75.629 622.914 101.191 L 625.137 104.594 C 625.137 104.594 637.586 124.922 644.691 150.816 C 670.914 246.371 762.879 397.719 665.578 440.148 C 606.469 465.926 571.711 406.062 547.887 348.984 C 531.254 309.137 520.691 272.371 520.691 272.371"/>
      <path strokeWidth="1" d="M 494.859 204.453 C 490.523 203.090 435.441 189.621 428.148 186.918 C 424.746 185.656 421.234 184.637 418.824 181.930 C 416.828 179.691 414.707 176.418 413.137 171.703 C 409.137 159.703 388.637 99.191 387.801 93.926 C 385.082 76.785 385.070 56.586 385.578 52.148 C 386.469 44.426 386.914 17.480 410.023 6.371 C 430.848 -4.180 481.762 -1.895 533.895 24.637"/>
      <path strokeWidth="1" d="M 387.309 92.344 C 387.309 92.344 380.293 140.762 380.676 146.371 C 381.176 153.730 387.812 157.703 411.352 166.453"/>
      <path strokeWidth="1" d="M 393.289 22.016 C 391.176 26.187 384.047 64.340 404.402 102.578 C 426.602 144.289 466.734 173.516 466.734 173.516 C 466.734 173.516 496.133 197.629 541.703 202.371 C 587.273 207.113 619.359 186.816 619.359 186.816 C 619.359 186.816 656.691 166.453 631.703 116.867"/>
      <path strokeWidth="1" d="M 691.672 421.832 C 691.672 421.832 709.238 402.371 697.973 347.035 C 688.242 299.250 632.996 173.578 632.996 173.578"/>
      {/* Meta logo glyph */}
      <path fillRule="nonzero" fill="#ffffff" fillOpacity="1" stroke="none" d="M 604.629 103.488 C 604.402 103.566 603.520 103.621 601.797 102.430 C 600.078 101.242 596.188 98.348 596.188 98.348 C 596.188 98.348 595.969 96.496 597.297 96.578 C 598.629 96.656 600.156 97.656 602.617 100.035 C 605.359 102.684 604.852 103.406 604.629 103.488 Z M 593.965 103.348 C 593.387 103.523 592.086 103.234 590.703 101.113 C 589.254 98.895 589.414 97.238 589.961 96.820 C 590.508 96.402 591.461 96.730 591.828 96.914 C 592.711 97.363 594.563 98.730 594.563 98.730 C 594.563 98.730 594.547 101.352 594.563 101.563 C 594.578 101.770 594.547 103.172 593.965 103.348 Z M 605.785 101.836 C 604.996 100.902 599.820 95.035 596.348 95.355 C 594.691 95.438 594.676 97.301 594.676 97.301 C 594.676 97.301 590.652 94.246 588.547 94.984 C 586.441 95.727 587.969 99.809 588.805 100.918 C 589.641 102.027 592.332 105.945 595.719 104.988 C 597.313 104.535 596.172 100.004 596.172 100.004 C 596.172 100.004 601.379 104.023 603.504 104.715 C 605.625 105.406 606.254 105.102 606.637 104.762 C 607.023 104.426 606.574 102.770 605.785 101.836"/>
      {/* B button strokes */}
      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M 493.957 71.207 C 493.957 71.207 496.793 70.980 501.457 71.164 C 505.664 71.332 510.465 78.703 502.371 79.000 C 499.953 79.117 497.660 79.121 497.121 78.000 C 493.469 71.910 489.457 65.164 489.457 65.164 C 489.457 65.164 494.539 65.125 496.707 65.625 C 498.871 66.125 502.957 68.250 500.957 70.750"/>
      {/* A button strokes */}
      <path strokeWidth="2" d="M 555.629 106.785 C 555.629 106.785 555.090 97.375 554.215 93.035"/>
      <path strokeWidth="2" d="M 569.629 107.535 C 569.629 107.535 563.254 98.148 554.715 93.730"/>
      <path strokeWidth="2" d="M 555.629 101.703 C 555.629 101.703 559.422 101.355 564.477 101.617"/>
    </g>
  );
});

// ── Hotspot overlay ───────────────────────────────────────────────────────────
function Hotspot({
  x, y, label, holdable, state,
  onDown, onUp, onEnter, onLeave,
}: {
  x: number; y: number; label: string; holdable: boolean; state: ButtonState;
  onDown: () => void; onUp: () => void; onEnter: () => void; onLeave: () => void;
}) {
  const { ring, fill, dot, outer } = sc(state);
  const isActive = state !== "idle";

  return (
    <g transform={`translate(${x} ${y})`} style={{ cursor: "pointer" }}
      onMouseDown={onDown} onMouseUp={onUp}
      onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {/* Outer glow ring */}
      <circle r={outer} fill={fill} stroke={ring}
        strokeOpacity={isActive ? 1 : 0.4}
        strokeWidth={isActive ? 2 : 1.5}
        style={{
          filter: (state === "press" || state === "hold") ? `drop-shadow(0 0 6px ${ring})` : "none",
          transition: "all 0.15s ease",
        }} />
      {/* Hold pulse ring */}
      {state === "hold" && (
        <circle r={outer + 6} fill="none" stroke="#FF3D00" strokeWidth="1" strokeOpacity="0.4"
          style={{ animation: "holdPulse 0.8s ease-in-out infinite" }} />
      )}
      {/* Centre dot */}
      <circle r={3.5} fill={dot} style={{ transition: "all 0.15s ease" }} />
      {/* Label */}
      <text y={outer + 12} textAnchor="middle"
        fontSize="9" fontFamily="Inter" fontWeight="600"
        fill={isActive ? ring : "rgba(255,246,230,0.4)"}
        style={{ pointerEvents: "none", userSelect: "none", transition: "fill 0.15s ease" }}>
        {label}{holdable && state === "hold" ? " ●" : ""}
      </text>
    </g>
  );
}

// ── State pill ────────────────────────────────────────────────────────────────
function Pill({ state }: { state: ButtonState }) {
  const m = {
    idle:  { c: "#8A8176", bg: "rgba(138,129,118,0.1)" },
    hover: { c: "#FFF6E6", bg: "rgba(255,246,230,0.1)" },
    press: { c: "#FFC61A", bg: "rgba(255,198,26,0.15)" },
    hold:  { c: "#FF3D00", bg: "rgba(255,61,0,0.15)"  },
  };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 9px", borderRadius:100,
      background:m[state].bg, color:m[state].c,
      fontFamily:"Inter", fontSize:10, fontWeight:700, letterSpacing:"0.1em" }}>
      {state.toUpperCase()}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuestController() {
  const [log, setLog] = useState<{id:string;btn:string;state:ButtonState;ts:number}[]>([]);
  const logId = useRef(0);

  const emit = useCallback((btn: string, s: ButtonState) => {
    if (s !== "idle") setLog(p => [{id:String(logId.current++),btn,state:s,ts:Date.now()},...p].slice(0,20));
  }, []);

  // Right controller buttons — hotspot coords from controls.ts
  const rTrig  = useBtn(true,  s => emit("R Trigger",    s));
  const rGrip  = useBtn(true,  s => emit("R Grip",       s));
  const rStick = useBtn(true,  s => emit("R Thumbstick", s));
  const rA     = useBtn(false, s => emit("A",            s));
  const rB     = useBtn(true,  s => emit("B",            s));
  const rMeta  = useBtn(false, s => emit("Meta",         s));

  // Left controller buttons
  const lTrig  = useBtn(true,  s => emit("L Trigger",    s));
  const lGrip  = useBtn(true,  s => emit("L Grip",       s));
  const lStick = useBtn(true,  s => emit("L Thumbstick", s));
  const lX     = useBtn(false, s => emit("X",            s));
  const lY     = useBtn(true,  s => emit("Y",            s));
  const lMenu  = useBtn(false, s => emit("Menu",         s));

  const allBtns = [
    { label:"R Trigger", holdable:true,  state:rTrig.state  },
    { label:"R Grip",    holdable:true,  state:rGrip.state  },
    { label:"R Stick",   holdable:true,  state:rStick.state },
    { label:"A",         holdable:false, state:rA.state     },
    { label:"B",         holdable:true,  state:rB.state     },
    { label:"Meta",      holdable:false, state:rMeta.state  },
    { label:"L Trigger", holdable:true,  state:lTrig.state  },
    { label:"L Grip",    holdable:true,  state:lGrip.state  },
    { label:"L Stick",   holdable:true,  state:lStick.state },
    { label:"X",         holdable:false, state:lX.state     },
    { label:"Y",         holdable:true,  state:lY.state     },
    { label:"Menu",      holdable:false, state:lMenu.state  },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0D0B08", display:"flex", flexDirection:"column",
      fontFamily:"Inter,sans-serif", padding:"28px 36px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"baseline", gap:16, marginBottom:20 }}>
        <h1 style={{ fontFamily:"Chakra Petch,sans-serif", fontStyle:"italic", fontWeight:700, fontSize:20,
          background:"linear-gradient(135deg,#FFC61A,#F5A81C)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          margin:0, letterSpacing:"0.06em" }}>QUEST 3 · TOUCH PLUS</h1>
        <span style={{ color:"#8A8176", fontSize:12, letterSpacing:"0.08em" }}>Interactive Input Reference</span>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:20, marginBottom:20, flexWrap:"wrap" }}>
        {([["idle","No input"],["hover","Ray-cast aim"],["press","< 500 ms"],["hold","≥ 500 ms"]] as [ButtonState,string][]).map(([sv,desc]) => {
          const { ring, fill } = sc(sv);
          return (
            <div key={sv} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:12, borderRadius:3, background:fill,
                border:`1.5px solid ${ring}` }} />
              <Pill state={sv} />
              <span style={{ color:"#8A8176", fontSize:11 }}>{desc}</span>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:32, flex:1 }}>

        {/* SVG Controllers — both in one canvas, viewBox matches artwork exactly */}
        <div style={{ background:"rgba(13,11,8,0.5)", borderRadius:16, position:"relative", overflow:"hidden",
          display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
          {/* Gold top edge */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
            background:"linear-gradient(90deg,transparent,rgba(255,198,26,0.5) 30%,rgba(255,198,26,0.5) 70%,transparent)" }} />

          <svg viewBox="0 0 709.74 446.81" style={{ width:"100%", maxWidth:860, height:"auto" }}
            role="img" aria-label="Meta Quest 3 Touch Plus controllers">

            {/* Background glow blobs */}
            <ellipse cx="168" cy="150" rx="120" ry="90" fill="rgba(255,198,26,0.02)" />
            <ellipse cx="542" cy="150" rx="120" ry="90" fill="rgba(255,198,26,0.02)" />

            {/* Traced line-art — warm off-white */}
            <g color="rgba(255,246,230,0.7)">
              <LeftPaths />
              <RightPaths />
            </g>

            {/* ── Left controller hotspots ── */}
            {/* l_thumbstick: x=168, y=43 */}
            <Hotspot x={168} y={43} label="Thumbstick" holdable state={lStick.state}
              onDown={lStick.down} onUp={lStick.up} onEnter={lStick.enter} onLeave={lStick.leave} />
            {/* l_y: x=217, y=75 */}
            <Hotspot x={217} y={75} label="Y" holdable state={lY.state}
              onDown={lY.down} onUp={lY.up} onEnter={lY.enter} onLeave={lY.leave} />
            {/* l_x: x=157, y=103 */}
            <Hotspot x={157} y={103} label="X" holdable={false} state={lX.state}
              onDown={lX.down} onUp={lX.up} onEnter={lX.enter} onLeave={lX.leave} />
            {/* l_menu: x=113, y=99 */}
            <Hotspot x={113} y={99} label="Menu" holdable={false} state={lMenu.state}
              onDown={lMenu.down} onUp={lMenu.up} onEnter={lMenu.enter} onLeave={lMenu.leave} />
            {/* l_trigger: centered on trigger lever shape (128–213, 209–279) */}
            <Hotspot x={153} y={258} label="Trigger" holdable state={lTrig.state}
              onDown={lTrig.down} onUp={lTrig.up} onEnter={lTrig.enter} onLeave={lTrig.leave} />
            {/* l_grip: grip paddle above-right of trigger */}
            <Hotspot x={196} y={246} label="Grip" holdable state={lGrip.state}
              onDown={lGrip.down} onUp={lGrip.up} onEnter={lGrip.enter} onLeave={lGrip.leave} />

            {/* ── Right controller hotspots ── */}
            {/* r_thumbstick: x=542, y=43 */}
            <Hotspot x={542} y={43} label="Thumbstick" holdable state={rStick.state}
              onDown={rStick.down} onUp={rStick.up} onEnter={rStick.enter} onLeave={rStick.leave} />
            {/* r_b: x=493, y=75 */}
            <Hotspot x={493} y={75} label="B" holdable state={rB.state}
              onDown={rB.down} onUp={rB.up} onEnter={rB.enter} onLeave={rB.leave} />
            {/* r_a: x=553, y=103 */}
            <Hotspot x={553} y={103} label="A" holdable={false} state={rA.state}
              onDown={rA.down} onUp={rA.up} onEnter={rA.enter} onLeave={rA.leave} />
            {/* r_meta: x=597, y=99 */}
            <Hotspot x={597} y={99} label="Meta" holdable={false} state={rMeta.state}
              onDown={rMeta.down} onUp={rMeta.up} onEnter={rMeta.enter} onLeave={rMeta.leave} />
            {/* r_trigger: mirror of left at axis 354.87 */}
            <Hotspot x={557} y={258} label="Trigger" holdable state={rTrig.state}
              onDown={rTrig.down} onUp={rTrig.up} onEnter={rTrig.enter} onLeave={rTrig.leave} />
            {/* r_grip: mirror of left grip */}
            <Hotspot x={514} y={246} label="Grip" holdable state={rGrip.state}
              onDown={rGrip.down} onUp={rGrip.up} onEnter={rGrip.enter} onLeave={rGrip.leave} />

            {/* Controller labels */}
            <text x="168" y="440" textAnchor="middle" fontSize="11" fontFamily="Inter"
              fontWeight="600" fill="rgba(255,246,230,0.3)" letterSpacing="0.12em">LEFT</text>
            <text x="542" y="440" textAnchor="middle" fontSize="11" fontFamily="Inter"
              fontWeight="600" fill="rgba(255,246,230,0.3)" letterSpacing="0.12em">RIGHT</text>
          </svg>
        </div>

        {/* Right panel */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* Button states table */}
          <div style={{ background:"rgba(13,11,8,0.72)", borderRadius:16, position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
              background:"linear-gradient(90deg,transparent,rgba(255,198,26,0.5) 30%,rgba(255,198,26,0.5) 70%,transparent)" }} />
            <div style={{ padding:"18px 20px" }}>
              <p style={{ color:"#8A8176", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 12px" }}>
                Button States
              </p>
              {allBtns.map((b, i) => (
                <div key={b.label} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 0",
                  borderBottom: i < allBtns.length-1 ? "1px solid rgba(255,246,230,0.05)" : "none" }}>
                  <Pill state={b.state} />
                  <span style={{ color:"#FFF6E6", fontSize:12, fontWeight:600, flex:1 }}>{b.label}</span>
                  {b.holdable && <span style={{ color:"#8A8176", fontSize:9, letterSpacing:"0.06em" }}>HOLD</span>}
                  {b.state !== "idle" && (
                    <div style={{ width:6, height:6, borderRadius:"50%",
                      background: b.state==="hold" ? "#FF3D00" : "#FFC61A",
                      boxShadow:`0 0 6px ${b.state==="hold"?"#FF3D00":"#FFC61A"}`,
                      animation:"blink 0.9s ease-in-out infinite" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Event log */}
          <div style={{ background:"rgba(13,11,8,0.72)", borderRadius:16, position:"relative", overflow:"hidden", flex:1 }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
              background:"linear-gradient(90deg,transparent,rgba(255,198,26,0.5) 30%,rgba(255,198,26,0.5) 70%,transparent)" }} />
            <div style={{ padding:"18px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <p style={{ color:"#8A8176", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", margin:0 }}>Input Log</p>
                {log.length > 0 && <button onClick={() => setLog([])} style={{ background:"none",border:"none",color:"#8A8176",fontSize:11,cursor:"pointer",padding:0 }}>Clear</button>}
              </div>
              {log.length === 0
                ? <p style={{ color:"#8A8176", fontSize:12, margin:0 }}>Click any button…</p>
                : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {log.map((e, i) => (
                      <div key={e.id} style={{ display:"flex", alignItems:"center", gap:8,
                        opacity:Math.max(0.25, 1 - i * 0.055) }}>
                        <span style={{ fontFamily:"monospace", fontSize:9, color:"#8A8176", width:38, flexShrink:0 }}>
                          +{((Date.now()-e.ts)/1000).toFixed(1)}s
                        </span>
                        <Pill state={e.state} />
                        <span style={{ color:"#C9BFB0", fontSize:11 }}>{e.btn}</span>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          <p style={{ color:"#8A8176", fontSize:10, textAlign:"center", margin:0, lineHeight:1.6 }}>
            Hold trigger or grip ≥ 500 ms for HOLD state
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes holdPulse { 0%,100%{opacity:0.4;r:26} 50%{opacity:0;r:34} }
      `}</style>
    </div>
  );
}
