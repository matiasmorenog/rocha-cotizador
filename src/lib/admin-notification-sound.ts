/**
 * Subtle in-app notification chime (Web Audio — no asset / deps).
 * Best-effort: browsers may block until a user gesture unlocked AudioContext.
 * OS Web Push uses the system default sound (`silent: false` in the SW);
 * custom sounds are not reliably supported there.
 */

let audioCtx: AudioContext | null = null;
let lastPlayAt = 0;

const SOUND_DEDUPE_MS = 700;

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

/** Soft two-note chime — bordo-friendly, short, low volume. */
export function playAdminNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayAt < SOUND_DEDUPE_MS) return;
  lastPlayAt = now;

  try {
    const ctx = getCtx();
    if (!ctx) return;

    const start = () => {
      const t0 = ctx.currentTime;
      const notes = [
        { freq: 784, at: 0 }, // G5
        { freq: 988, at: 0.09 }, // B5
      ];
      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(0.0001, t0 + note.at);
        gain.gain.exponentialRampToValueAtTime(0.07, t0 + note.at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + note.at);
        osc.stop(t0 + note.at + 0.25);
      }
    };

    if (ctx.state === "suspended") {
      void ctx.resume().then(start).catch(() => undefined);
    } else {
      start();
    }
  } catch {
    // ignore autoplay / unsupported
  }
}

/** Unlock AudioContext on first admin interaction (best-effort). */
export function unlockAdminNotificationSound(): void {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  } catch {
    // ignore
  }
}
