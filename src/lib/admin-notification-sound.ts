/**
 * In-app notification chime (Web Audio — no asset / deps).
 * Best-effort: browsers may block until a user gesture unlocked AudioContext.
 * OS Web Push uses the system default sound (`silent: false` in the SW);
 * custom sounds are not reliably supported there.
 */

let audioCtx: AudioContext | null = null;
/** Nodes for the chime currently ringing — lets a dismiss cut it instantly. */
let activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

/** Peak gain per note (was 0.07 — barely audible at max Mac volume). */
const PEAK_GAIN = 0.65;
/** Fade when force-stopped mid-note — short enough to not be its own click/pop. */
const STOP_FADE_S = 0.02;

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

/**
 * Two-note chime (G5 then B5, 110ms apart) — audible but not harsh.
 *
 * No time-based cooldown here on purpose: a blanket "mute anything within
 * N ms of the last play" mutex can't tell a real double-fire of the *same*
 * event apart from two legitimately different notifications that happen to
 * land close together — it would silence the second one. Same-event dedupe
 * (same toast id / same push payload) is the caller's job — see
 * `playedSoundIdsRef` + `claimChimeOnce` in admin-push-sw-register.tsx and
 * the push fingerprint dedupe in `pushToast`. Every *distinct* id that gets
 * past those must always chime, no matter how soon after the previous one.
 */
export function playAdminNotificationSound(): void {
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

    // Previous chime's nodes stop themselves on schedule (onended below);
    // drop stale refs so stopAdminNotificationSound() only ever targets
    // *this* chime.
    activeNodes = [];

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
      const entry = { osc, gain };
      activeNodes.push(entry);
      osc.onended = () => {
        activeNodes = activeNodes.filter((n) => n !== entry);
      };
    }
  } catch {
    // ignore autoplay / unsupported
  }
}

/**
 * Silence any chime that might still be ringing (max ~0.53s tail). Call this
 * from every dismiss path (X click, body click, TTL auto-dismiss) — the
 * chime only ever starts on toast *appear*, but a quick dismiss right after
 * a toast shows up can otherwise catch the tail end of it, which sounds like
 * the dismiss itself made noise. This makes closing a toast silent by
 * construction instead of relying on chime-vs-TTL timing.
 */
export function stopAdminNotificationSound(): void {
  if (activeNodes.length === 0) return;
  const nodes = activeNodes;
  activeNodes = [];
  const ctx = audioCtx;
  const now = ctx?.currentTime ?? 0;
  for (const { osc, gain } of nodes) {
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + STOP_FADE_S);
      osc.stop(now + STOP_FADE_S);
    } catch {
      // already stopped / unsupported — ignore
    }
  }
}

const CHIME_CLAIMED_KEY = "rocha-admin-chime-claimed";
/** Long enough to outlive any poll interval (8s) or Probar race; short enough not to leak. */
const CHIME_CLAIM_TTL_MS = 5 * 60 * 1000;

function readClaimedMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CHIME_CLAIMED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function writeClaimedMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(CHIME_CLAIMED_KEY, JSON.stringify(map));
  } catch {
    // storage blocked/full — dedupe degrades to per-tab only, not fatal.
  }
}

/**
 * Cross-tab chime dedupe. Every open `/admin` tab runs its own
 * AdminPushSwRegister instance with its own React refs and its own
 * sessionStorage — a toast id that is safely deduped *within* one tab
 * (ref/Set check) is still independently discovered by every *other* open
 * tab (its own 8s inbox poll, or the same push message), which then plays
 * its own chime for the same id a few seconds later. That is two real,
 * separate `playAdminNotificationSound()` calls in two separate JS
 * contexts — no in-tab mutex or React-level id check can ever see across
 * that boundary. `localStorage` is the one thing actually shared across
 * same-origin tabs, so use it as the source of truth: only the tab that
 * wins the claim for a given id is allowed to play.
 *
 * Returns true if the caller "won" the claim (should play the chime).
 */
export function claimChimeOnce(id: string): boolean {
  if (typeof window === "undefined" || !id) return true;
  try {
    const now = Date.now();
    const map = readClaimedMap();
    for (const [key, at] of Object.entries(map)) {
      if (now - at > CHIME_CLAIM_TTL_MS) delete map[key];
    }
    if (map[id] !== undefined) {
      writeClaimedMap(map);
      return false;
    }
    map[id] = now;
    writeClaimedMap(map);
    return true;
  } catch {
    return true;
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
