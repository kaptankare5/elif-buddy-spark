// ÖĞRENME SİMÜLASYONU — "eskiye vakit kalıyor mu?" sorusunu veriyle yanıtlar.
//
// Sentetik bir çocuğu (her harf için hafıza gücü H + unutma eğrisi) modeller ve
// GERÇEK seçiciyi (pickNextLetterFromTopic) + GERÇEK SRS'i (recordSrsAnswer) +
// gerçek kilit mantığını sürer. İki politikayı karşılaştırır:
//   A) tek-konu   : Test/Flashcard yalnız o an çalışılan konudan sorar (şimdiki)
//   B) konular-arası: Test/Flashcard da oyunlar gibi TÜM açık konulardan sorar
//
// Çocuk modeli (varsayımlar, açıkça):
//  - recall r = 2^(-geçenGün / H). Görülmemişse r = önBilgi (known0).
//  - Test = 4 şık: bildiyse doğru, bilmediyse %25 tahmin → SRS'i şişirebilir.
//  - Flashcard = kendi puanlar: yalnız gerçekten bildiyse doğru.
//  - Doğru geri-getirme H'yi büyütür (aralık bonuslu); yanlış H'yi düşürür;
//    tahminle "doğru" cok az öğretir (şişme burada görülür).
//  - Oturumlar arası +1 gün → unutma işler. Date.now sim-zamanına sabitlenir ki
//    bayatlık çarpanı da sim-zamanıyla çalışsın.
import { describe, it, expect, afterAll } from "vitest";
import {
  pickNextLetterFromTopic,
  recordSrsAnswer,
  getTopicSrs,
  __resetSelectorState,
  type TopicSrs,
} from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { getUnlockedItemsOf, isTopicCompleted, getUnlockedTopicIds } from "@/lib/unlock";

const DAYMS = 86_400_000;
const realNow = Date.now;
const realRandom = Math.random;
afterAll(() => { Date.now = realNow; Math.random = realRandom; });

// --- seedli PRNG (mulberry32) ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const topics = getAllTopics();
const practiceTopics = topics.filter((t) => !t.noPractice);
const idToTopic = new Map<string, string>();
for (const t of topics) for (const it of t.items) idToTopic.set(it.id, t.id);

interface Mem { H: number; last: number; studied: boolean; known0: number }

interface Metrics {
  topicsCompleted: number;
  frontierIdx: number;      // ulaşılan en ileri konu (indeks)
  introduced: number;       // SRS'te görülmüş harf
  srsMastered: number;      // SRS'e göre L3+
  trulyKnown: number;       // gerçek recall >= 0.9
  falseMastery: number;     // SRS L3+ ama recall < 0.5 (şişme/unutma)
  early2Retention: number;  // ilk 2 konunun sondaki ort. recall'ı
  avgQToL3: number;         // bir harfi L3'e ilk ulaştıran ort. gösterim
}

const SESSIONS = 55;
const Q_PER = 30;
const P_KNOWN = 0.1; // acemi çocuk: harflerin ~%10'unu zaten biliyor

function recall(m: Mem, day: number): number {
  if (!m.studied) return m.known0;
  const r = Math.pow(2, -(day - m.last) / m.H);
  return r < 0 ? 0 : r > 1 ? 1 : r;
}
function updateMem(m: Mem, retrieved: boolean, reported: boolean, r: number, day: number) {
  m.studied = true;
  if (retrieved) m.H = Math.min(400, m.H * (1.5 + 0.8 * (1 - r)));   // güçlen (aralık bonuslu)
  else if (reported) m.H = m.H * 1.05 + 0.15;                        // tahminle doğru — az öğrenme
  else m.H = Math.max(0.4, m.H * 0.5);                               // yanlış — düzeltici, kısmi
  m.last = day;
}

function runSim(config: "single" | "cross" | "interleave", seed: number): Metrics {
  localStorage.clear();
  __resetSelectorState();
  const rnd = mulberry32(seed);
  Math.random = rnd;

  // Çocuk profili (seed'e bağlı, iki config'de AYNI çocuk).
  const mem = new Map<string, Mem>();
  for (const t of practiceTopics) {
    for (const it of t.items) {
      const known = rnd() < P_KNOWN;
      mem.set(it.id, { H: known ? 40 : 0.2, last: 0, studied: false, known0: known ? 1 : 0.05 });
    }
  }

  const firstL3seen = new Map<string, number>(); // harf → L3'e ilk ulaştığı 'seen'
  const prevLevel = new Map<string, number>();

  const frontierTopic = () =>
    practiceTopics.find((t) => getUnlockedTopicIds().has(t.id) && !isTopicCompleted(t)) || null;

  const crossPool = (): { ids: string[]; merged: TopicSrs } => {
    const unlocked = getUnlockedTopicIds();
    const ids: string[] = [];
    const merged: TopicSrs = {};
    for (const t of practiceTopics) {
      if (!unlocked.has(t.id)) continue;
      const srs = getTopicSrs("quiz", t.id);
      for (const it of getUnlockedItemsOf(t)) {
        ids.push(it.id);
        if (srs[it.id]) merged[it.id] = srs[it.id];
      }
    }
    return { ids, merged };
  };

  for (let day = 0; day < SESSIONS; day++) {
    Date.now = () => day * DAYMS + 1;
    for (let q = 0; q < Q_PER; q++) {
      let pickId: string | null = null;
      let recTopic: string;

      if (config === "single") {
        const ct = frontierTopic();
        if (!ct) break;
        const pool = getUnlockedItemsOf(ct).map((i) => i.id);
        if (pool.length === 0) break;
        pickId = pickNextLetterFromTopic(getTopicSrs("quiz", ct.id), pool);
        recTopic = ct.id;
      } else if (config === "cross") {
        const { ids, merged } = crossPool();
        if (ids.length === 0) break;
        pickId = pickNextLetterFromTopic(merged, ids);
        recTopic = idToTopic.get(pickId)!;
      } else {
        // BLEND: %78 frontier (yeni öğrenme, K-kapılı) + %22 ESKİ konu bakımı
        // (bayatlık-güdümlü). Eski unutulmuş öğe frontier'ın K'sını meşgul
        // etmez → yeni akış korunur, eski de körelmez.
        const ct = frontierTopic();
        const unlocked = getUnlockedTopicIds();
        const oldIds: string[] = []; const oldMerged: TopicSrs = {};
        for (const t of practiceTopics) {
          if (ct && t.id === ct.id) break; // yalnız frontier'dan öncekiler
          if (!unlocked.has(t.id)) continue;
          const srs = getTopicSrs("quiz", t.id);
          for (const it of getUnlockedItemsOf(t)) { oldIds.push(it.id); if (srs[it.id]) oldMerged[it.id] = srs[it.id]; }
        }
        const review = oldIds.length > 0 && (!ct || rnd() < 0.22);
        if (review) {
          pickId = pickNextLetterFromTopic(oldMerged, oldIds);
          recTopic = idToTopic.get(pickId)!;
        } else if (ct) {
          const pool = getUnlockedItemsOf(ct).map((i) => i.id);
          if (pool.length === 0) break;
          pickId = pickNextLetterFromTopic(getTopicSrs("quiz", ct.id), pool);
          recTopic = ct.id;
        } else break;
      }
      if (!pickId) break;

      const m = mem.get(pickId)!;
      const r = recall(m, day);
      const isTest = rnd() < 0.6; // %60 test (4 şık), %40 flashcard
      const retrieved = rnd() < r;
      const reported = isTest ? retrieved || rnd() < 0.25 : retrieved;

      void recordSrsAnswer("quiz", recTopic, pickId, reported);
      updateMem(m, retrieved, reported, r, day);

      // L3'e ilk ulaşma anındaki gösterim sayısı
      const e = getTopicSrs("quiz", recTopic)[pickId];
      if (e) {
        const pl = prevLevel.get(pickId) ?? 1;
        if (pl < 3 && e.level >= 3 && !firstL3seen.has(pickId)) firstL3seen.set(pickId, e.seen);
        prevLevel.set(pickId, e.level);
      }
    }
  }

  // --- metrikler (son + 1 gün: ertesi-gün tutulumu) ---
  const endDay = SESSIONS;
  let introduced = 0, srsMastered = 0, trulyKnown = 0, falseMastery = 0;
  let frontierIdx = 0, topicsCompleted = 0;
  for (let ti = 0; ti < practiceTopics.length; ti++) {
    const t = practiceTopics[ti];
    const srs = getTopicSrs("quiz", t.id);
    let touched = false;
    if (isTopicCompleted(t) && Object.keys(srs).length > 0) topicsCompleted++;
    for (const it of t.items) {
      const e = srs[it.id];
      const m = mem.get(it.id)!;
      if (e && (e.seen ?? 0) > 0) { introduced++; touched = true; }
      if (e && e.level >= 3) {
        srsMastered++;
        if (recall(m, endDay) < 0.5) falseMastery++;
      }
      if (recall(m, endDay) >= 0.9) trulyKnown++;
    }
    if (touched) frontierIdx = ti;
  }
  // ilk 2 konunun tutulumu
  let e2 = 0, e2n = 0;
  for (const t of practiceTopics.slice(0, 2)) {
    for (const it of t.items) { e2 += recall(mem.get(it.id)!, endDay); e2n++; }
  }
  const l3vals = [...firstL3seen.values()];
  return {
    topicsCompleted, frontierIdx: frontierIdx + 1, introduced, srsMastered, trulyKnown,
    falseMastery, early2Retention: e2n ? e2 / e2n : 0,
    avgQToL3: l3vals.length ? l3vals.reduce((a, b) => a + b, 0) / l3vals.length : 0,
  };
}

function avg(runs: Metrics[]): Metrics {
  const k = runs.length;
  const s = runs.reduce((a, m) => ({
    topicsCompleted: a.topicsCompleted + m.topicsCompleted,
    frontierIdx: a.frontierIdx + m.frontierIdx,
    introduced: a.introduced + m.introduced,
    srsMastered: a.srsMastered + m.srsMastered,
    trulyKnown: a.trulyKnown + m.trulyKnown,
    falseMastery: a.falseMastery + m.falseMastery,
    early2Retention: a.early2Retention + m.early2Retention,
    avgQToL3: a.avgQToL3 + m.avgQToL3,
  }));
  return {
    topicsCompleted: s.topicsCompleted / k, frontierIdx: s.frontierIdx / k,
    introduced: s.introduced / k, srsMastered: s.srsMastered / k, trulyKnown: s.trulyKnown / k,
    falseMastery: s.falseMastery / k, early2Retention: s.early2Retention / k, avgQToL3: s.avgQToL3 / k,
  };
}

// Ağır (~30sn) — normal `npm test`te atlanır. Çalıştırmak için:
//   SIM=1 npx vitest run src/test/sim.test.ts
const RUN_SIM = process.env.SIM === "1";
describe("öğrenme simülasyonu (A tek-konu / B konular-arası / C blend)", () => {
  (RUN_SIM ? it : it.skip)("30 soru × 55 oturum, 8 tohum ort.", { timeout: 180_000 }, () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const A = avg(seeds.map((s) => runSim("single", s)));
    const B = avg(seeds.map((s) => runSim("cross", s)));
    const C = avg(seeds.map((s) => runSim("interleave", s)));
    const totalItems = practiceTopics.reduce((a, t) => a + t.items.length, 0);

    const f = (n: number) => n.toFixed(1);
    const pct = (n: number) => `%${(n * 100).toFixed(0)}`;
    console.log(`\n===== ÖĞRENME SİMÜLASYONU =====`);
    console.log(`Alıştırılabilir harf: ${totalItems} · ${SESSIONS} oturum × ${Q_PER} soru = ${SESSIONS * Q_PER} soru/çocuk · 8 tohum ort.`);
    console.log(`A=tek-konu (şimdiki)  B=tüm konular  C=blend (%78 frontier + %22 eski bakım)\n`);
    const row = (label: string, a: number, b: number, c: number, fmt: (n: number) => string = f) =>
      console.log(`${label.padEnd(34)} A=${fmt(a).padStart(6)}  B=${fmt(b).padStart(6)}  C=${fmt(c).padStart(6)}`);
    row("Tamamlanan konu", A.topicsCompleted, B.topicsCompleted, C.topicsCompleted);
    row("Ulaşılan en ileri konu (#)", A.frontierIdx, B.frontierIdx, C.frontierIdx);
    row("Tanıtılan harf (görülmüş)", A.introduced, B.introduced, C.introduced);
    row("SRS'e göre öğrenilmiş (L3+)", A.srsMastered, B.srsMastered, C.srsMastered);
    row("GERÇEKTEN bilinen (recall≥0.9)", A.trulyKnown, B.trulyKnown, C.trulyKnown);
    row("Sahte ustalık (L3+ ama unutulmuş)", A.falseMastery, B.falseMastery, C.falseMastery);
    row("İlk 2 konu tutulumu (recall)", A.early2Retention, B.early2Retention, C.early2Retention, pct);
    row("L3'e taşıyan ort. gösterim", A.avgQToL3, B.avgQToL3, C.avgQToL3);
    console.log(`\nÖzet — gerçek bilinen: A=${f(A.trulyKnown)} B=${f(B.trulyKnown)} C=${f(C.trulyKnown)} | sahte ustalık: A=${f(A.falseMastery)} B=${f(B.falseMastery)} C=${f(C.falseMastery)}\n`);

    expect(A.trulyKnown).toBeGreaterThan(0);
    expect(C.trulyKnown).toBeGreaterThanOrEqual(A.trulyKnown);
  });
});
