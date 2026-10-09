import { useSyncExternalStore } from "react";

/**
 * Shared sound + voice for Child Mode.
 *
 * - One global "sound on/off" switch (remembered on this device) that silences
 *   both the spoken voice and the little chimes.
 * - Long text is split into short chunks and queued. Browsers (Chrome especially)
 *   silently stop a single long utterance after ~15 seconds, which is why a story
 *   would otherwise cut off after a sentence or two.
 * - Everything is best-effort: if the browser has no speech or audio support the
 *   app keeps working, just silently.
 */

const STORAGE_KEY = "sprout.sound.muted";
const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

/* ------------------------------------------------------------ shared state */
let muted = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
})();
let speaking = false;
let token = 0; // bumped whenever speech is stopped/replaced, so stale callbacks are ignored
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());
const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
function setSpeaking(value) {
  if (speaking !== value) {
    speaking = value;
    emit();
  }
}

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // private mode etc. — the switch still works for this visit
  }
  if (value) stopSpeaking();
  emit();
}

/** React hook: { muted, speaking, setMuted, stop } */
export function useVoice() {
  const isMuted = useSyncExternalStore(subscribe, () => muted);
  const isSpeaking = useSyncExternalStore(subscribe, () => speaking);
  return { muted: isMuted, speaking: isSpeaking, setMuted, stop: stopSpeaking };
}

/* ------------------------------------------------------------------ voices */
let voices = [];
function loadVoices() {
  if (synth) voices = synth.getVoices() || [];
}
if (synth) {
  loadVoices();
  // Chrome fills the voice list asynchronously.
  synth.addEventListener?.("voiceschanged", loadVoices);
}

function pickVoice(lang) {
  const norm = (s) => String(s || "").replace("_", "-").toLowerCase(); // Android uses en_IN
  const base = norm(lang).split("-")[0];
  const pool = voices.filter((v) => norm(v.lang).startsWith(base));
  if (!pool.length) return null;
  const score = (v) =>
    (norm(v.lang) === norm(lang) ? 3 : 0) + (/female|samantha|zira|susan|heera|google/i.test(v.name) ? 2 : 0);
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

/* ------------------------------------------------------------------ speech */
/** Strip emojis, markdown symbols and extra spaces so the voice doesn't read them out. */
export function cleanForSpeech(text) {
  return String(text ?? "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}‍]/gu, " ")
    .replace(/[*_#`~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split into sentence-sized pieces, then group them up to ~`max` characters. */
function toChunks(text, max = 160) {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g) || [text];
  const pieces = [];
  for (const raw of sentences) {
    let s = raw.trim();
    while (s.length > max) {
      let cut = s.lastIndexOf(",", max);
      if (cut < 40) cut = s.lastIndexOf(" ", max);
      if (cut < 1) cut = max;
      pieces.push(s.slice(0, cut + 1).trim());
      s = s.slice(cut + 1).trim();
    }
    if (s) pieces.push(s);
  }
  const chunks = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && last.length + p.length + 1 <= max) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  return chunks;
}

export function stopSpeaking() {
  token += 1;
  try {
    synth?.cancel();
  } catch {
    // ignore
  }
  setSpeaking(false);
}

/**
 * Say `text` out loud, replacing anything already being said.
 * `onEnd` runs once the last piece has finished (not if it was interrupted).
 */
export function speak(text, { onEnd } = {}) {
  if (muted || !synth) return;
  const clean = cleanForSpeech(text);
  if (!clean) return;

  const wasBusy = synth.speaking || synth.pending;
  stopSpeaking();
  const mine = token;
  setSpeaking(true);

  const lang = /[ऀ-ॿ]/.test(clean) ? "hi-IN" : "en-IN"; // Devanagari: Hindi/Marathi
  const chunks = toChunks(clean);

  const start = () => {
    if (mine !== token) return; // replaced while we were waiting
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      const voice = pickVoice(lang);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = lang;
      }
      u.rate = 0.92;
      u.pitch = 1.1;
      u.volume = 1;
      if (i === chunks.length - 1) {
        u.onend = () => {
          if (mine !== token) return;
          setSpeaking(false);
          onEnd?.();
        };
        u.onerror = () => {
          if (mine === token) setSpeaking(false);
        };
      }
      synth.speak(u);
    });
  };
  // Some browsers drop a speak() issued in the same tick as cancel().
  if (wasBusy) setTimeout(start, 60);
  else start();
}

/**
 * Say `text`, then run `next` — used to move to the next game round once the
 * child has heard the answer. Falls back to a timer when sound is off or the
 * browser never reports the end of speech.
 */
export function speakThen(text, next, fallbackMs = 1100) {
  let done = false;
  const go = () => {
    if (!done) {
      done = true;
      next();
    }
  };
  if (muted || !synth) {
    setTimeout(go, fallbackMs);
    return;
  }
  speak(text, { onEnd: () => setTimeout(go, 350) });
  setTimeout(go, 9000); // safety net
}

/* ------------------------------------------------------------------ chimes */
let audioCtx = null;
function getCtx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(freqs, { type = "sine", step = 0.09, len = 0.18, vol = 0.18 } = {}) {
  if (muted) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + len + 0.02);
    });
  } catch {
    // sound is a nice-to-have; never break the screen over it
  }
}

export const playPop = () => tone([660, 880]); //                      a message arrived
export const playTap = () => tone([740], { len: 0.1, vol: 0.12 }); //  a button was pressed
export const playCorrect = () => tone([523, 659, 784], { step: 0.1, len: 0.2 }); // happy rising notes
export const playTryAgain = () => tone([330, 262], { type: "triangle", step: 0.12, len: 0.22, vol: 0.14 }); // soft, gentle
