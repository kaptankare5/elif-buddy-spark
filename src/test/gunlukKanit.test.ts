// GÜNÜN KANITI — "aynı gün bir kez puan" kuralının iki kenarı.
//
// Ustalık puanı (L4→L5) yalnız FARKLI GÜNDE birikir. Bu doğru bir kural ama
// tek başına eksikti: günün hangi cevabının sayılacağını SIRA belirliyordu.
// Çocuk sabah Şimşek'te (2 şık, ¼ puan) doğru yapıp öğleden sonra
// Flashcard'da harfi ÜRETİRSE (1 puan), gün yine ¼ ile kapanıyordu — daha
// güçlü kanıt sırf sonra geldiği için yok sayılıyordu. Artık gün, o gün
// verilen EN GÜÇLÜ kanıt kadar sayar; zayıf kanıt güçlüyü düşüremez.
import { describe, it, expect, beforeEach } from "vitest";
import { getTopicSrs, recordSrsAnswer, resetTopicSrs, __resetSelectorState, MASTERY } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { resetAudit } from "@/lib/audit";

const topics = getAllTopics();
const t1 = topics[0];
const ID = t1.items[0].id;

const realNow = Date.now;
/** Sabit bir güne demirle — "aynı gün" kuralı gerçek saate bağlı. */
const gunde = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };
const puan = () => getTopicSrs("quiz", t1.id)[ID]?.mastery ?? 0;

beforeEach(() => {
  localStorage.clear();
  resetAudit();
  __resetSelectorState();
  resetTopicSrs("quiz", t1.id);
  Date.now = realNow;
});

describe("günün EN İYİ kanıtı sayılır", () => {
  it("zayıf kanıttan sonra gelen güçlü kanıt günü yükseltir", async () => {
    gunde(900);
    // 2 şıklı oyun cevabı: tanıma × şans payı = 0.5 × 0.5
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, optionCount: 2 });
    expect(puan()).toBeCloseTo(0.25, 6);
    // AYNI GÜN Flashcard'da üretim: gün 1 puana yükselmeli (fark eklenir)
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, evidence: "production" });
    expect(puan(), "güçlü kanıt sonra geldi diye yok sayılmamalı").toBeCloseTo(1, 6);
  });

  it("güçlü kanıttan sonra gelen zayıf kanıt günü DÜŞÜRMEZ", async () => {
    gunde(901);
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, evidence: "production" });
    expect(puan()).toBeCloseTo(1, 6);
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, optionCount: 2 });
    expect(puan(), "zayıf cevap kazanılan puanı geri almamalı").toBeCloseTo(1, 6);
  });

  it("aynı güç tekrar edilince puan İKİNCİ KEZ verilmez", async () => {
    gunde(902);
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, optionCount: 4 });
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, optionCount: 4 });
    await recordSrsAnswer("quiz", t1.id, ID, true, { responseMs: 900, optionCount: 4 });
    expect(puan(), "aynı gün üst üste doğru ustalık kanıtı değildir").toBeCloseTo(0.5, 6);
  });
});

describe("şık sayısı L4→L5 kapısında da işler", () => {
  /**
   * Kullanıcı sorusu: "2 şıklı oyunlarda L3→L4 için 4 doğru isteniyor;
   * L4→L5'te de var mı?" — var, ama başka bir mekanizmayla: orada eşik
   * ÜST ÜSTE DOĞRU değil KANIT PUANI. Puan şans payıyla ölçeklendiği için
   * 2 şıklı mod aynı ustalığa iki katı GÜNDE ulaşır.
   */
  it("2 şıkla ilerleyen çocuk eşiğe 4 şıkın İKİ KATI günde varır", async () => {
    const dortSik = async (gun: number, id: string) => {
      gunde(gun);
      await recordSrsAnswer("quiz", t1.id, id, true, { responseMs: 900, optionCount: 4 });
    };
    const ikiSik = async (gun: number, id: string) => {
      gunde(gun);
      await recordSrsAnswer("quiz", t1.id, id, true, { responseMs: 900, optionCount: 2 });
    };
    const a = t1.items[1].id, b = t1.items[2].id;
    for (let g = 0; g < 6; g++) await dortSik(910 + g, a);
    for (let g = 0; g < 6; g++) await ikiSik(910 + g, b);
    const pa = getTopicSrs("quiz", t1.id)[a].mastery ?? 0;
    const pb = getTopicSrs("quiz", t1.id)[b].mastery ?? 0;
    expect(pa).toBeGreaterThanOrEqual(MASTERY.NEEDED - MASTERY.EPS);
    expect(pb, "2 şıkta 6 gün yetmemeli").toBeLessThan(MASTERY.NEEDED - MASTERY.EPS);
    for (let g = 6; g < 12; g++) await ikiSik(910 + g, b);
    expect(getTopicSrs("quiz", t1.id)[b].mastery ?? 0)
      .toBeGreaterThanOrEqual(MASTERY.NEEDED - MASTERY.EPS);
  });
});
