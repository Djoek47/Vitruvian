ROLE
You are a senior XR interface designer who has shipped production UI on Meta Quest 3.
Produce a complete Figma design system and screen set for a voice-first AI assistant
layer inside a VR/AR metaverse application on Meta Quest 3 and Quest 3S. Output is
flat 2D frames intended to be rebuilt as world-space widgets in Unreal Engine UMG.

PRODUCT CONTEXT
The host app is Faberland, a 3D virtual city: users walk around, enter buildings, buy
and rent commercial spaces, and attend experiences. Solo and 4-user lobbies. The
assistant is an always-available voice agent that navigates the world, answers
questions, executes commands, and runs a proprietary body-measurement flow called
"Vitruvian" that scans the user's proportions to fit their avatar and to size virtual
garments and spaces.

MEASUREMENT SYSTEM — DO NOT SUBSTITUTE FLAT-SCREEN CONVENTIONS
- Design in dmm (distance-independent millimeters). Treat 1 px = 1 dmm.
- Primary panel: 1200 × 800 dmm, placed 1.5 m from the user.
- Minimum body text 32 dmm. Absolute floor 28 dmm. Headers 56–72 dmm.
- Minimum interactive target 64 × 64 dmm, with 24 dmm minimum spacing.
- Keep critical content inside the central 60° horizontal / 40° vertical cone.
- Nothing below 24 dmm anywhere. No strokes below 3 dmm.

ANCHORING MODEL — label every frame with its zone
1. HEAD-LOCKED: maximum two persistent elements (assistant star, critical alert).
   Peripheral, never center. Must never occlude the user's hands.
2. BODY-LOCKED: the main panels, lazy-follow on the torso. 90% of the UI lives here.
3. WORLD-LOCKED: panels the user pins to a surface and walks away from.

BRAND — FABERLAND
Wordmark: angular, forward-slanted, wide-set display type in gold with a red-orange
edge. Ships as OUTLINED VECTOR ARTWORK, never as live text. Do not re-typeset it.
Symbol: a four-pointed star with concave arms, built from mirrored angle-bracket
forms, vertical axis longer than horizontal.

COLOR TOKENS (create these as Figma variables with these exact names)
  faber/gold          #FFC61A   primary accent, active state, primary action
  faber/amber         #F5A81C   gradient low stop, pressed state
  faber/ember         #FF3D00   edge and stroke only — never text, never large fill
  faber/panel         #0D0B08   warm near-black
  faber/panel-glass   #0D0B08 @ 72% opacity — default panel fill
  faber/surface       #1A1611   raised rows, input fields
  text/primary        #FFF6E6   warm off-white, never pure #FFFFFF
  text/secondary      #C9BFB0
  text/tertiary       #8A8176
  state/info          #5BC8FF
  state/success       #3DD68C
  state/error         #FF2E88   deliberately distinct from ember
  state/warning       text/primary on faber/ember — warnings ONLY

COLOR RULES
- Gold is the only accent. One gold element per panel carries the primary action.
- faber/ember appears as a 3 dmm stroke or 2 dmm underline. Never as a text color.
  Never as a fill larger than 48 × 48 dmm. It fringes through headset lenses.
- Never pair ember against gold in strokes thinner than 4 dmm.
- Gold text only at 40 dmm and above. Below that, text/primary.
- Total gold coverage under 15% of any panel's surface area.
- Because the brand accent is amber, never use amber or orange for warnings or
  errors — users will read a highlighted control as an alert.

TYPOGRAPHY
- Display face: Planet Kosmos, pending commercial license. Until confirmed, use
  Chakra Petch Italic. Section titles at 72 dmm and above ONLY.
- UI face: Inter or Archivo. Medium and Semibold only. No Light, no Thin.
- Do not skew or italicize buttons, panels, icons, or body text. The slant belongs
  to the wordmark and section titles; anywhere else it costs legibility at the
  lens edge.

THE ASSISTANT MARK — replaces any generic voice orb
The Faberland star IS the assistant's presence indicator.
CONSTRUCTION
- Single closed vector path. No raster, no blur, no gradient mesh, no blend modes.
- Normalize the geometry: all four arms share one concave radius; vertical arms
  1.4× the horizontal arms; asymmetry is vertical only.
- Arm tips terminate at 12 dmm minimum width — never a true point. Points shimmer.
- Flat faber/gold fill. Optional 3 dmm ember inner edge at 240 dmm and above only.
SIZES
  small 48 dmm (thickened arms, ratio flattened to 1.2×, no edge)
  default 96 dmm (head-locked persistent)
  hero 240 dmm (wake and boot)
STATES (one component set, six variants)
  dormant   gold at 30% opacity, static
  wake      scales 100 → 115 → 100%, opacity to full
  listening slow rotation, arm length modulates with input amplitude
  thinking  arms retract toward center, subtle counter-rotation, no spinner
  speaking  rhythmic arm pulse on output cadence
  error     static, state/error fill, no rotation
Never add a ring, halo, container, or circular backing. The silhouette is the identity.

PANEL CHROME
- faber/panel-glass with a 2 dmm faber/gold top-edge highlight at 40% opacity.
  No border on the other three sides.
- Corner radius 16 dmm minimum, 24 dmm on primary panels.
- Grab handle: 4 dmm gold bar, 120 dmm wide, centered on the bottom edge.
- No drop shadows. No glass blur — it costs fill rate and muddies passthrough.
- The wordmark appears once per session, on the boot frame only. Not in panel headers.

SCREENS — one frame each, plus state variants
1.  Dormant — in-world idle, near-invisible, star only
2.  Wake — star expanding to hero size
3.  Listening — live waveform, real-time transcript, cancel
4.  Thinking — star thinking state, no other chrome
5.  Response card — answer, 3 follow-up chips, pin and dismiss
6.  Palm menu — radial, 6 sectors, left palm turned upward
7.  Command list — scrollable, grouped by category
8.  World navigator — city map, teleport targets, search
9.  Vitruvian scan — 4 frames: posture guide (T-pose silhouette), live capture with
    progress, results readout, avatar and garment fit confirmation
10. Vitruvian detail — measurement list, confidence indicators, manual override
11. Property panel — space details, price, size, lease terms, "rent this space"
12. Multi-panel workspace — three panels arced around the user
13. Notification toast — transient, body-locked, auto-dismiss
14. Permissions — microphone, passthrough, body-scan consent (one screen each)
15. Errors — no network, mic denied, scan failed, assistant unavailable
16. Hand-tracking onboarding — pinch, ray, palm-up illustrated

COMPONENT LIBRARY (Figma components with variants)
Button (primary / secondary / ghost / destructive) × (rest / ray-hover / pinch-active
/ pressed / disabled). Icon button. Toggle. Slider. Segmented control. Tab bar. List
row. Card. Chip. Input with dictation affordance. Modal. Progress bar. Confidence
meter. Avatar chip. Assistant star. Tooltip. Panel chrome.
Every interactive component MUST have a distinct ray-hover state and a distinct
pinch-active state. These are the two states that always get skipped and they are
the two that matter most in VR.

DO NOT
- Do not design a 16:9 flat-screen layout.
- Do not use dense tables, small multi-column layouts, or data grids.
- Do not place anything bottom-center — the hands live there.
- Do not rely on color alone to communicate state.
- Do not borrow web hover states; VR hover is a raycast, design it as one.

DELIVERABLE STRUCTURE
Pages: 00 Foundations (color variables, dmm type scale, spacing, elevation),
01 Components, 02 Assistant Flow, 03 Vitruvian, 04 World & Commerce, 05 System States.
Auto-layout throughout. Variables for all colors and spacing. Annotate every frame
with its anchoring zone, panel distance in meters, and panel size in dmm.