/**
 * Subtle water-drop hint for admin theme toggle (Web Audio — no asset).
 * Shares unlock/autoplay behavior with admin-notification-sound.ts.
 */

import { unlockAdminNotificationSound } from "@/lib/admin-notification-sound";

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

/** Min gap between drop sounds — avoids hover spam. */
const COOLDOWN_MS = 2500;
const PEAK_GAIN = 0.11;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Short descending tone — water-drop feel. Best-effort; skipped when
 * prefers-reduced-motion or within cooldown.
 */
export function playAdminThemeDropSound(): void {
  if (prefersReducedMotion()) return;

  const now = Date.now();
  if (now - lastPlayedAt < COOLDOWN_MS) return;
  lastPlayedAt = now;

  try {
    unlockAdminNotificationSound();
    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
      return;
    }

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(920, t0);
    osc.frequency.exponentialRampToValueAtTime(380, t0 + 0.14);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  } catch {
    // autoplay / unsupported
  }
}
