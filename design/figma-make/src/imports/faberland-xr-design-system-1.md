CONTEXT
Continuing the Faberland Quest XR design system. The foundations page (color
variables, dmm type scale, spacing, elevation) already exists. Do not redefine it.
This job builds the COMPONENT BANK only. Generate no screens.

Attached is faberland_command_registry.csv, the project's command registry. Use its
icon_id column as the source of truth for icon naming and its component column to
know which component each command consumes. Do not invent icon names.

NAMING CONVENTION — follow exactly, it maps to Unreal UMG widget names
  Component:  FL_<Type>            e.g. FL_Button, FL_IconButton, FL_ListRow
  Variant:    Type=<x>, State=<y>  e.g. Type=Primary, State=RayHover
  Icon:       FL_Icon/<icon_id>    e.g. FL_Icon/icon_vitruvian
  Glyph:      FL_Glyph/<family>/<input>  e.g. FL_Glyph/Hands/pinch

================================================================
BATCH 1 — INPUT GLYPH SET
================================================================
Two families, same 48 dmm bounding box, 3 dmm minimum stroke, flat faber/gold,
no fill gradients. Build as ONE component with a Family variant switch so every
hint in the app flips from a single toggle.

FAMILY = Controller (12 glyphs)
  thumbstick_move, thumbstick_click, button_a, button_b, button_x, button_y,
  trigger_press, trigger_hold, grip_press, grip_hold, both_grips, controller_body
Draw the Touch Plus silhouette with the relevant input highlighted in gold and the
rest of the body at 30% opacity. Do not draw the Meta or Menu buttons.

FAMILY = Hands (12 glyphs)
  pinch, pinch_hold, pinch_drag, two_hand_pinch, full_grab, palm_up, palm_down,
  poke, point, open_hand, thumbs_rest, dwell_gaze
Draw a simplified hand from a three-quarter angle. Active fingers gold at full
opacity, inactive at 30%. Motion indicated by a single 3 dmm arc with an arrowhead,
never by multiple ghost frames.

Also produce FL_Glyph/Dwell — a radial fill timer ring, 8 frames from empty to
full, for gaze fallback selection.

================================================================
BATCH 2 — CORE INTERACTIVE COMPONENTS
================================================================
Every component gets the full state matrix. This is not optional and it is the
whole point of this batch.

STATE MATRIX (apply to every interactive component)
  Rest        base treatment
  RayHover    gold outline 3 dmm, fill lifts one step, scales to 102%
  PinchActive fill goes solid faber/gold, label flips to faber/panel, scales to 98%
  Pressed     amber fill, no scale change, 2 dmm inset shadow-free depth line
  Disabled    35% opacity throughout, no outline, no hover response
  Focused     for gaze fallback - dwell ring visible on the component edge

FL_Button — Type variants: Primary, Secondary, Ghost, Destructive
  Height 96 dmm. Min width 280 dmm. Padding 32 dmm horizontal.
  Primary: faber/gold fill, faber/panel label
  Secondary: faber/surface fill, 2 dmm gold border, text/primary label
  Ghost: transparent, text/primary label, gold underline on hover only
  Destructive: faber/surface fill, 2 dmm state/error border, state/error label
  Include a WidthMode variant: Fixed, Hug, Fill
  Include an optional leading icon slot, 48 dmm
  CRITICAL: size the label area for a string 40% longer than the English label.
  Test against "Louer cet espace" and "Consentir au balayage."

FL_IconButton — 96 × 96 dmm, 48 dmm icon, circular hit area, same state matrix.
  Type variants: Default, Destructive.

FL_Toggle — track 120 × 64 dmm, knob 56 dmm. On state fills faber/gold.
  Label sits left, 32 dmm gap. Full state matrix plus On/Off.

FL_Slider — track 8 dmm, knob 56 dmm, active portion faber/gold.
  Variants: WithValue (numeric readout right-aligned), WithTicks, Plain.
  Knob hit area 88 dmm even though the visible knob is 56 dmm.

FL_ScrubStrip — a fine-adjustment companion to the slider. 640 × 72 dmm horizontal
  strip of tick marks that scrolls under a fixed centre indicator. Used for
  millimetre-level dimension editing. States: Rest, Dragging.

FL_Segmented — 2, 3, and 4 segment variants. Height 88 dmm. Selected segment
  faber/gold fill with faber/panel label. Unselected text/secondary.

FL_ListRow — height 96 dmm minimum. Slots: leading icon 48 dmm, label, value,
  trailing badge, trailing chevron. Variants: Default, WithValue, WithBadge,
  Selected, Conflicted. Conflicted uses an ember left edge 4 dmm.

FL_Chip — height 72 dmm, radius 36 dmm, hug width, 24 dmm padding.
  Types: Suggestion, Filter, Colour. Colour type shows a 40 dmm swatch.

FL_InputNumeric — 480 × 96 dmm. Numeric field, unit suffix, stepper buttons at
  both ends. Variants: Rest, Focused, Editing, Invalid.
  Editing state shows a dictation glyph if voice entry is available.

FL_InputText — 640 × 96 dmm with a persistent dictation affordance on the right,
  48 dmm. States: Rest, Focused, Dictating (dictation glyph animates), Filled.

FL_Tooltip — panel-glass, 24 dmm radius, 24 dmm padding. Contains a glyph slot
  and one line of text. Variants: Above, Below, Left, Right.

FL_ConfirmModal — 800 × 520 dmm. Title, body text, and two buttons: a Ghost
  cancel on the left and a Destructive confirm on the right. Never the reverse.
  Used by the eight registry commands where destructive = yes.

================================================================
BATCH 3 — MANIPULATION HANDLES
================================================================
All handles are world-space gizmos. Draw them flat for the Figma library; the
developer will place them in 3D.

FL_Handle/Bracket — one corner bracket, 80 dmm arms, 4 dmm thick, faber/gold.
  Build the 8-bracket assembly as a separate FL_Handle/BracketSet frame.
  States: Hovered (60% opacity), Selected (100%), Locked (ember, dashed).

FL_Handle/Corner — sphere, 40 dmm. Uniform scale.
FL_Handle/Edge — capsule, 32 dmm. Single-axis scale.
FL_Handle/Face — flat disc, 36 dmm. Push-pull depth.
  Each: Rest, Hover, Active. On Active, this handle goes full opacity and all
  sibling handles drop to 25% — draw that sibling-dimmed state explicitly.

FL_Handle/RotationRing — 6 dmm thick. Three colour variants:
  X = faber/ember, Y = faber/gold, Z = state/info.
  States: Rest, Hover, Dragging (with a degree readout chip attached).

FL_Handle/Node — 32 dmm draggable joint marker for Vitruvian landmark correction.
  States: Rest, Hover, Dragging, Locked, Auto (hollow, meaning derived not measured).

FL_Readout/Scale — the two-hand scale feedback: a connecting line between grab
  points, a midpoint chip showing scale factor and resulting real-world dimensions,
  and a snap-passed flash state.

FL_Readout/Measure — measurement label chip, 240 × 64 dmm, panel-glass, gold text,
  with a dimension line and end ticks. Variants: Horizontal, Vertical, Angled.

FL_Handle/TargetLock — the HUD target-lock brackets. Four brackets converging on
  a world object with a name label beneath. Draw 3 frames of convergence plus the
  locked resting state. This element carries the most personality in the system.

================================================================
DO NOT
================================================================
- Do not generate screens or page layouts in this job.
- Do not skip RayHover or PinchActive on any interactive component.
- Do not use drop shadows or blur anywhere.
- Do not size any component below 64 dmm in its interactive dimension.
- Do not use ember as a text colour or as a fill over 48 × 48 dmm.
- Do not draw the Meta or Menu buttons in any controller glyph.
- Do not size labels to the English string.

DELIVERABLE
All components on page 01 Components, grouped by batch, every component using
auto-layout and bound to the existing colour variables. Include a coverage frame
listing every component with its variant count so gaps are visible at a glance.