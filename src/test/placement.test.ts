// Problem 1 (öğrenme seti kapısı) + Problem 2 (yerleştirme / ara-kontrol)
// davranış testleri. Gerçek modülleri jsdom localStorage'ı ile sürer.
import { describe, it, expect, beforeEach } from "vitest";
import {
  pickNextLetterFromTopic,
  getIntroGateInfo,
  LEARNING_SET_K,
  recordSrsAnswer,
  type TopicSrs,
} from "@/data/srs";
import {
  markTopicSkipped,
  isTopicSkipped,
  backCheckPressure,
  pickBackCheckTopic,
  recordBackCheck,
  getPlacementDebug,
} from "@/lib/placement";
import { getUnlockedTopicIds } from "@/lib/unlock";
import { getAllTopics } from "@/data/subjects";

const topics = getAllTopics();
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

// --- PROBLEM 1: struggling (zorlanınca) kapısı — _recent'i kirlettiği için EN SON ---
describe("Problem 1 — zorlanınca yeni harf durur", () => {
  it("son doğruluk düşükken tek harf öğrenilmekte olsa bile YENİ harf tanıtmaz", async () => {
    // _recent'i 8 yanlışla doldur → struggling (acc < %70).
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
  });
});
