/**
 * In-app notification chime (Web Audio — no asset / deps).
 * Best-effort: browsers may block until a user gesture unlocked AudioContext.
 * OS Web Push uses the system default sound (`silent: false` in the SW);
 * custom sounds are not reliably supported there.
 */

let audioCtx: AudioContext | null = null;
let lastPlayAt = 0;

const SOUND_DEDUPE_MS = 700;
/** Peak gain per note (was 0.07 — barely audible at max Mac volume). */
const PEAK_GAIN = 0.65;

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

/** Two-note chime — audible but not harsh. */
export function playAdminNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayAt < SOUND_DEDUPE_MS) return;

  try {
    const ctx = getCtx();
    if (!ctx) return;

    // Autoplay policy: an AudioContext created without a prior user gesture
    // starts "suspended". Chaining `.then(start)` on resume() used to DEFER
    // playback to whenever the *next* gesture landed — which is very often
    // the click that dismisses this same toast (X button / body / TTL timer
    // racing a later click), making the chime sound like it fires on
    // dismiss. Never queue playback like that: only play if the context is
    // already unlocked "now"; otherwise best-effort resume so a *future*
    // notification can play, and silently drop this one.
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
      return;
    }

    lastPlayAt = now;
    const t0 = ctx.currentTime;
    const notes = [
      { freq: 784, at: 0 }, // G5
      { freq: 988, at: 0.11 }, // B5
    ];
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = note.freq;
      // Fast attack, hold briefly, smooth release (~0.35s each).
      gain.gain.setValueAtTime(0.0001, t0 + note.at);
      gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + note.at + 0.015);
      gain.gain.exponentialRampToValueAtTime(
        PEAK_GAIN * 0.55,
        t0 + note.at + 0.12,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.at + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + note.at);
      osc.stop(t0 + note.at + 0.42);
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
