import type { BodyPassport } from "../passport/passport";

/**
 * FABERLAND HOST INTEGRATION CONTRACT (v1)
 *
 * Vitruvian runs (a) standalone in the Quest Browser / as an installed PWA, or
 * (b) as an extension launched from the Faberland metaverse app. After a
 * measurement the passport is handed to whichever host launched us. The
 * contract is transport-agnostic so the Unreal app can adopt whichever channel
 * suits it; the payload is always the canonical Body Passport JSON.
 *
 * Launch parameters (query string):
 *   host=faberland            enables host mode
 *   return=<url>              deep link / https callback to return to after save,
 *                             e.g. faberland://vitruvian/passport  (receives ?profileId=&updatedAt=)
 *   profile=<simple|intermediate|ultra> skip the menu and start a mode
 *   origin=<https origin>     parent origin for postMessage when embedded in a webview/iframe
 *
 * Channels, in order:
 *   1. postMessage to window.parent / opener: { type: "faberland.vitruvian.passport", version: 1, passport }
 *   2. Unreal Web Browser widget JS binding: window.ue.faberland.onpassport(json) if present
 *   3. navigate to `return` with ids (the host then reads the exported JSON / sync service)
 * Hosts can request the current passport with { type: "faberland.vitruvian.request" }.
 */
export const CONTRACT_VERSION = 1;

export type HostConfig = { enabled: boolean; returnUrl: string | null; startProfile: "simple" | "intermediate" | "ultra" | null; origin: string };

export function hostConfig(search = location.search): HostConfig {
  const p = new URLSearchParams(search);
  const prof = p.get("profile");
  return {
    enabled: p.get("host") === "faberland",
    returnUrl: p.get("return"),
    startProfile: prof === "simple" || prof === "intermediate" || prof === "ultra" ? prof : prof === "quick" ? "simple" : prof === "precision" ? "intermediate" : null,
    origin: p.get("origin") ?? "*",
  };
}

type UeBridge = { faberland?: { onpassport?: (json: string) => void } };

export function deliverPassport(p: BodyPassport, cfg: HostConfig): string[] {
  const used: string[] = [];
  const msg = { type: "faberland.vitruvian.passport", version: CONTRACT_VERSION, passport: p };
  const targets = [window.parent !== window ? window.parent : null, window.opener as Window | null].filter(Boolean) as Window[];
  for (const t of targets) {
    t.postMessage(msg, cfg.origin);
    used.push("postMessage");
  }
  const ue = (window as unknown as { ue?: UeBridge }).ue;
  if (ue?.faberland?.onpassport) {
    ue.faberland.onpassport(JSON.stringify(p));
    used.push("ue-binding");
  }
  if (cfg.enabled && cfg.returnUrl) {
    const u = cfg.returnUrl + (cfg.returnUrl.includes("?") ? "&" : "?") + `profileId=${encodeURIComponent(p.profileId)}&updatedAt=${encodeURIComponent(p.updatedAt)}&contract=${CONTRACT_VERSION}`;
    used.push("return-url");
    setTimeout(() => (location.href = u), 50);
  }
  return used;
}

export function listenForRequests(get: () => BodyPassport | null, cfg: HostConfig) {
  addEventListener("message", (e) => {
    if (cfg.origin !== "*" && e.origin !== cfg.origin) return;
    if (e.data?.type === "faberland.vitruvian.request") {
      const p = get();
      (e.source as Window | null)?.postMessage({ type: "faberland.vitruvian.passport", version: CONTRACT_VERSION, passport: p }, { targetOrigin: cfg.origin });
    }
  });
}
