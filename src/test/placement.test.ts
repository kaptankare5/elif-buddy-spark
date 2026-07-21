// Problem 1 (öğrenme seti kapısı) + Problem 2 (yerleştirme / ara-kontrol)
// davranış testleri. Gerçek modülleri jsdom localStorage'ı ile sürer.
import { describe, it, expect, beforeEach } from "vitest";
import {
  pickNextLetterFromTopic,
  getIntroGateInfo,
  LEARNING_SET_K,
  recordSrsAnswer,
  retrievabilityOf,
  __resetSelectorState,
  type TopicSrs,
} from "@/data/srs";
import { currentReviewShare } from "@/lib/review";
import {
  markTopicSkipped,
  isTopicSkipped,
  backCheckPressure,
  pickBackCheckTopic,
  recordBackCheck,
  getPlacementDebug,
} from "@/lib/placement";
import { getUnlockedTopicIds } from "@/lib/unlock";
import { pickReviewItem } from "@/lib/review";
import { pickDistractors, letterNumOf } from "@/lib/confusables";
import { getTopicSrs } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";

const topics = getAllTopics();
const practice = topics.filter((t) => !t.noPractice);
const ids = topics[0].items.map((i) => i.id); // "harfler" harf id'leri

const seenAt = (level: number): TopicSrs[string] => ({
  level: level as 1 | 2 | 3 | 4, correct: 1, total: 1, seen: 1, lastSeen: Date.now(),
});

beforeEach(() => { localStorage.clear(); });

// --- PROBLEM 1: Öğrenme seti kapısı (saf fonksiyon — _recent boş, struggling yok) ---
describe("Problem 1 — öğrenme seti kapısı (K)", () => {
  it("K harf öğrenilmekteyken YENİ harf tanıtmaz", () => {
    // İlk 3 harf görülmüş (L2, öğrenilmekte), gerisi görülmemiş.
    const topic: TopicSrs = { [ids[0]]: seenAt(2), [ids[1]]: seenAt(2), [ids[2]]: seenAt(2) };
    const seen = new Set([ids[0], ids[1], ids[2]]);
    const pick = pickNextLetterFromTopic(topic, ids);
    const gate = getIntroGateInfo()!;
    expect(gate.inProgress).toBe(LEARNING_SET_K);
    expect(gate.gated).toBe(true);
    // Seçim görülmüş 3 harften biri — 4. (görülmemiş) harf tanıtılmadı.
    expect(seen.has(pick)).toBe(true);
    expect(pick).not.toBe(ids[3]);
  });

  it("bir harf L3'e ulaşınca (set boşalınca) sıradaki YENİ harfi tanıtır", () => {
    // 0. harf L3 (öğrenilmekten çıktı) → inProgress=2 < K → kapı açılır.
    const topic: TopicSrs = { [ids[0]]: seenAt(3), [ids[1]]: seenAt(2), [ids[2]]: seenAt(2) };
    const pick = pickNextLetterFromTopic(topic, ids);
    const gate = getIntroGateInfo()!;
    expect(gate.inProgress).toBe(2);
    expect(gate.gated).toBe(false);
    // Müfredat sırasındaki ilk görülmemiş harf = ids[3].
    expect(pick).toBe(ids[3]);
  });

  it("taze konuda ilk harfi her zaman tanıtır (kapı deadlock yapmaz)", () => {
    const pick = pickNextLetterFromTopic({}, ids);
    expect(pick).toBe(ids[0]);
    expect(getIntroGateInfo()!.gated).toBe(false);
  });
});

// --- PROBLEM 2: Yerleştirme (Test Out) + ara-kontrol ---
describe("Problem 2 — yerleştirme ve ara-kontrol", () => {
  it("konu atlanınca sonraki konu açılır (öğeler görülmemiş kalır)", () => {
    expect(isTopicSkipped(topics[0].id)).toBe(false);
    const before = getUnlockedTopicIds();
    expect(before.has(topics[1].id)).toBe(false); // başta 2. konu kilitli

    markTopicSkipped(topics[0].id);
    expect(isTopicSkipped(topics[0].id)).toBe(true);
    const after = getUnlockedTopicIds();
    expect(after.has(topics[1].id)).toBe(true); // atlayınca 2. konu açıldı
  });

  it("deneme süresi: taze atlama ~%35 baskı; 4 doğru yoklama sonrası onaylanır (~%10)", () => {
    markTopicSkipped(topics[0].id);
    expect(backCheckPressure(topics[0].id)).toBeCloseTo(0.35, 2);
    for (let i = 0; i < 4; i++) recordBackCheck(topics[0].id, true);
    expect(backCheckPressure(topics[0].id)).toBeCloseTo(0.10, 2);
  });

  it("zayıf konu: yoklamalar kötüyse baskı %50+'ya tırmanır (geri çeker)", () => {
    markTopicSkipped(topics[0].id);
    for (let i = 0; i < 4; i++) recordBackCheck(topics[0].id, false); // acc=0
    const p = backCheckPressure(topics[0].id);
    expect(p).toBeGreaterThanOrEqual(0.5);
    expect(p).toBeLessThanOrEqual(0.8);
    const dbg = getPlacementDebug().find((r) => r.topicId === topics[0].id)!;
    expect(dbg.status).toBe("zayıf");
  });

  it("ara-kontrol yalnız ÖNCEKİ atlanmış konudan gelir, bazen de hiç gelmez", () => {
    markTopicSkipped(topics[0].id);
    let fromEarlier = 0, none = 0;
    for (let i = 0; i < 300; i++) {
      const bc = pickBackCheckTopic(topics[2].id); // 3. konudayken
      if (bc === null) none++;
      else { expect(bc).toBe(topics[0].id); fromEarlier++; }
    }
    expect(fromEarlier).toBeGreaterThan(0); // ara-kontrol geliyor
    expect(none).toBeGreaterThan(0);        // ama her sefer değil (~%35)
  });

  it("ilk konudayken (öncesi yok) ara-kontrol gelmez", () => {
    markTopicSkipped(topics[0].id);
    for (let i = 0; i < 50; i++) expect(pickBackCheckTopic(topics[0].id)).toBeNull();
  });
});

// --- SERPİŞTİRİLMİŞ BAKIM: Test/Flashcard eski açık konulardan da sorar ---
describe("serpiştirilmiş bakım (pickReviewItem)", () => {
  it("ilk konu tamamlanınca, sonraki konuda ~%22 ESKİ konudan bakım gelir", () => {
    const t0 = practice[0], t1 = practice[1];
    // t0'ı tamamla (tüm öğeler L3), 5 gün bayat.
    const state: Record<string, Record<string, unknown>> = { [t0.id]: {} };
    for (const it of t0.items) {
      state[t0.id][it.id] = { level: 3, correct: 3, total: 3, seen: 3, lastSeen: Date.now() - 5 * 86_400_000 };
    }
    localStorage.setItem("elifba-srs-quiz-guest-v1", JSON.stringify(state));
    expect(getUnlockedTopicIds().has(t1.id)).toBe(true);

    const t0ids = new Set(t0.items.map((i) => i.id));
    const t1ids = new Set(t1.items.map((i) => i.id));
    let review = 0, frontier = 0;
    for (let i = 0; i < 400; i++) {
      const r = pickReviewItem(t1.id, "quiz");
      if (r === null) { frontier++; continue; }
      review++;
      expect(t0ids.has(r.itemId)).toBe(true);   // yalnız eski konudan
      expect(t1ids.has(r.itemId)).toBe(false);  // frontier'ın kendi öğesi değil
      expect(r.topicId).toBe(t0.id);
    }
    expect(review).toBeGreaterThan(0);   // bakım geliyor
    expect(frontier).toBeGreaterThan(0); // ama çoğunlukla frontier (~%78)
    expect(review).toBeLessThan(200);    // ~%22 → 400'de ~88; yarıdan az
  });

  it("ilk konuda (öncesi yok) bakım gelmez", () => {
    for (let i = 0; i < 40; i++) expect(pickReviewItem(practice[0].id, "quiz")).toBeNull();
  });
});

// --- KARIŞAN HARF AYRIMI: çeldiriciler hedefin karışanlarından ---
describe("karışan harf çeldiricileri (pickDistractors)", () => {
  const harfler = topics[0].items; // l1-01..l1-28
  it("Be (ب) için çeldiriciler karışan harflerden gelir (ت ث ن ي)", () => {
    const be = harfler.find((i) => i.id === "l1-02")!;
    const confN = [3, 4, 25, 28]; // Te Se Nun Ye
    // 20 denemede de 3 çeldirici de karışan kümesinden (4 aday, 3 seçilir).
    for (let k = 0; k < 20; k++) {
      const wrongs = pickDistractors(harfler, be, 3);
      expect(wrongs).toHaveLength(3);
      expect(wrongs.every((w) => confN.includes(letterNumOf(w.id)!))).toBe(true);
      expect(wrongs.some((w) => w.id === be.id)).toBe(false);
    }
  });

  it("karışanı olmayan/eşleşmeyen id'de sorunsuz rastgeleye düşer", () => {
    const fake = { id: "extra-x", label: "x", speech: "x", lang: "tr" as const };
    const wrongs = pickDistractors(harfler, fake, 3);
    expect(wrongs).toHaveLength(3);
  });
});

// --- AKICILIK (tepki süresi): yavaş-doğru L4'ü engeller + kırılgan işaretler ---
describe("akıcılık / latency (responseMs)", () => {
  it("yavaş-doğru L3'te tutar; hızlı-doğru L4'e çıkarır", async () => {
    const rec = (correct: boolean, ms?: number) =>
      recordSrsAnswer("quiz", "harfler", "l1-05", correct, ms !== undefined ? { responseMs: ms } : {});
    await rec(true, 1000); // L1→L2
    await rec(true, 1000); // L2→L3
    expect(getTopicSrs("quiz", "harfler")["l1-05"].level).toBe(3);
    await rec(true, 9000); // YAVAŞ doğru → L3'te kalır, kırılgan
    const e1 = getTopicSrs("quiz", "harfler")["l1-05"];
    expect(e1.level).toBe(3);
    expect(e1.fragile).toBe(true);
    expect(e1.lastMs).toBe(9000);
    await rec(true, 1200); // HIZLI doğru → L4
    const e2 = getTopicSrs("quiz", "harfler")["l1-05"];
    expect(e2.level).toBe(4);
    expect(e2.fragile).toBe(false);
  });
});

// --- FSRS-lite (yarı-ömür modeli) ---
describe("FSRS-lite — yarı-ömür ve hatırlanabilirlik", () => {
  const realNow = Date.now;
  const at = (dayMs: number) => { Date.now = () => dayMs; };
  const entry = () => getTopicSrs("quiz", "harfler")["l1-07"];
  const rec = (correct: boolean, ms = 1000) =>
    recordSrsAnswer("quiz", "harfler", "l1-07", correct, { responseMs: ms });

  it("R unutma eğrisiyle düşer; yarı-ömür noktasında %50", () => {
    const t0 = 10 * 86_400_000; // lastSeen=0 "hiç görülmedi" demek → sıfırdan uzak taban
    const e = { level: 3 as const, correct: 1, total: 1, seen: 1, lastSeen: t0, stab: 4 };
    expect(retrievabilityOf(e, t0)).toBeCloseTo(1, 5);
    expect(retrievabilityOf(e, t0 + 4 * 86_400_000)).toBeCloseTo(0.5, 5);
    expect(retrievabilityOf(e, t0 + 8 * 86_400_000)).toBeCloseTo(0.25, 5);
    expect(retrievabilityOf(undefined, t0)).toBe(0); // görülmemiş = en acil
  });

  it("ilk doğru ~0.7g başlatır; taze tekrar AZ, ertesi-gün tekrarı ÇOK büyütür; yanlış küçültür", async () => {
    __resetSelectorState();
    const t0 = 10 * 86_400_000;
    at(t0); await rec(true);             // ilk karşılaşma (hızlı doğru)
    const s0 = entry().stab!;
    expect(s0).toBeCloseTo(0.7, 5);
    at(t0 + 60_000); await rec(true);    // 1 dk sonra (R≈1) → taban büyüme %15
    const s1 = entry().stab!;
    expect(s1).toBeCloseTo(s0 * 1.15, 3);
    at(t0 + 60_000 + 2 * 86_400_000); await rec(true); // 2 gün sonra (R düşük) → büyük sıçrama
    const s2 = entry().stab!;
    expect(s2 / s1).toBeGreaterThan(2);  // (1−R)~0.9 → ×~3
    at(t0 + 60_000 + 3 * 86_400_000); await rec(false); // yanlış → ×0.3
    expect(entry().stab!).toBeCloseTo(s2 * 0.3, 3);
    Date.now = realNow;
  });

  it("seçici düşük-R (unutulmak üzere) öğeye daha çok bilet verir", () => {
    __resetSelectorState();
    const now = Date.now();
    const mk = (stab: number): TopicSrs[string] =>
      ({ level: 4, correct: 5, total: 5, seen: 2, lastSeen: now - 5 * 86_400_000, stab });
    // a: sağlam (yarı-ömür 50g → R yüksek). b: çürük (0.7g → R≈0).
    // c/d dolgu (seen yüksek → havuza girmez).
    const topic: TopicSrs = {
      a: mk(50), b: mk(0.7),
      c: { ...mk(50), seen: 9 }, d: { ...mk(50), seen: 9 },
    };
    let aN = 0, bN = 0;
    for (let i = 0; i < 400; i++) {
      const p = pickNextLetterFromTopic(topic, ["a", "b", "c", "d"]);
      if (p === "a") aN++; else if (p === "b") bN++;
    }
    expect(bN).toBeGreaterThan(aN); // çürük öğe önce geri gelir
  });
});

// --- DİNAMİK K + akışa uyarlı bakım payı ---
describe("akış bandı — uçarken K genişler, bakım payı değişir", () => {
  it("uçarken (yüksek doğruluk) K=5: 3 harf öğrenilmekteyken bile YENİ harf gelir", async () => {
    __resetSelectorState();
    for (let i = 0; i < 12; i++) await recordSrsAnswer("quiz", "dummy-f", `f${i}`, true, {});
    expect(currentReviewShare()).toBeCloseTo(0.10, 5); // uçuş → bakım payı düşer
    const topic: TopicSrs = { [ids[0]]: seenAt(2), [ids[1]]: seenAt(2), [ids[2]]: seenAt(2) };
    const pick = pickNextLetterFromTopic(topic, ids);
    const gate = getIntroGateInfo()!;
    expect(gate.k).toBe(LEARNING_SET_K + 2); // efektif K genişledi
    expect(gate.gated).toBe(false);
    expect(pick).toBe(ids[3]); // sıradaki YENİ harf tanıtıldı
  });
});

// --- PROBLEM 1: struggling (zorlanınca) kapısı — _recent'i kirlettiği için EN SON ---
describe("Problem 1 — zorlanınca yeni harf durur", () => {
  it("son doğruluk düşükken tek harf öğrenilmekte olsa bile YENİ harf tanıtmaz", async () => {
    // _recent'i 8 yanlışla doldur → struggling (acc < %70).
    __resetSelectorState();
    for (let i = 0; i < 8; i++) {
      await recordSrsAnswer("quiz", "dummy-topic", `d${i}`, false, {});
    }
    // Sadece 1 harf öğrenilmekte (K altında) ama zorlanıyor → kapı kapalı.
    const topic: TopicSrs = { [ids[0]]: seenAt(2) };
    const pick = pickNextLetterFromTopic(topic, ids);
    const gate = getIntroGateInfo()!;
    expect(gate.struggling).toBe(true);
    expect(gate.inProgress).toBe(1); // K'dan az
    expect(gate.gated).toBe(true);   // yine de yeni harf yok
    expect(pick).toBe(ids[0]);       // eldeki tek görülmüş harf
    // Zorlanırken eski-konu bakım payı %50'ye çıkar (kolaylar eski konuda).
    expect(currentReviewShare()).toBeCloseTo(0.50, 5);
  });
});
