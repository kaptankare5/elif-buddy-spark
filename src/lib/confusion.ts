// 🔥 KARIŞIKLIK MOTORU — "çocuk NEYİ neyle karıştırıyor?"
//
// confusables.ts hangi öğelerin karışabileceğini a priori bilir. Bu modül ise
// çocuğun GERÇEKTEN karıştırdığını ölçer ve bunu bir "ısı" (heat, 0..1) olarak
// tutar. Isı üç yerde iş görür:
//
//   1) SIKLIK  — ısınmış çiftin öğeleri SRS biletinde çarpan alır, yani test /
//      oyun / flashcard'da daha sık gelir (srs.ts).
//   2) BİRLİKTELİK — çeldiriciler rastgele değil, ısınmış PARTNERDEN seçilir;
//      oyunda hedef Elif ise gelen harfler arasında Lem de bulunur.
//   3) ARDIŞIKLIK — flashcard'da ısınmış çift arka arkaya sorulur; çocuk ayrımı
//      üst üste yapana kadar devam eder.
//
// Isı nasıl değişir?
//   • Çocuk hedefi ıskalayıp PARTNERİ seçtiyse (gerçek karışıklık kanıtı):
//     +0.34. Hangi şıkkı seçtiği bilinmiyorsa a-priori partnerlere +0.12.
//   • Partner ORTADAYKEN doğru ayırt ettiyse: sayaç artar; ÜST ÜSTE 3 doğru
//     ayrımda ısı 0.5 düşer, sayaç sıfırlanır. ("karışıklığı yapmayana kadar")
//   • Zamanla sönümlenir: yarı ömür 21 gün — eski, artık yapılmayan karışıklık
//     müfredatı sonsuza dek meşgul etmesin.
//
// Neden ayrı bir katman: SRS "bu öğeyi biliyor mu?" sorusunu ölçer; karışıklık
// ise İKİLİ bir ilişkidir (Elif tek başına biliniyor olabilir ama Lem'in
// yanında bilinmiyordur). İkili sinyal tek tek öğe seviyelerine sığmaz.
import type { ContentItem } from "@/data/types";
import {
  baseConfusable, confusableLetters, formOf, letterNumOf, sameSuffix, shuffle,
} from "@/lib/confusables";

// --- ayarlar ---
const MISS_UP = 0.34;        // partneri seçti → kesin karışıklık kanıtı
const MISS_SOFT = 0.12;      // yanlış ama seçimi bilinmiyor → a-priori partnerlere
const OK_NEEDED = 3;         // ısıyı düşürmek için üst üste doğru ayrım
const OK_DROP = 0.5;
const HALF_LIFE_DAYS = 21;   // sönümlenme
const HOT = 0.05;            // bunun üstü "ısınmış" sayılır
const DAY = 86_400_000;

type Pair = { h: number; miss: number; ok: number; t: number };
type Store = { letters: Record<string, Pair>; forms: Record<string, Pair> };

const EVENT = "elifba-confusion-updated";

let _student: string | null = null;
try {
  if (typeof localStorage !== "undefined") {
    _student = localStorage.getItem("elifba-active-student-v1");
  }
} catch { /* ignore */ }

/** Hoca Modu: aktif öğrenci değişince ısı da o öğrenciye ait olmalı.
 *  srs.ts'teki setActiveStudentScope buradan çağırır (bağımlılık tek yönlü). */
export function setConfusionScope(sid: string | null) {
  _student = sid || null;
  _cache = null;
}

const KEY = () =>
  _student ? `elifba-confusion-student-${_student}-v1` : `elifba-confusion-guest-v1`;

let _cache: Store | null = null;

function load(): Store {
  if (_cache) return _cache;
  let s: Store = { letters: {}, forms: {} };
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY()) : null;
    if (raw) {
      const p = JSON.parse(raw) as Partial<Store>;
      s = { letters: p.letters ?? {}, forms: p.forms ?? {} };
    }
  } catch { /* bozuk veri → temiz başla */ }
  _cache = s;
  return s;
}

function save(s: Store) {
  _cache = s;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY(), JSON.stringify(s));
  } catch { /* kota dolu olabilir — ısı kritik veri değil */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* SSR */ }
}

/** Sönümlenmiş ısı — okuma anında hesaplanır (yazmaya gerek yok). */
function decayed(p: Pair | undefined, now: number): number {
  if (!p || p.h <= 0) return 0;
  const days = Math.max(0, (now - (p.t || now)) / DAY);
  return p.h * Math.pow(0.5, days / HALF_LIFE_DAYS);
}

// --- çift anahtarları ---
// İki eksen ayrı tutulur: HARF karışıklığı (Elif↔Lem) bütün hâllere/harekelere
// taşınmalıdır ("elif ile lam karıştırılıyorsa sondaki hâli de sık gelsin"),
// FORM karışıklığı (جـ ↔ ـجـ) ise yalnız o harfin kendi hâlleri arasındadır.
type PairRef = { kind: "letters" | "forms"; key: string };

function pairRefOf(aId: string, bId: string): PairRef | null {
  if (aId === bId) return null;
  const na = letterNumOf(aId), nb = letterNumOf(bId);
  if (na == null || nb == null) return null;
  if (na !== nb) {
    const [x, y] = na < nb ? [na, nb] : [nb, na];
    return { kind: "letters", key: `${x}|${y}` };
  }
  const fa = formOf(aId), fb = formOf(bId);
  if (!fa || !fb || fa === fb) return null;
  const [x, y] = fa < fb ? [fa, fb] : [fb, fa];
  return { kind: "forms", key: `${String(na).padStart(2, "0")}:${x}|${y}` };
}

function getPair(s: Store, ref: PairRef): Pair | undefined {
  return s[ref.kind][ref.key];
}

function bump(ref: PairRef, delta: number) {
  const s = load();
  const now = Date.now();
  const cur = getPair(s, ref);
  const h = Math.min(1, decayed(cur, now) + delta);
  s[ref.kind][ref.key] = { h, miss: (cur?.miss ?? 0) + 1, ok: 0, t: now };
  save(s);
}

// --- okuma ---

/** İki öğe arasındaki ÖLÇÜLEN karışıklık ısısı (0..1). */
export function heatBetween(aId: string, bId: string): number {
  const ref = pairRefOf(aId, bId);
  if (!ref) return 0;
  return decayed(getPair(load(), ref), Date.now());
}

/** Bu öğenin herhangi bir partnerle en yüksek ısısı — SRS bilet çarpanı için. */
export function itemHeat(id: string): number {
  const n = letterNumOf(id);
  if (n == null) return 0;
  const s = load();
  const now = Date.now();
  let best = 0;
  for (const [key, p] of Object.entries(s.letters)) {
    const [x, y] = key.split("|").map(Number);
    if (x === n || y === n) best = Math.max(best, decayed(p, now));
  }
  const f = formOf(id);
  if (f) {
    const nn = String(n).padStart(2, "0");
    for (const [key, p] of Object.entries(s.forms)) {
      const [head, forms] = key.split(":");
      if (head !== nn) continue;
      if (forms.split("|").includes(f)) best = Math.max(best, decayed(p, now));
    }
  }
  return best;
}

/** Bu öğenin ısınmış partnerleri, ısısı yüksekten düşüğe. */
export function hotPartnersOf(id: string, pool: ContentItem[]): ContentItem[] {
  return pool
    .filter((it) => it.id !== id && heatBetween(id, it.id) > HOT)
    .sort((a, b) => heatBetween(id, b.id) - heatBetween(id, a.id));
}

// --- yazma ---

/** Çocuk hedefi ıskalayıp BAŞKA bir şıkkı seçti — en güçlü karışıklık kanıtı. */
export function recordConfusionPick(targetId: string, chosenId: string) {
  const ref = pairRefOf(targetId, chosenId);
  if (!ref) return;
  bump(ref, MISS_UP);
}

/** Yanlış cevap ama neyi seçtiği bilinmiyor (yön tuşlu oyunlar, süre bitti…).
 *  A-priori partnerlere küçük bir ısı dağıtılır — kör ama yararlı sinyal. */
export function recordMiss(targetId: string) {
  const n = letterNumOf(targetId);
  if (n == null) return;
  const s = load();
  const now = Date.now();
  let touched = false;
  for (const other of confusableLetters(n)) {
    const [x, y] = n < other ? [n, other] : [other, n];
    const key = `${x}|${y}`;
    const cur = s.letters[key];
    s.letters[key] = {
      h: Math.min(1, decayed(cur, now) + MISS_SOFT),
      miss: (cur?.miss ?? 0) + 1, ok: 0, t: now,
    };
    touched = true;
  }
  const f = formOf(targetId);
  if (f) {
    const nn = String(n).padStart(2, "0");
    for (const other of ["init", "med", "fin"] as const) {
      if (other === f) continue;
      const [x, y] = f < other ? [f, other] : [other, f];
      const key = `${nn}:${x}|${y}`;
      const cur = s.forms[key];
      s.forms[key] = {
        h: Math.min(1, decayed(cur, now) + MISS_SOFT),
        miss: (cur?.miss ?? 0) + 1, ok: 0, t: now,
      };
      touched = true;
    }
  }
  if (touched) save(s);
}

/**
 * Hedef DOĞRU bilindi ve karışan partner(ler) ortadaydı → gerçek ayrım.
 * Üst üste OK_NEEDED ayrımda ısı düşer. "Karışıklığı yapmayana kadar devam."
 */
export function recordDiscrimination(targetId: string, shownIds: string[]) {
  const s = load();
  const now = Date.now();
  let touched = false;
  for (const other of shownIds) {
    const ref = pairRefOf(targetId, other);
    if (!ref) continue;
    const cur = getPair(s, ref);
    const h = decayed(cur, now);
    if (h <= 0) continue;                     // zaten soğuk — sayaç tutmaya gerek yok
    const ok = (cur?.ok ?? 0) + 1;
    if (ok >= OK_NEEDED) {
      s[ref.kind][ref.key] = { h: Math.max(0, h - OK_DROP), miss: cur?.miss ?? 0, ok: 0, t: now };
    } else {
      s[ref.kind][ref.key] = { h, miss: cur?.miss ?? 0, ok, t: now };
    }
    touched = true;
  }
  if (touched) save(s);
}

// --- seçim ---

/**
 * Hedefe çeldirici seç. Sıra: (1) ÖLÇÜLEN ısısı en yüksek partnerler,
 * (2) a-priori karışanlar — aynı ek/hâl önce, (3) rastgele doldurma.
 * Karışan yoksa sorunsuz rastgeleye düşer (eski davranış korunur).
 */
export function pickDistractors(pool: ContentItem[], target: ContentItem, count = 3): ContentItem[] {
  const others = pool.filter((it) => it.id !== target.id);
  if (others.length <= count) return shuffle(others);

  const hot: ContentItem[] = [];
  const base: ContentItem[] = [];
  const rest: ContentItem[] = [];
  for (const it of others) {
    if (heatBetween(target.id, it.id) > HOT) hot.push(it);
    else if (baseConfusable(target.id, it.id)) base.push(it);
    else rest.push(it);
  }
  hot.sort((a, b) => heatBetween(target.id, b.id) - heatBetween(target.id, a.id));
  // a-priori grubun içinde aynı ekli/hâlli olanlar önce → yalnız harf farkı kalır
  const baseSame = shuffle(base.filter((it) => sameSuffix(target.id, it.id)));
  const baseOther = shuffle(base.filter((it) => !sameSuffix(target.id, it.id)));
  return [...hot, ...baseSame, ...baseOther, ...shuffle(rest)].slice(0, count);
}

/**
 * Flashcard ardışıklığı: az önce cevaplanan karttan sonra ısınmış PARTNERİNİ
 * göster (karşıtlık ancak yan yana çalışır). Isı ne kadar yüksekse o kadar
 * sık. Aynı çiftte üst üste en fazla `maxChain` kez — çocuk döngüde sıkışmasın.
 */
export function pickContrastId(
  prevId: string | null,
  availableIds: string[],
  chainSoFar = 0,
  maxChain = 3,
): string | null {
  if (!prevId || chainSoFar >= maxChain) return null;
  let bestId: string | null = null;
  let bestHeat = 0;
  for (const id of availableIds) {
    if (id === prevId) continue;
    const h = heatBetween(prevId, id);
    if (h > bestHeat) { bestHeat = h; bestId = id; }
  }
  if (!bestId || bestHeat <= HOT) return null;
  // p: ısı 0.1 → %40, ısı 1.0 → %85
  const p = Math.min(0.85, 0.35 + 0.5 * bestHeat);
  return Math.random() < p ? bestId : null;
}

// --- araçlar (Ayarlar → hata ayıklama paneli, testler) ---

export function getConfusionDebug(): {
  letters: { pair: string; heat: number; miss: number; ok: number }[];
  forms: { pair: string; heat: number; miss: number; ok: number }[];
} {
  const s = load();
  const now = Date.now();
  const map = (rec: Record<string, Pair>) =>
    Object.entries(rec)
      .map(([pair, p]) => ({ pair, heat: +decayed(p, now).toFixed(2), miss: p.miss, ok: p.ok }))
      .filter((r) => r.heat > 0)
      .sort((a, b) => b.heat - a.heat);
  return { letters: map(s.letters), forms: map(s.forms) };
}

export function resetConfusion() {
  save({ letters: {}, forms: {} });
}

/** Testler için: bellek önbelleğini at (localStorage taze okunur). */
export function __resetConfusionCache() {
  _cache = null;
}

export const CONFUSION_EVENT = EVENT;
