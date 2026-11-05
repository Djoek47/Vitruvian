ROLE
Continuing the Faberland XR design system. This prompt covers the INPUT MODEL, the
OBJECT MANIPULATION SYSTEM, the HELMET HUD LAYER, and the VITRUVIAN BODY EDITOR.
Reuse the color variables, dmm type scale, and components already built. Do not
invent a second design language.

================================================================
PART 1 — HARDWARE INPUT REFERENCE
================================================================
The app runs on Meta Quest 3 and Quest 3S with Touch Plus controllers, and also
supports controller-free hand tracking. Every interaction must be designed twice:
once for controllers, once for hands. Design the affordance labels accordingly.

CONTROLLER INPUTS — right controller
  thumbstick    move / scroll / rotate — click for reset
  A button      primary confirm
  B button      back / cancel
  trigger       (index finger, analog 0–1) select, grab-at-distance, drag
  grip          (middle finger, analog 0–1) grab-when-touching, two-hand scale
  Meta button   RESERVED BY SYSTEM — never bind, never design for it

CONTROLLER INPUTS — left controller
  thumbstick    snap-turn / pan
  X button      open palm menu
  Y button      toggle assistant listening
  trigger       select
  grip          grab
  Menu button   RESERVED BY SYSTEM

HAND-TRACKING EQUIVALENTS
  pinch (index + thumb)        = trigger / select
  pinch and drag               = drag
  two-hand pinch, pull apart   = uniform scale
  full grab (all fingers)      = grip
  palm turned upward           = open palm menu
  poke with index fingertip    = direct touch on near panels

Design an INPUT GLYPH SET: one icon per input above, in two families — controller
glyphs and hand-gesture glyphs. 48 dmm bounding box, 3 dmm stroke minimum. These
appear in tooltips, onboarding, and the hint bar. Build as a component with a
variant switch (controller / hands) so every hint in the app can flip families
from a single toggle.

INTERACTION DISTANCE MODEL — three ranges, design affordances for each
  DIRECT   under 0.5 m — poke and direct grab. Buttons need a visible press depth
           state and a contact highlight.
  RAY      0.5 m to 5 m — laser pointer from controller or pinch ray from hand.
           Needs a ray beam style, a cursor, and a distinct ray-hover state on
           every target.
  GAZE     fallback when hands are down. Dwell-to-select with a radial fill timer.

================================================================
PART 2 — MANIPULATION SYSTEM (scaling, sizing, placing)
================================================================
This is how users resize and position virtual objects, rooms, storefronts, and
panels. Build a complete manipulation toolkit.

SELECTION STATES — design all four for any manipulable object
  unselected    no chrome
  hovered       gold outline, 3 dmm, 60% opacity
  selected      gold outline at full opacity + corner brackets + handle set visible
  locked        ember dashed outline, handles hidden, lock glyph in corner

BOUNDING BOX AND HANDLES
- Bounding box drawn as 8 corner brackets, not a continuous wireframe. Brackets
  are 80 dmm long, 4 dmm thick, faber/gold.
- Corner handles: uniform scale. Sphere, 40 dmm diameter.
- Edge handles: single-axis scale. Capsule, 32 dmm.
- Face handles: push/pull depth. Flat disc, 36 dmm.
- Rotation ring: one per axis, color-coded — X ember, Y gold, Z state/info.
  Rings are 6 dmm thick, appear only in rotate mode.
- All handles have rest / hover / active variants. Active handle goes full
  opacity, all other handles drop to 25%.

TWO-HAND SCALE GESTURE
Design the visual feedback: a connecting line between both grab points, a live
numeric readout at the midpoint showing scale factor and resulting real-world
dimensions, and a snap indicator that flashes when passing a snap increment.

NUMERIC PRECISION CONTROLS — a floating inspector panel, 640 × 900 dmm
  - Dimension rows: W / D / H, each with a numeric field, a stepper, and a
    drag-scrub zone
  - Unit toggle: cm / m / inches / feet
  - Uniform-scale lock (chain-link toggle)
  - Position: X / Y / Z with the same row pattern
  - Rotation: pitch / yaw / roll, degree fields with snap-to-15° toggle
  - Snap increment selector: off / 1 cm / 10 cm / 25 cm / 1 m
  - Reset to original, duplicate, delete
  - "Fit to my body" — applies the user's Vitruvian measurements to scale the
    object to human proportion

MODE SWITCHER — segmented control, 4 modes
  move / rotate / scale / measure
Measure mode: tape-measure tool. Point-to-point in world space, live distance
readout on the line, ability to drop multiple measurement segments and keep them
visible. Design the measurement label chip: 240 × 64 dmm, panel-glass, gold text.

HINT BAR
A persistent 1000 × 72 dmm body-locked strip showing the 3–4 currently relevant
input glyphs with one-word labels. Contents change by mode. Build one component
with slots.

================================================================
PART 3 — HELMET HUD LAYER
================================================================
A sparse head-locked frame evoking a powered-helmet interior view. Read the
constraints before designing.

HARD CONSTRAINTS
- Head-locked elements render at 1.5 m virtual depth minimum. Never closer.
- Maximum 6 head-locked elements on screen at once. Target 3.
- Nothing head-locked within the central 20° cone — that space stays clear.
- No full-screen frames, vignettes, scanlines, or tinted overlays. They induce
  discomfort and destroy passthrough legibility.
- Head-locked elements sit at 40–70% opacity at rest and rise to full only on
  state change.

HUD ELEMENTS TO DESIGN
  - Corner reticle brackets: 4 thin gold brackets marking the comfortable field,
    each 120 dmm, 2 dmm stroke, 35% opacity
  - Assistant star, upper-right periphery, 96 dmm (already built — place it)
  - Status cluster, upper-left: connection, mic state, lobby occupancy. Three
    24 dmm glyphs in a row with a 4 dmm gold underline.
  - Compass strip, top-center, 600 × 48 dmm, degree ticks, district names
  - Target lock: when the ray hovers a world object, animated brackets converge
    on it with a name label beneath. This is the element that should carry the
    most personality — design 3 frames of the convergence.
  - Alert band, bottom periphery, 900 × 80 dmm, appears only on critical events
  - Boot sequence: 4 frames, wordmark resolving into the HUD frame, 2.5 s total

EVERYTHING ELSE IS BODY-LOCKED. The data panels, transcripts, inventory, maps,
and inspectors follow the torso with lazy-follow. Label each frame with its zone.

================================================================
PART 4 — VITRUVIAN BODY EDITOR
================================================================
A precise, adjustable human body model used to fit avatars, size garments, and
scale architectural spaces to the user. This is the product's proprietary system —
design it as a serious measurement instrument, not a character creator.

LAYOUT
Three-panel body-locked workspace, total 2400 dmm wide:
  LEFT   440 dmm — measurement list, scrollable, grouped
  CENTER 1200 dmm — body viewport, front / side / three-quarter / back views
  RIGHT  640 dmm — detail editor for the selected measurement

MEASUREMENT SET — every row is individually adjustable
  Global      height, wingspan, total mass, eye height, IPD
  Head/neck   head circumference, neck circumference, neck length
  Torso       shoulder width (biacromial), chest, underbust, waist, high hip,
              hip, torso length, back length (nape to waist)
  Arms        upper arm length, forearm length, sleeve length (shoulder to wrist),
              bicep circumference, forearm circumference, wrist circumference
  Legs        inseam, outseam, thigh circumference, knee height,
              calf circumference, ankle circumference
  Extremities hand length, hand span, foot length, foot width

MEASUREMENT ROW COMPONENT
  [icon] [label] [value] [unit] [confidence badge] [lock toggle]
  Height 64 dmm minimum. Variants: rest / hover / selected / edited / conflicted.

CONFIDENCE SYSTEM — this is important, design it clearly
  measured   solid gold dot — captured directly from headset and controller
             tracking during the scan
  derived    hollow gold ring — computed from other measurements via
             anthropometric ratio
  estimated  gray dot — population average, low confidence, prompts the user
  manual     ember dot — user-entered, overrides everything
  conflicted ember triangle — entered value is anthropometrically inconsistent
             with locked values; show what it conflicts with

DETAIL EDITOR (right panel)
  - Large numeric field with unit toggle
  - Coarse slider plus a fine drag-scrub strip beneath it
  - Plus/minus steppers at 1 mm and 10 mm increments
  - Range indicator showing population percentile for that dimension
  - Symmetry lock — mirror left/right limb values
  - "Where this comes from" — shows whether measured, derived, or estimated, and
    which other measurements it depends on
  - Re-measure this dimension — triggers a targeted capture

BODY VIEWPORT
  - Wireframe-over-silhouette treatment, gold contour lines on panel-glass
  - The currently selected measurement highlights on the model with a callout
    pin and a dimension line with end ticks
  - View selector: front / side / 3-quarter / back, plus a free-orbit control
  - Ghost overlay toggle: show a previous profile beneath the current one
  - Landmark points: small nodes at shoulder, elbow, wrist, hip, knee, ankle;
    draggable for manual correction

SCAN FLOW — 6 frames
  1. Consent — what is captured, where it is stored, how to delete it.
     Explicit, plain language, with a decline path that still lets the app work.
  2. Space check — clearance required, guardian boundary confirmation
  3. Calibration — stand straight, arms at sides, controllers held
  4. T-pose capture — silhouette guide with live alignment feedback,
     per-limb capture progress
  5. Motion capture — a short sequence of reach and turn movements
  6. Results — measurement summary with confidence breakdown, accept or refine

PROFILE MANAGEMENT
  - Multiple saved profiles with names and dates
  - Compare two profiles side by side with a delta column
  - Export and delete profile, both prominent, not buried in settings
  - Fit preview: apply the profile to an avatar, a garment, and a room, and show
    the resulting fit as three thumbnail states

================================================================
DO NOT
================================================================
- Do not design the HUD as a flat camera overlay with a full-screen frame.
- Do not put more than 6 elements in the head-locked layer.
- Do not use body-type sliders, presets, or archetype silhouettes in the body
  editor. This is a measurement tool, not a character creator.
- Do not hide the consent or delete controls.
- Do not design controller-only affordances. Every interaction gets a hand
  equivalent.
- Do not use the reserved Meta or Menu buttons in any binding or hint.
- Do not reuse warning orange for anything that is not a warning.