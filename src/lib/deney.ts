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
  | "imm-prod"
  | "imm-rec"
  | "imm-done"
  | "del-prod"
  | "del-rec"
  | "del-done";

export type DeneyState = {
  v: 1;
  name: string;
  age: string;
  startedAt: number;
  trainEndedAt: number | null;
  assign: Record<string, Arm>;
  train: Record<string, Rep[]>;
  steps: Step[];
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
function buildSteps(assign: Record<string, Arm>): Step[] {
  const pending: Record<string, Step[]> = {};
  for (const w of WORDS) {
    const arm = assign[w.es];
    const list: Step[] = [{ kind: "teach", es: w.es, arm }];
    for (let i = 0; i < ARM_REPS[arm]; i++) list.push({ kind: "rep", es: w.es, arm });
    pending[w.es] = list;
  }
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

export function createState(name: string, age: string): DeneyState {
  const shuffled = shuffle(WORDS.map((w) => w.es));
  const assign: Record<string, Arm> = {};
  shuffled.forEach((es, i) => {
    assign[es] = i < 6 ? "A" : i < 12 ? "B" : "C";
  });
  const train: Record<string, Rep[]> = {};
  WORDS.forEach((w) => (train[w.es] = []));
  const all = WORDS.map((w) => w.es);
  return {
    v: 1,
    name,
    age,
    startedAt: Date.now(),
    trainEndedAt: null,
    assign,
    train,
    steps: buildSteps(assign),
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

export function loadState(): DeneyState | null {
  try {
    const raw = localStorage.getItem(DENEY_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DeneyState;
    return s && s.v === 1 ? s : null;
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

/* ─────────── Ses (SpeechSynthesis, es-ES) ─────────── */

export function spanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const vs = window.speechSynthesis.getVoices();
  return vs.find((v) => v.lang?.toLowerCase().startsWith("es")) ?? null;
}

export function speakEs(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-ES";
  u.rate = 0.85;
  const v = spanishVoice();
  if (v) u.voice = v;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function speakTwice(text: string) {
  speakEs(text, () => setTimeout(() => speakEs(text), 450));
}
