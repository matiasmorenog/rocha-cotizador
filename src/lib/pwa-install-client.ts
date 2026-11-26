/** Client-only helpers for PWA install tip + settings guide. */

export const PWA_INSTALL_TIP_DISMISSED_KEY = "rocha-pwa-install-tip-dismissed";
export const PWA_INSTALL_TIP_EVENT = "rocha-pwa-install-tip";
export const PWA_INSTALL_PROMPT_EVENT = "rocha-pwa-install-prompt";

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEventLike | null = null;
let captureBound = false;

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const media = window.matchMedia("(display-mode: standalone)").matches;
  const iosNative =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return media || Boolean(iosNative);
}

/** Tip only on phone/tablet viewports (or mobile UA). */
export function isPwaInstallTipViewport(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(max-width: 768px)").matches) return true;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS desktop UA
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function readInstallTipDismissed(): boolean {
  try {
    return localStorage.getItem(PWA_INSTALL_TIP_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallTip(): void {
  try {
    localStorage.setItem(PWA_INSTALL_TIP_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PWA_INSTALL_TIP_EVENT));
  }
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEventLike | null {
  return deferredPrompt;
}

/** Capture Chrome/Edge install prompt once for tip + settings CTAs. */
export function ensureInstallPromptCapture(): void {
  if (typeof window === "undefined" || captureBound) return;
  captureBound = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEventLike;
    window.dispatchEvent(new Event(PWA_INSTALL_PROMPT_EVENT));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    dismissInstallTip();
    window.dispatchEvent(new Event(PWA_INSTALL_PROMPT_EVENT));
  });
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = deferredPrompt;
  if (!promptEvent) return "unavailable";
  deferredPrompt = null;
  window.dispatchEvent(new Event(PWA_INSTALL_PROMPT_EVENT));
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      dismissInstallTip();
    }
    return choice.outcome;
  } catch {
    return "dismissed";
  }
}
