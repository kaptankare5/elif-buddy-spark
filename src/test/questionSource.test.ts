// SORU KAYNAĞI testleri — "çocuk sürekli yanlış yapıyor" hatasının regresyonu.
//
// Bildirilen davranış: çocuk testte durmadan yanlış cevaplıyordu; uyarlanır
// zorluk kolay soru vermek istiyor ama önceki konudan hiç soru gelmiyordu.
// Sebebi: yanlış cevaplanan harf tekrar soruluyordu, tekrar da yanlışsa YİNE
// kuyruğa giriyordu → aynı harfte kilitlenme, bakım kanalına hiç sıra yok.
import { describe, it, expect, beforeEach } from "vitest";
import { pickQuestionSource } from "@/lib/questionSource";
import { pickReviewItem } from "@/lib/review";
import { recordSrsAnswer, __resetSelectorState, getFlowBand, resetTopicSrs } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { getUnlockedItemsOf } from "@/lib/unlock";

const NS = "quiz" as const;
const topics = getAllTopics();
const t1 = topics[0];                                        // 1. Harfler
const t2 = topics.find((t) => t.id === "yazilislar")!;        // 2. Yazılışlar

const unlocked2 = ["l2-01-init", "l2-01-med", "l2-01-fin"];

/** 1. konuyu bitmiş say (bakım havuzu dolsun) */
const masterTopic1 = () => {
  for (const it of t1.items.slice(0, 8)) {
    for (let i = 0; i < 4; i++) recordSrsAnswer(NS, t1.id, it.id, true, { responseMs: 1200 });
  }
};

/** Son cevapları yanlışa boğ → "zorlanıyor" bandı */
const makeStruggling = () => {
  for (let i = 0; i < 12; i++) {
    recordSrsAnswer(NS, t2.id, "l2-01-init", false);
  }
};

beforeEach(() => {
  localStorage.clear();
  __resetSelectorState();
  resetTopicSrs(NS, t1.id);
  resetTopicSrs(NS, t2.id);
});

describe("retry açlığı (bildirilen hata)", () => {
  it("yanlış cevaptan sonra harf BİR kez tekrar sorulur", () => {
    const src = pickQuestionSource({
      retryId: "l2-01-med", retryUsed: false,
      unlockedIds: unlocked2, currentTopicId: t2.id, ns: NS,
    });
    expect(src).toEqual({ kind: "retry", itemId: "l2-01-med" });
  });

  it("tekrar da yanlışsa AYNI harf bir daha zorlanmaz (kilitlenme yok)", () => {
    for (let k = 0; k < 30; k++) {
      const src = pickQuestionSource({
        retryId: "l2-01-med", retryUsed: true,        // hakkını kullandı
        unlockedIds: unlocked2, currentTopicId: t2.id, ns: NS,
      });
      expect(src.kind).not.toBe("retry");
    }
  });

  it("kilitli/havuzda olmayan harf tekrar sorulmaz", () => {
    const src = pickQuestionSource({
      retryId: "l2-09-med", retryUsed: false,          // açık bölümde değil
      unlockedIds: unlocked2, currentTopicId: t2.id, ns: NS,
    });
    expect(src.kind).not.toBe("retry");
  });
});

describe("zorlanınca kurtarma: önceki konudan soru", () => {
  it("zorlanma bandında bakım sorusu retry'nin ÖNÜNE geçer", () => {
    masterTopic1();
    makeStruggling();
    expect(getFlowBand()).toBe("struggling");

    let review = 0;
    for (let k = 0; k < 200; k++) {
      const src = pickQuestionSource({
        retryId: "l2-01-med", retryUsed: false,   // retry beklemede OLSA BİLE
        unlockedIds: unlocked2, currentTopicId: t2.id, ns: NS,
      });
      if (src.kind === "review") review++;
    }
    // review payı zorlanma bandında %50 → 200 denemede belirgin görülmeli
    expect(review).toBeGreaterThan(60);
  });

  it("bakım sorusu gerçekten ÖNCEKİ konudan gelir", () => {
    masterTopic1();
    makeStruggling();
    const seen = new Set<string>();
    for (let k = 0; k < 200; k++) {
      const src = pickQuestionSource({
        retryId: null, retryUsed: false,
        unlockedIds: unlocked2, currentTopicId: t2.id, ns: NS,
      });
      if (src.kind === "review") seen.add(src.topicId);
    }
    expect(seen.size).toBeGreaterThan(0);
    for (const id of seen) expect(id).toBe(t1.id);
  });

  it("önceki konu yoksa (1. konudayken) bakım sorusu gelmez", () => {
    for (let k = 0; k < 50; k++) {
      const src = pickQuestionSource({
        retryId: null, retryUsed: false,
        unlockedIds: t1.items.slice(0, 4).map((i) => i.id),
        currentTopicId: t1.id, ns: NS,
      });
      expect(src.kind).toBe("frontier");
    }
  });
});

describe("bakım havuzu KİLİTLİ bölümleri sormaz", () => {
  it("pickReviewItem yalnız AÇIK bölümlerden öğe döndürür", () => {
    masterTopic1();   // ilk 8 harf ustalaşıldı → sonraki bölümler hâlâ kilitli
    const open = new Set(getUnlockedItemsOf(t1).map((i) => i.id));
    // Testin anlamlı olması için kilitli öğe KALMIŞ olmalı
    expect(open.size).toBeLessThan(t1.items.length);

    let picks = 0;
    for (let k = 0; k < 400; k++) {
      const rev = pickReviewItem(t2.id, NS);
      if (!rev) continue;
      picks++;
      expect(open.has(rev.itemId), `kilitli bölümden geldi: ${rev.itemId}`).toBe(true);
    }
    expect(picks).toBeGreaterThan(0);
  });
});
