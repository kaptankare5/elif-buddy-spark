// Mini Akıl - Statik MP3 ses çalar (+ tarayıcı TTS fallback)
// Sesler build-time ElevenLabs ile üretildi → public/audio/{tr,en}/<sha1>.mp3
import manifest from "../../public/audio/manifest.json";
import type { ContentItem, Lang } from "@/data/types";

let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let currentResolve: (() => void) | null = null;
let currentCleanup: (() => void) | null = null;
let currentTimer: ReturnType<typeof setTimeout> | null = null;
let playToken = 0;
let unlockInstalled = false;

function cleanupActiveAudio(audio?: HTMLAudioElement | null) {
  const target = audio ?? activeAudio;
  if (!target) return;
  try {
    target.pause();
    target.removeAttribute("src");
    target.load();
  } catch { /* ignore */ }
  if (!audio || target === activeAudio) activeAudio = null;
}

function finishCurrent() {
  if (currentTimer) {
    clearTimeout(currentTimer);
    currentTimer = null;
  }
  const cleanup = currentCleanup;
  currentCleanup = null;
  if (cleanup) {
    try { cleanup(); } catch { /* ignore */ }
  }
  const resolve = currentResolve;
  currentResolve = null;
  if (resolve) {
    try { resolve(); } catch { /* ignore */ }
  }
}

function stopCurrent(invalidate = true) {
  if (invalidate) playToken += 1;
  try {
    cleanupActiveAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch { /* ignore */ }
  activeUtterance = null;
  finishCurrent();
}

function setPlaybackTimeout(token: number, ms = 10000) {
  if (currentTimer) clearTimeout(currentTimer);
  currentTimer = setTimeout(() => {
    if (token === playToken) stopCurrent(false);
  }, ms);
}

// Case-insensitive lookup cache
const lowerCache: Partial<Record<Lang, Record<string, string>>> = {};
function getLowerMap(lang: Lang): Record<string, string> {
  if (!lowerCache[lang]) {
    const m = (manifest as Record<string, Record<string, string>>)[lang] || {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(m)) out[k.toLowerCase()] = v;
    lowerCache[lang] = out;
  }
  return lowerCache[lang]!;
}

function lookupKey(text: string, lang?: Lang): { lang: Lang; key: string } | null {
  const m = manifest as Record<string, Record<string, string>>;
  const langs: Lang[] = lang ? [lang] : (["tr", "en"] as Lang[]);
  for (const l of langs) {
    if (m[l]?.[text]) return { lang: l, key: m[l][text] };
    const lower = getLowerMap(l)[text.toLowerCase()];
    if (lower) return { lang: l, key: lower };
  }
  return null;
}

function speakWithSynthesis(text: string, lang: Lang | undefined, token: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "en" ? "en-US" : "tr-TR";
      utterance.rate = 0.95;

      const settle = () => {
        if (token !== playToken) {
          resolve();
          return;
        }
        activeUtterance = null;
        stopCurrent(false);
      };

      activeUtterance = utterance;
      currentResolve = resolve;
      currentCleanup = () => {
        activeUtterance = null;
      };

      utterance.onend = settle;
      utterance.onerror = settle;
      setPlaybackTimeout(token, 12000);
      window.speechSynthesis.speak(utterance);
    } catch {
      stopCurrent(false);
      resolve();
    }
  });
}

// Resolve only when the played audio actually ends (or fails).
export function playSpeech(text: string, lang?: Lang, opts?: { gain?: number }): Promise<void> {
  stopCurrent(true);
  const token = playToken;
  const found = lookupKey(text, lang);

  if (!found) {
    return speakWithSynthesis(text, lang, token);
  }

  const url = `/audio/${found.lang}/${found.key}.mp3`;
  const gain = opts?.gain && opts.gain > 1 ? opts.gain : 1;
  return new Promise<void>((resolve) => {
    try {
      const audio = new Audio(url);
      audio.preload = "auto";
      // Aynı origin: crossOrigin ayarlamıyoruz; MediaElementSource yine de çalışır.
      audio.setAttribute("playsinline", "true");
      activeAudio = audio;

      // WebAudio gain boost (volume > 1 için)
      let ctxNodes: { src: MediaElementAudioSourceNode; g: GainNode } | null = null;
      if (gain > 1) {
        const ctx = getCtx();
        if (ctx) {
          try {
            const src = ctx.createMediaElementSource(audio);
            const g = ctx.createGain();
            g.gain.value = gain;
            src.connect(g).connect(ctx.destination);
            ctxNodes = { src, g };
          } catch { /* fallback to normal volume */ }
        }
      }

      currentResolve = resolve;
      currentCleanup = () => {
        cleanupActiveAudio(audio);
        if (ctxNodes) { try { ctxNodes.src.disconnect(); ctxNodes.g.disconnect(); } catch { /* ignore */ } }
      };

      const settle = () => {
        if (token !== playToken) { resolve(); return; }
        stopCurrent(false);
      };

      audio.addEventListener("ended", settle, { once: true });
      audio.addEventListener("error", () => {
        if (token !== playToken) { resolve(); return; }
        void speakWithSynthesis(text, lang, token);
      }, { once: true });

      setPlaybackTimeout(token);
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((e: { name?: string }) => {
          if (token !== playToken) return;
          if (e?.name !== "AbortError") console.warn("audio play failed", text, e);
          void speakWithSynthesis(text, lang, token);
        });
      }
    } catch {
      void speakWithSynthesis(text, lang, token);
    }
  });
}

export function playItem(item: ContentItem): Promise<void> {
  return playSpeech(item.speech, item.lang, { gain: item.audioGain });
}

// İlk kullanıcı etkileşiminde ses katmanını aç.
export function installAudioUnlock() {
  if (typeof window === "undefined" || unlockInstalled) return;
  unlockInstalled = true;

  const unlock = () => {
    primeAudio();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("touchstart", unlock, true);
  };

  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
}

export function primeAudio() {
  try {
    const ctx = getCtx();
    if (ctx && ctx.state !== "running") ctx.resume().catch(() => {});

    const audio = new Audio();
    audio.preload = "none";
    audio.muted = true;
    audio.setAttribute("playsinline", "true");
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    queueMicrotask(() => {
      try {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch { /* ignore */ }
    });
  } catch { /* ignore */ }
}

// Kısa "ding" (doğru) / "buzz" (yanlış) sesi — WebAudio ile sentezlenir.
let _audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!_audioCtx || _audioCtx.state === "closed") _audioCtx = new Ctor();
    if (_audioCtx.state !== "running") _audioCtx.resume().catch(() => {});
    return _audioCtx;
  } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType, startOffset = 0, gain = 0.18) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export async function playFeedback(positive: boolean) {
  if (positive) {
    tone(880, 0.12, "triangle", 0, 0.2);
    tone(1318, 0.16, "triangle", 0.09, 0.2);
  } else {
    tone(220, 0.18, "square", 0, 0.14);
    tone(160, 0.22, "square", 0.08, 0.12);
  }
}
