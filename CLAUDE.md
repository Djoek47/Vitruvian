# Faberland Vitruvian: notes for Claude Code

VR body-measurement instrument (WebXR, Meta Quest Browser) plus the Body Passport / Body Intelligence platform. TypeScript, three.js, Vite. Read `README.md` and `docs/ARCHITECTURE.md` first.

## Commands
- `npm install`
- `npm test`: unit tests (engine + Body Intelligence). Must stay green.
- `npm run build`: type-check + production build to `dist/`
- `npm run dev`: HTTPS dev server on the LAN (port 5173) for the headset
- `npm run build && npm run e2e`: full flow on an emulated Quest 3 (Meta IWER). Screenshots and downloads land in `e2e/out/`.

## Rules that must not be broken
- The measurement engine (`src/core`, `src/measurement`, `src/anatomy`, `src/body`, `src/passport`, `src/intelligence`, `src/bridge`) stays free of three.js and DOM code. It is the portable core.
- Never present derived or estimated values as measured. Never mark acceptance tests VERIFIED without physical evidence (`VITRUVIAN_*_ACCEPTANCE_REPORT.md`).
- Snapshots are immutable; schema changes are additive and need a `migratePassport` step.
- Emulator data (`?emulate=`) is always flagged `simulated: true`.
- Visual source of truth: `design/figma-make/` (tokens in `src/ui/theme.ts`).

## Faberland Port (to the metaverse)
`docs/PORT.md` describes the avatar package, the Supabase table and Edge Function (`integrations/supabase/`), the TypeScript client (`src/port`, published at `/port/vitruvian-port.js`) and the Unreal plugin functions. Database = Supabase; website = Vercel; payments = Stripe (later).

## On the developer's PC (Meta VR Developer Hub MCP + Horizon skills)
The cloud sessions that built this repo could not reach the headset. Locally, with the MQDH MCP server added to Claude Code:
1. **Verify first**: run `/hz-quest-verify-first` before Quest-specific claims (build path = **WebXR**).
2. **Test on device by URL**: `https://djoek47.github.io/Vitruvian/` (GitHub Pages) or `npm run dev`, then open `https://<PC-IP>:5173` in Quest Browser.
3. **APK (Acceptance Test 02)**: `/hz-store-pwa` packages the hosted app with `@meta-quest/bubblewrap-cli` (immersive WebXR mode). Install with MQDH Device Manager or `adb install -r`. Record the build log, `adb devices -l` and a launch screenshot in the acceptance report.
4. **Debug**: `/hz-vr-debug` for logcat (Quest Browser console) and screenshots; `/hz-perfetto-debug` if frames drop.
5. **Comfort review**: `/hz-immersive-designer` on the capture flow.
6. Follow `docs/HEADSET_TEST_CHECKLIST.md` and `docs/VALIDATION.md`, and fill the acceptance reports with real results only.
