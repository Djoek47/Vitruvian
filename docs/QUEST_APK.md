# Installing on the Quest

## Option 1: URL (fastest, works today)
Open the hosted HTTPS URL in **Meta Quest Browser**. WebXR needs HTTPS; GitHub Pages provides it. Browser ▸ ⋯ ▸ *Install* adds it to the app library as a PWA.

## Option 2: Same Wi-Fi dev server (live reload)
```bash
npm run dev
```
Open `https://<PC-LAN-IP>:5173` on the Quest and accept the self-signed certificate once.

## Option 3: Android APK (Acceptance Test 02), on your PC
Meta's supported path for WebXR apps is a TWA/PWA wrapper built with **`@meta-quest/bubblewrap-cli`**. Your local Claude has the `/hz-store-pwa` skill for exactly this; run it in this repo. Summary of the flow (verify every flag with `/hz-quest-verify-first` and current Meta docs):
1. Host the app at a stable HTTPS URL (GitHub Pages).
2. Install the CLI: JDK 17 and the Android SDK are required, and bubblewrap can download them.
   ```bash
   npm i -g @meta-quest/bubblewrap-cli
   ```
3. Initialise the wrapper from the web manifest:
   ```bash
   bubblewrap init --manifest https://<host>/manifest.webmanifest
   ```
   Choose the **immersive (WebXR)** mode when asked, and follow the skill's "auto-enter session" step.
4. Build the APK:
   ```bash
   bubblewrap build
   ```
   This produces `app-release-signed.apk`. Keep the keystore, and publish `.well-known/assetlinks.json` on the host for Digital Asset Links.
5. Install over USB, with developer mode enabled. Use MQDH ▸ Device manager ▸ drag the APK, or:
   ```bash
   adb install -r app-release-signed.apk
   ```
6. Evidence for the report: build log, `adb devices -l` (headset model), install output, a launch screenshot.

> Not done from the cloud session: it has no USB connection to your headset and no Android SDK. Everything the APK needs (HTTPS host, manifest, 512/192 icons, standalone display) is already in the repo.
