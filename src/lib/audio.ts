// Mini Akıl - Statik MP3 ses çalar (+ tarayıcı TTS fallback)
// Sesler build-time ElevenLabs ile üretildi → public/audio/{tr,en}/<sha1>.mp3
import manifest from "../../public/audio/manifest.json";
import type { ContentItem, Lang } from "@/data/types";
import { titre, type Titresim } from "@/lib/titresim";
import { getSettings } from "@/lib/settings";

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

/**
 * `onFail`: GERÇEK kayıt çalınamadığında (play() reddedildi, dosya hatası →
 * robotik TTS'e düşüldü) haber verir. Oyunlarda soru SESLE sorulduğu için
 * çağıran taraf "soruyu sordum" saymadan önce bunu bilmek zorunda: aksi
 * hâlde çocuk kapıyı sessizce görür ve soru bir daha hiç sorulmaz.
 */
export function playItem(item: ContentItem, opts?: { onFail?: () => void }): Promise<void> {
  // Item'a özel bir ses dosyası varsa (Elifbâ mp3'leri) doğrudan onu çal.
  if (item.audio) {
    return playUrl(item.audio, {
      fallbackText: item.speech, fallbackLang: item.lang, gain: item.audioGain,
      onFail: opts?.onFail,
    });
  }
  return playSpeech(item.speech, item.lang, { gain: item.audioGain });
}

function playUrl(
  url: string,
  opts: { fallbackText?: string; fallbackLang?: Lang; gain?: number; onFail?: () => void },
): Promise<void> {
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
        try { opts.onFail?.(); } catch { /* ignore */ }
        if (opts.fallbackText) void speakWithSynthesis(opts.fallbackText, opts.fallbackLang, token);
        else settle();
      };
      setPlaybackTimeout(token);
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // token değiştiyse başka bir ses araya girmiştir — bu bir HATA
          // değil, kasıtlı kesintidir; çağıranı yanıltmamak için haber verme.
          if (token !== playToken) return;
          try { opts.onFail?.(); } catch { /* ignore */ }
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
/**
 * ⚠️ AYARLARDAKİ "SES EFEKTLERİ" ANAHTARI HİÇBİR ŞEYİ KAPATMIYORDU.
 * `getSettings().sound` yalnız Ayarlar sayfasının kendi `checked` değerinde
 * okunuyordu; `tone`/`gurultu`/`sfx`/`playFeedback` ona hiç bakmıyordu, yani
 * anahtar süsten ibaretti (grep: `.sound` tek yerde geçiyordu). Sürekli çalan
 * bir motor sesi eklemeden ÖNCE bu kapı gerçekten çalışmalı — kapatılamayan
 * bir arka plan sesi kabul edilemez.
 *
 * ⚠️ KAPI YALNIZ EFEKTLERE: `playItem` / `playSpeech` (gerçek hoca kayıtları)
 * ASLA kısılmaz. Oyunların sorusu SESLE soruluyor; onları susturmak oyunu
 * oynanamaz yapar. Anahtarın metni de bunu diyor: "Doğru/yanlış kısa sesler".
 */
function sfxAcik(): boolean {
  try { return getSettings().sound; } catch { return true; }
}

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

// ⚠️ juice.ts de kullanıyor — ses üretimi TEK YERDE kalsın, ikinci bir
// AudioContext açmak mobil tarayıcıda ses kilidini bozuyor.
export function tone(freq: number, dur: number, type: OscillatorType, startOffset = 0, gain = 0.18) {
  if (!sfxAcik()) return;
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

/**
 * SÜZÜLMÜŞ GÜRÜLTÜ PATLAMASI — `tone` yalnız osilatör üretiyor, oysa doğadaki
 * seslerin çoğu (çamur, toz, su, rüzgâr) PERİYODİK DEĞİL: gürültüdür.
 * Çamura basma sesi de bir "vızıltı" değil, kesme frekansı hızla süpürülen
 * geniş bantlı gürültüdür — emme/bırakma hareketi filtrenin süpürmesinde.
 *
 * ⚠️ HAZIR SES DOSYASI KULLANILMADI: (1) bu sandbox'tan freesound/pixabay/
 * opengameart'ın hiçbirine erişilemiyor, (2) uygulamanın BÜTÜN oyun sesleri
 * WebAudio ile üretiliyor — tek bir mp3 hem paket boyutu hem lisans/atıf
 * yükü getirirdi. Çamur sesi zaten sentezle çok iyi çıkıyor.
 *
 * ⚠️ Gürültü tamponu BİR KEZ üretilip önbelleğe alınır: her adımda 0.4 sn'lik
 * rastgele dizi doldurmak telefonda kareyi düşürür.
 */
let _gurultuBuf: AudioBuffer | null = null;
function gurultuTamponu(ctx: AudioContext): AudioBuffer {
  if (_gurultuBuf && _gurultuBuf.sampleRate === ctx.sampleRate) return _gurultuBuf;
  // ⚠️ 2 SANİYE (eskiden 0.5): tampon artık DÖNGÜYLE de çalıyor (rüzgâr,
  // lastik cıyaklaması, çim uğultusu). 0.5 sn'lik gürültü saniyede iki kez
  // tekrarlanınca kulak bunu ritmik bir doku olarak yakalıyor — "gürültü"
  // değil "makine" gibi duyuluyor. Tek atımlık kullanımlar zaten
  // tamponun başından okuyor, onlar etkilenmiyor.
  const n = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  _gurultuBuf = buf;
  return buf;
}

export function gurultu(o: {
  /** Süre (sn). */
  dur: number;
  /** Filtre kesme frekansı: başlangıç → tepe → bitiş (Hz). */
  bas: number; tepe: number; son: number;
  gain?: number;
  /** Rezonans — yüksek Q "ıslak/boğuk" bir renk verir. */
  q?: number;
  startOffset?: number;
}) {
  if (!sfxAcik()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.startOffset ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = gurultuTamponu(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = o.q ?? 6;
  f.frequency.setValueAtTime(o.bas, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, o.tepe), t0 + o.dur * 0.35);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, o.son), t0 + o.dur);
  const g = ctx.createGain();
  const gain = o.gain ?? 0.14;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

/**
 * MOTOR SESİ — perdesi KAYAN testere dalgası + rezonanslı süzgeç.
 *
 * ⚠️ `tone` yetmez: sabit perdeli bir osilatör "düdük" verir, motor ise
 * perdesi SÜREKLİ değişen ve harmonik açısından zengin bir sestir. Testere
 * dalgası bütün harmonikleri taşır, perdeyi takip eden alçak geçiren süzgeç
 * de onu "boru içinden" duyuluyormuş gibi yuvarlar.
 *
 * ⚠️ İKİ OSİLATÖR, HAFİF DETONE: tek osilatör elektronik/steril çıkıyor.
 * Aralarındaki birkaç Hz'lik fark vuru (beating) üretiyor — kart motorunun
 * o "hırıltılı" dokusu buradan geliyor.
 *
 * ⚠️ HAZIR MP3 YOK: uygulamanın bütün oyun sesleri WebAudio ile üretiliyor
 * (`gurultu`daki gerekçenin aynısı — paket boyutu + lisans yükü, üstelik bu
 * ortamdan ses bankalarının hiçbirine erişilemiyor).
 */
export function motor(o: {
  /** Süre (sn). */
  dur: number;
  /** Perde: başlangıç → bitiş (Hz). Yükselirse gaz, düşerse gaz kesme. */
  bas: number; son: number;
  gain?: number;
  /** Süzgeç rezonansı — yüksek Q daha "borulu/hırıltılı". */
  q?: number;
  startOffset?: number;
}) {
  if (!sfxAcik()) return;
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.startOffset ?? 0);
  const gain = o.gain ?? 0.09;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = o.q ?? 4;
  // Süzgeç perdeyi TAKİP eder (sabit kesme frekansı gaz açılırken sesi
  // boğuyor): temel frekansın ~5 katı, harmonikler geçsin ama tizlenmesin.
  f.frequency.setValueAtTime(Math.max(80, o.bas * 5), t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, o.son * 5), t0 + o.dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.05, o.dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  f.connect(g).connect(ctx.destination);
  for (const detune of [0, 7]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(o.bas, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.son), t0 + o.dur);
    osc.connect(f);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
  }
}

/**
 * SÜREKLİ SES KATMANI — tek atımlık sfx'in tam tersi.
 *
 * ⚠️ UYGULAMADA HİÇ YOKTU: 15 oyunun sesi de "olay oldu → çıt" biçimindeydi.
 * Oysa yarış/koşu türlerinin ses kimliği SÜREKLİ katmandadır: motor, rüzgâr,
 * lastik. Ölçüldü — bizde bu kategoriden tek bir ses bile yoktu.
 *
 * ⚠️ BU MÜZİK DEĞİLDİR ve müzik yerine de geçmez: melodi, ölçü, akort yok.
 * Aracın/hızın KENDİ sesi, yani oyunun fiziksel geri bildirimi. Uygulamanın
 * "müzik yok" kuralı melodik/ritmik arka plan içindir.
 *
 * ⚠️ PARAMETRE `setTargetAtTime` İLE SÜRÜLÜR: `setValueAtTime` her karede
 * çağrılınca perde basamak basamak zıplıyor ve "fermuar" (zipper) gürültüsü
 * çıkıyor. Üstel yaklaşma hem yumuşak hem ucuz.
 */
export type SurekliSes = {
  /** 0..1 yoğunluk (hız, kayma şiddeti…). */
  ayarla(v: number): void;
  /** Tamamen bırak — düğümler kapanır. */
  dur(): void;
};

const SESSIZ: SurekliSes = { ayarla() {}, dur() {} };
const bir = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * MOTOR DÖNGÜSÜ — yarış boyunca çalan, perdesi hızdan beslenen motor.
 * `motor()` tek atımlıktır (kalkış blibi); bu ise kapatılana kadar çalar.
 *
 * ⚠️ ARKA PLANDA KALMALI: kazanç tavanı bilerek çok düşük (0.045). Bu ses
 * soruların ve harf kayıtlarının ÜSTÜNE binerse oyunun asıl işini bozar.
 * Rölantide daha da kısıktır — hız arttıkça hem tizleşir hem yükselir,
 * yani çocuk gaza bastığını KULAKLA da duyar.
 */
export function motorDongusu(o?: {
  bas?: number; tepe?: number; gain?: number; q?: number;
}): SurekliSes {
  if (!sfxAcik()) return SESSIZ;
  const ctx = getCtx();
  if (!ctx) return SESSIZ;
  const bas = o?.bas ?? 68;
  const tepe = o?.tepe ?? 240;
  const tavan = o?.gain ?? 0.045;
  const t0 = ctx.currentTime;

  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = o?.q ?? 4;
  f.frequency.setValueAtTime(bas * 5, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(tavan * 0.5, t0 + 0.25);
  f.connect(g).connect(ctx.destination);

  // İki testere hafif detone (vuru = motorun hırıltısı) + bir oktav altta
  // kısık sine: telefon hoparlöründe gövdeyi o veriyor.
  const oscs: OscillatorNode[] = [];
  for (const [detune, kat, kazanc] of [[0, 1, 1], [9, 1, 1], [0, 0.5, 0.6]] as const) {
    const osc = ctx.createOscillator();
    osc.type = kat === 1 ? "sawtooth" : "sine";
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(bas * kat, t0);
    if (kazanc === 1) osc.connect(f);
    else {
      const sg = ctx.createGain();
      sg.gain.value = kazanc;
      osc.connect(sg).connect(f);
    }
    osc.start(t0);
    oscs.push(osc);
  }

  let bitti = false;
  return {
    ayarla(v) {
      if (bitti) return;
      const k = bir(v);
      const hz = bas + (tepe - bas) * k;
      const now = ctx.currentTime;
      oscs[0].frequency.setTargetAtTime(hz, now, 0.08);
      oscs[1].frequency.setTargetAtTime(hz, now, 0.08);
      oscs[2].frequency.setTargetAtTime(hz * 0.5, now, 0.08);
      f.frequency.setTargetAtTime(hz * 5, now, 0.08);
      g.gain.setTargetAtTime(tavan * (0.5 + 0.5 * k), now, 0.12);
    },
    dur() {
      if (bitti) return;
      bitti = true;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.05);
      for (const osc of oscs) { try { osc.stop(now + 0.4); } catch { /* */ } }
    },
  };
}

/**
 * GÜRÜLTÜ DÖNGÜSÜ — rüzgâr, lastik cıyaklaması, çim uğultusu.
 * Yoğunluk 0 iken TAMAMEN sessizdir, yani "kayarken cıyakla, düz giderken
 * sus" gibi kapılar ayrı bir mantık istemez.
 */
export function gurultuDongusu(o: {
  tip?: BiquadFilterType; bas: number; tepe: number; q?: number; gain: number;
}): SurekliSes {
  if (!sfxAcik()) return SESSIZ;
  const ctx = getCtx();
  if (!ctx) return SESSIZ;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = gurultuTamponu(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.tip ?? "lowpass";
  f.Q.value = o.q ?? 3;
  f.frequency.setValueAtTime(o.bas, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t0);

  let bitti = false;
  return {
    ayarla(v) {
      if (bitti) return;
      const k = bir(v);
      const now = ctx.currentTime;
      f.frequency.setTargetAtTime(o.bas + (o.tepe - o.bas) * k, now, 0.1);
      g.gain.setTargetAtTime(Math.max(0.0001, o.gain * k), now, 0.12);
    },
    dur() {
      if (bitti) return;
      bitti = true;
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.05);
      try { src.stop(now + 0.4); } catch { /* */ }
    },
  };
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
// ⚠️ TİTREŞİM BURADAN GELİR: playSfx zaten 3B oyunların her önemli anında
// (para, çarpma, güç) çağrılıyor. Titreşimi 24 çağrı yerine tek yere koymak
// hem bir yeri atlamayı imkânsız kılıyor hem de ses↔dokunuş eşleşmesini
// tutarlı tutuyor.
const SFX_TITRESIM: Record<string, Titresim> = {
  coin: "hafif", stomp: "sert", hurt: "sert", dove: "orta",
};

export function playSfx(kind: "coin" | "stomp" | "hurt" | "dove") {
  titre(SFX_TITRESIM[kind] ?? "hafif");
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

