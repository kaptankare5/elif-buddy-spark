// ARAŞTIRMA DENEYİ — aktarım ölçümü (tanıma vs üretim).
// Tamamen ayrı bir modül: mevcut SRS/ilerleme sistemine HİÇ yazmaz.
// localStorage anahtarı: "deney-aktarim-v1"

export const DENEY_KEY = "deney-aktarim-v1";

export type Arm = "A" | "B" | "C";

export const ARM_LABEL: Record<Arm, string> = {
  A: "A tanıma",
  B: "B üretim",
  C: "C yoğun tanıma",
};

export const ARM_REPS: Record<Arm, number> = { A: 5, B: 5, C: 15 };

// Eğitim İKİ OTURUMA bölünür. HER KOLUN tekrarları iki oturuma da dağılır —
// "1. gün A+B, 2. gün C" gibi bölme kollar arası karşılaştırmayı bozar.
export const SESSION1_REPS: Record<Arm, number> = { A: 3, B: 3, C: 8 };
export const SESSION_GAP_HOURS = 12;

export type Word = { es: string; emoji: string };

// SABİT liste — değiştirme.
export const WORDS: Word[] = [
  { es: "mariposa", emoji: "🦋" },
  { es: "llave", emoji: "🔑" },
  { es: "cuchara", emoji: "🥄" },
  { es: "zanahoria", emoji: "🥕" },
  { es: "ventana", emoji: "🪟" },
  { es: "caballo", emoji: "🐴" },
  { es: "fresa", emoji: "🍓" },
  { es: "pájaro", emoji: "🐦" },
  { es: "silla", emoji: "🪑" },
  { es: "queso", emoji: "🧀" },
  { es: "huevo", emoji: "🥚" },
  { es: "zapato", emoji: "👟" },
  { es: "abeja", emoji: "🐝" },
  { es: "rana", emoji: "🐸" },
  { es: "hoja", emoji: "🍃" },
  { es: "reloj", emoji: "⏰" },
  { es: "calcetín", emoji: "🧦" },
  { es: "cuchillo", emoji: "🔪" },
];

export const emojiOf = (es: string) => WORDS.find((w) => w.es === es)?.emoji ?? "❓";

export type Rep = { score: number; ms: number; at: number };
export type TestResult = { score: number; ms: number };

export type TestPhase = {
  startedAt: number;
  endedAt: number | null;
  prod: Record<string, TestResult>;
  rec: Record<string, TestResult>;
};

export type Step =
  | { kind: "teach"; es: string; arm: Arm }
  | { kind: "rep"; es: string; arm: Arm };

export type Phase =
  | "intro"
  | "train"
  | "pause"
  | "imm-prod"
  | "imm-rec"
  | "imm-done"
  | "del-prod"
  | "del-rec"
  | "del-done";

export type DeneyState = {
  v: 2;
  name: string;
  age: string;
  startedAt: number;
  trainEndedAt: number | null;
  assign: Record<string, Arm>;
  train: Record<string, Rep[]>;
  steps: Step[];
  /** 1. oturumun bittiği adım sayısı (idx bu değere ulaşınca ara verilir) */
  session1Len: number;
  s1EndedAt: number | null;
  s2StartedAt: number | null;
  /** 12 saatlik bekleme test amacıyla atlandı mı */
  gapSkipped: boolean;
  idx: number;
  phase: Phase;
  immediate: TestPhase | null;
  delayed: (TestPhase & { hours: number }) | null;
  // test sıraları (rastgele, kalıcı)
  immProdOrder: string[];
  immRecOrder: string[];
  delProdOrder: string[];
  delRecOrder: string[];
  testIdx: number;
};

function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function wordsOfArm(state: DeneyState, arm: Arm): string[] {
  return WORDS.filter((w) => state.assign[w.es] === arm).map((w) => w.es);
}

// Kollar arası KARIŞIK (interleaved) adım dizisi.
function interleave(pending: Record<string, Step[]>): Step[] {
  const out: Step[] = [];
  let last = "";
  for (;;) {
    const avail = Object.keys(pending).filter((k) => pending[k].length > 0);
    if (avail.length === 0) break;
    let pool = avail.filter((k) => k !== last);
    if (pool.length === 0) pool = avail;
    // kalan adımı çok olan kelimelere ağırlık ver (C kolu geride kalmasın)
    const total = pool.reduce((s, k) => s + pending[k].length, 0);
    let r = Math.random() * total;
    let pick = pool[0];
    for (const k of pool) {
      r -= pending[k].length;
      if (r <= 0) { pick = k; break; }
    }
    out.push(pending[pick].shift()!);
    last = pick;
  }
  return out;
}

/**
 * İki oturumluk adım dizisi.
 * 1. oturum: 18 öğretme + her kolun tekrarlarının yarısı (A:3, B:3, C:8)
 * 2. oturum: kalan tekrarlar (A:2, B:2, C:7)
 * Her kolun tekrarları İKİ oturuma da dağılır.
 */
function buildSteps(assign: Record<string, Arm>): { steps: Step[]; session1Len: number } {
  const first: Record<string, Step[]> = {};
  const second: Record<string, Step[]> = {};
  for (const w of WORDS) {
    const arm = assign[w.es];
    const s1: Step[] = [{ kind: "teach", es: w.es, arm }];
    const n1 = Math.min(SESSION1_REPS[arm], ARM_REPS[arm]);
    for (let i = 0; i < n1; i++) s1.push({ kind: "rep", es: w.es, arm });
    const s2: Step[] = [];
    for (let i = n1; i < ARM_REPS[arm]; i++) s2.push({ kind: "rep", es: w.es, arm });
    first[w.es] = s1;
    second[w.es] = s2;
  }
  const a = interleave(first);
  const b = interleave(second);
  return { steps: [...a, ...b], session1Len: a.length };
}

export function createState(name: string, age: string): DeneyState {
  const shuffled = shuffle(WORDS.map((w) => w.es));
  const assign: Record<string, Arm> = {};
  shuffled.forEach((es, i) => {
    assign[es] = i < 6 ? "A" : i < 12 ? "B" : "C";
  });
  const train: Record<string, Rep[]> = {};
  WORDS.forEach((w) => (train[w.es] = []));
  const all = WORDS.map((w) => w.es);
  const built = buildSteps(assign);
  return {
    v: 2,
    name,
    age,
    startedAt: Date.now(),
    trainEndedAt: null,
    assign,
    train,
    steps: built.steps,
    session1Len: built.session1Len,
    s1EndedAt: null,
    s2StartedAt: null,
    gapSkipped: false,
    idx: 0,
    phase: "train",
    immediate: null,
    delayed: null,
    immProdOrder: shuffle(all),
    immRecOrder: shuffle(all),
    delProdOrder: shuffle(all),
    delRecOrder: shuffle(all),
    testIdx: 0,
  };
}

/** 1. oturum bitişinden bu yana geçen saat */
export function hoursSinceSession1(s: DeneyState): number {
  if (!s.s1EndedAt) return 0;
  return (Date.now() - s.s1EndedAt) / 3_600_000;
}

export function canStartSession2(s: DeneyState): boolean {
  return hoursSinceSession1(s) >= SESSION_GAP_HOURS;
}

export function loadState(): DeneyState | null {
  try {
    const raw = localStorage.getItem(DENEY_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DeneyState;
    return s && s.v === 2 ? s : null;
  } catch {
    return null;
  }
}

export function saveState(s: DeneyState) {
  try { localStorage.setItem(DENEY_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function clearState() {
  try { localStorage.removeItem(DENEY_KEY); } catch { /* ignore */ }
}

// 4 şıklı seçenek üretimi — havuz dışarıdan verilir (eğitimde kol içi, testte 18'lik).
export function optionsFor(target: string, pool: string[]): string[] {
  const others = shuffle(pool.filter((p) => p !== target)).slice(0, 3);
  return shuffle([target, ...others]);
}

export const totalReps = () => 6 * ARM_REPS.A + 6 * ARM_REPS.B + 6 * ARM_REPS.C;

export function repsDone(s: DeneyState): number {
  return s.steps.slice(0, s.idx).filter((st) => st.kind === "rep").length;
}

/* ─────────── Rapor ─────────── */

const pct = (x: number, n: number) => (n === 0 ? "0" : ((x / n) * 100).toFixed(0));
const fmtDate = (t: number) =>
  new Date(t).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
const mins = (a: number, b: number) => Math.max(0, Math.round((b - a) / 60000));

function armTable(s: DeneyState, test: TestPhase): string {
  const head = "  KOL                 TEKRAR   ÜRETİM TESTİ      TANIMA TESTİ";
  const rows = (["A", "B", "C"] as Arm[]).map((arm) => {
    const ws = wordsOfArm(s, arm);
    const p = ws.reduce((t, w) => t + (test.prod[w]?.score ?? 0), 0);
    const r = ws.reduce((t, w) => t + (test.rec[w]?.score ?? 0), 0);
    return (
      "  " +
      ARM_LABEL[arm].padEnd(20) +
      String(ARM_REPS[arm]).padStart(2).padEnd(7) +
      `${p}/${ws.length} (%${pct(p, ws.length)})`.padEnd(18) +
      `${r}/${ws.length} (%${pct(r, ws.length)})`
    );
  });
  return [head, ...rows].join("\n");
}

function rawCounts(s: DeneyState, test: TestPhase): string {
  return (["A", "B", "C"] as Arm[])
    .map((arm) => {
      const ws = wordsOfArm(s, arm);
      let full = 0, part = 0, none = 0;
      ws.forEach((w) => {
        const sc = test.prod[w]?.score ?? 0;
        if (sc === 1) full++; else if (sc === 0.5) part++; else none++;
      });
      return `  ${ARM_LABEL[arm].padEnd(20)}üretim ham: bildi ${full} · kısmen ${part} · bilmedi ${none}`;
    })
    .join("\n");
}

export function buildReport(s: DeneyState): string {
  const imm = s.immediate;
  const L: string[] = [];
  L.push(`AKTARIM DENEYİ — ${s.name} (${s.age} yaş)`);
  const trainEnd = s.trainEndedAt ?? s.startedAt;
  L.push(
    `Eğitim: ${fmtDate(s.startedAt)} · Süre: ${mins(s.startedAt, trainEnd)} dk · Anında test: ${
      imm ? mins(trainEnd, imm.startedAt) : 0
    } dk sonra`,
  );
  L.push(
    `Gecikmeli test: ${s.delayed ? `var, ${s.delayed.hours} saat sonra` : "yok"}`,
  );
  const gapH = s.s1EndedAt && s.s2StartedAt ? (s.s2StartedAt - s.s1EndedAt) / 3_600_000 : null;
  L.push(
    `1. oturum bitişi: ${s.s1EndedAt ? fmtDate(s.s1EndedAt) : "-"} · 2. oturum başlangıcı: ${
      s.s2StartedAt ? fmtDate(s.s2StartedAt) : "-"
    } · Ara: ${gapH === null ? "-" : `${gapH.toFixed(1)} saat`}${
      s.gapSkipped ? " (BEKLEME ATLANDI — test amaçlı)" : ""
    }`,
  );
  L.push(`Oturum planı: 1. oturum A:${SESSION1_REPS.A} B:${SESSION1_REPS.B} C:${SESSION1_REPS.C} tekrar · 2. oturum A:${
    ARM_REPS.A - SESSION1_REPS.A} B:${ARM_REPS.B - SESSION1_REPS.B} C:${ARM_REPS.C - SESSION1_REPS.C} tekrar`);
  L.push("");
  if (imm) {
    L.push(armTable(s, imm));
    L.push("");
    L.push('  ("Kısmen" cevapları 0.5 sayılır, ham sayı aşağıda.)');
    L.push(rawCounts(s, imm));
    L.push("");
  }
  if (s.delayed) {
    L.push("  GECİKMELİ TEST");
    L.push(armTable(s, s.delayed));
    L.push(rawCounts(s, s.delayed));
    L.push("");
  }
  L.push("  KELİME KELİME DÖKÜM");
  L.push("  kelime | kol | tekrar | eğitimde doğru | üretim testi | tanıma testi | ort ms");
  for (const w of WORDS) {
    const arm = s.assign[w.es];
    const reps = s.train[w.es] ?? [];
    const corr = reps.reduce((t, r) => t + r.score, 0);
    const msArr = [
      ...reps.map((r) => r.ms),
      imm?.prod[w.es]?.ms ?? 0,
      imm?.rec[w.es]?.ms ?? 0,
    ].filter((m) => m > 0);
    const avg = msArr.length ? Math.round(msArr.reduce((a, b) => a + b, 0) / msArr.length) : 0;
    const p = imm?.prod[w.es]?.score;
    const r = imm?.rec[w.es]?.score;
    L.push(
      `  ${w.emoji} ${w.es.padEnd(11)}| ${arm} | ${String(ARM_REPS[arm]).padStart(2)} | ${String(
        corr,
      ).padStart(4)}/${reps.length} | ${
        (p === 1 ? "bildi" : p === 0.5 ? "kısmen" : p === 0 ? "bilmedi" : "-").padEnd(8)
      } | ${(r === 1 ? "doğru" : r === 0 ? "yanlış" : "-").padEnd(7)} | ${avg}`,
    );
  }
  L.push("");
  L.push("  NOT: tanıma testi 4 şıklı, şans seviyesi %25.");
  L.push("       eğitimde Kol A/C 4 şıklı, çeldiriciler kol içinden (6 kelimelik havuz).");
  return L.join("\n");
}

/* ─────────── Ses (ElevenLabs seslendirmesi + TTS yedeği) ─────────── */

// Sesler sunucuda BİR KEZ üretilip depoya yazılır; burada imzalı URL
// önbelleklenir (tarayıcı da mp3'ü kendi önbelleğinde tutar).
import { supabase } from "@/integrations/supabase/client";

const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();
let activeEl: HTMLAudioElement | null = null;
// Her yeni istek bir öncekini iptal eder: geç gelen ses ÇALMAZ (üst üste binme yok).
let seq = 0;
let twiceTimer: ReturnType<typeof setTimeout> | null = null;

function stopAll() {
  seq++;
  if (twiceTimer) { clearTimeout(twiceTimer); twiceTimer = null; }
  if (activeEl) {
    try { activeEl.onended = null; activeEl.onerror = null; activeEl.pause(); } catch { /* ignore */ }
    activeEl = null;
  }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
}

async function fetchVoice(text: string): Promise<string | null> {
  const hit = urlCache.get(text);
  if (hit) return hit;
  const inFlight = pending.get(text);
  if (inFlight) return inFlight;

  const p = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string }>("deney-tts", {
        body: { word: text },
      });
      const url = data?.url;
      if (error || !url) return null;
      urlCache.set(text, url);
      // mp3'ü tarayıcı önbelleğine al: ilk çalmada gecikme olmasın
      try { void fetch(url, { mode: "cors" }); } catch { /* ignore */ }
      return url;
    } catch {
      return null;
    } finally {
      pending.delete(text);
    }
  })();
  pending.set(text, p);
  return p;
}


/** 18 kelimeyi arka planda hazırla; kaçının hazır olduğunu döndürür. */
export async function prepareVoices(onProgress?: (done: number, total: number) => void) {
  const list = WORDS.map((w) => w.es);
  let done = 0;
  let ok = 0;
  await Promise.all(
    list.map(async (w) => {
      const u = await fetchVoice(w);
      if (u) ok++;
      done++;
      onProgress?.(done, list.length);
    }),
  );
  return ok;
}

export function spanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const vs = window.speechSynthesis.getVoices();
  return vs.find((v) => v.lang?.toLowerCase().startsWith("es")) ?? null;
}

function browserSpeak(text: string, token: number, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.85;
  const v = spanishVoice();
  if (v) u.voice = v;
  u.onend = () => { if (token === seq) onEnd?.(); };
  u.onerror = () => { if (token === seq) onEnd?.(); };
  window.speechSynthesis.speak(u);
}

export function speakEs(text: string, onEnd?: () => void) {
  stopAll();
  const token = seq;
  void fetchVoice(text).then((url) => {
    if (token !== seq) return; // araya yeni istek girdi
    if (!url) { browserSpeak(text, token, onEnd); return; }
    const el = new Audio(url);
    el.setAttribute("playsinline", "true");
    activeEl = el;
    el.onended = () => { if (token === seq) onEnd?.(); };
    el.onerror = () => { if (token === seq) browserSpeak(text, token, onEnd); };
    el.play().catch(() => { if (token === seq) browserSpeak(text, token, onEnd); });
  });
}

/** Öğretme adımı: kelimeyi iki kez okur (ikinci okuma birincisi BİTİNCE). */
export function speakTwice(text: string) {
  speakEs(text, () => {
    const token = seq;
    twiceTimer = setTimeout(() => {
      if (token !== seq) return;
      // ikinci okumada seq'i bozmadan çal
      speakEs(text);
    }, 450);
  });
}


