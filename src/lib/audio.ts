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

// GECİKME ÇÖZÜMÜ: ses elemanları URL bazında ÖNBELLEKLENİR ve yeniden
// kullanılır. Böylece aynı sesin ikinci ve sonraki çalışları ANINDA olur
// (fetch/decode yok). Durdururken eleman YOK EDİLMEZ (src silinmez), sadece
// duraklatılıp başa sarılır — yüklü kalır. preload="auto" ilk fetch'i erken
// başlatır; `preloadItems` görünen öğeleri önceden ısıtır (ilk tık da anında).
interface CachedAudio { audio: HTMLAudioElement; node?: { src: MediaElementAudioSourceNode; g: GainNode } }
const audioCache = new Map<string, CachedAudio>();

function getCachedAudio(url: string, gain: number): CachedAudio {
  let c = audioCache.get(url);
  if (!c) {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    c = { audio };
    if (gain > 1) {
      const ctx = getCtx();
      if (ctx) {
        try {
          const src = ctx.createMediaElementSource(audio);
          const g = ctx.createGain();
          g.gain.value = gain;
          src.connect(g).connect(ctx.destination);
          c.node = { src, g };
        } catch { /* doğrudan çalar */ }
      }
    }
    audioCache.set(url, c);
    if (audioCache.size > 150) {
      const k = audioCache.keys().next().value;
      if (k && k !== url) { try { audioCache.get(k)?.audio.pause(); } catch { /* ignore */ } audioCache.delete(k); }
    }
  } else if (c.node && gain > 1) {
    c.node.g.gain.value = gain;
  }
  return c;
}

// Görünen öğelerin sesini önceden yükle (ilk tık gecikmesini de bitirir).
export function preloadItems(items: { audio?: string }[]) {
  for (const it of items) if (it.audio) { try { getCachedAudio(it.audio, 1); } catch { /* ignore */ } }
}

function cleanupActiveAudio(audio?: HTMLAudioElement | null) {
  const target = audio ?? activeAudio;
  if (!target) return;
  // Önbellekli eleman: yok etme, sadece duraklat + başa sar (yüklü kalsın).
  try { target.pause(); target.currentTime = 0; } catch { /* ignore */ }
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
// Manifest'te ses varsa önbellekli playUrl ile çalar (anında tekrar);
// yoksa tarayıcı TTS'ine düşer.
export function playSpeech(text: string, lang?: Lang, opts?: { gain?: number }): Promise<void> {
  const found = lookupKey(text, lang);
  if (!found) {
    stopCurrent(true);
    return speakWithSynthesis(text, lang, playToken);
  }
  const url = `/audio/${found.lang}/${found.key}.mp3`;
  return playUrl(url, { fallbackText: text, fallbackLang: lang, gain: opts?.gain });
}

export function playItem(item: ContentItem): Promise<void> {
  // Item'a özel bir ses dosyası varsa (Elifbâ mp3'leri) doğrudan onu çal.
  if (item.audio) {
    return playUrl(item.audio, { fallbackText: item.speech, fallbackLang: item.lang, gain: item.audioGain });
  }
  return playSpeech(item.speech, item.lang, { gain: item.audioGain });
}

function playUrl(url: string, opts: { fallbackText?: string; fallbackLang?: Lang; gain?: number }): Promise<void> {
  stopCurrent(true);
  const token = playToken;
  const gain = opts.gain && opts.gain > 1 ? opts.gain : 1;
  return new Promise<void>((resolve) => {
    try {
      const c = getCachedAudio(url, gain);
      const audio = c.audio;
      activeAudio = audio;
      try { audio.currentTime = 0; } catch { /* ignore */ }
      currentResolve = resolve;
      currentCleanup = () => cleanupActiveAudio(audio); // önbellekli: yalnız duraklat
      const settle = () => {
        if (token !== playToken) { resolve(); return; }
        stopCurrent(false);
      };
      audio.onended = settle;
      audio.onerror = () => {
        if (token !== playToken) { resolve(); return; }
        audioCache.delete(url); // bozuk kaydı at
        if (opts.fallbackText) void speakWithSynthesis(opts.fallbackText, opts.fallbackLang, token);
        else settle();
      };
      setPlaybackTimeout(token);
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          if (token !== playToken) return;
          if (opts.fallbackText) void speakWithSynthesis(opts.fallbackText, opts.fallbackLang, token);
          else stopCurrent(false);
        });
      }
    } catch {
      if (opts.fallbackText) void speakWithSynthesis(opts.fallbackText, opts.fallbackLang, token);
      else resolve();
    }
  });
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

// Doğru-cevap melodileri — monotonluğu kırmak için varyasyon (1000. dinleyişte
// de taze kalsın). Hepsi kısa/majör/parlak; rastgele seçilir. Nadiren (%8)
// "özel" arpej çalar — değişken sürpriz, ama HER doğru cevap yine ödüllenir.
// Yanlış sesi SABİT kalır: olumsuz sinyalin tutarlılığı öğretici (karışmaz).
const SUCCESS_MELODIES: Array<Array<[number, number, number, number]>> = [
  // [freq, dur, startOffset, gain]
  [[880, 0.12, 0, 0.2], [1318, 0.16, 0.09, 0.2]],                       // klasik ding
  [[784, 0.1, 0, 0.18], [988, 0.1, 0.08, 0.18], [1318, 0.16, 0.16, 0.2]], // yükselen üçlü
  [[1046, 0.09, 0, 0.18], [1568, 0.18, 0.08, 0.2]],                     // parlak beşli
  [[659, 0.09, 0, 0.16], [880, 0.09, 0.07, 0.18], [1108, 0.14, 0.14, 0.2]], // majör arpej
  [[988, 0.08, 0, 0.16], [784, 0.08, 0.07, 0.16], [1175, 0.16, 0.14, 0.2]],  // zıplayan
];
const SUCCESS_SPECIAL: Array<[number, number, number, number]> = [
  [659, 0.09, 0, 0.18], [830, 0.09, 0.08, 0.18], [988, 0.09, 0.16, 0.19],
  [1318, 0.22, 0.24, 0.22], [1975, 0.3, 0.34, 0.14],
];

export async function playFeedback(positive: boolean) {
  if (positive) {
    const notes = Math.random() < 0.08
      ? SUCCESS_SPECIAL
      : SUCCESS_MELODIES[Math.floor(Math.random() * SUCCESS_MELODIES.length)];
    for (const [f, d, o, g] of notes) tone(f, d, "triangle", o, g);
  } else {
    tone(220, 0.18, "square", 0, 0.14);
    tone(160, 0.22, "square", 0.08, 0.12);
  }
}

// Kısa oyun sfx — müzik yerine tek atımlık tonlar (İslami hassasiyet: müzik
// yok, sadece bildirim/geri bildirim sesleri). Coin: parlak iki nota;
// stomp: yumuşak "puf"; hurt: alçak buzz.
export function playSfx(kind: "coin" | "stomp" | "hurt" | "dove") {
  if (kind === "coin") {
    tone(1320, 0.06, "triangle", 0, 0.16);
    tone(1760, 0.10, "triangle", 0.05, 0.16);
  } else if (kind === "stomp") {
    tone(180, 0.09, "square", 0, 0.14);
    tone(110, 0.12, "sine", 0.05, 0.12);
  } else if (kind === "dove") {
    tone(1174, 0.09, "triangle", 0, 0.16);
    tone(1568, 0.10, "triangle", 0.07, 0.16);
    tone(2093, 0.14, "triangle", 0.15, 0.14);
  } else {
    tone(200, 0.14, "square", 0, 0.14);
  }
}

