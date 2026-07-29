// KARIŞIKLIK MOTORU testleri — "çocuk neyi neyle karıştırıyor" sinyali.
//
// Kullanıcı senaryosu: Elif (ا) ile Lem (ل) karıştırılıyorsa bu ikisi
// test/oyun/flashcard'da daha SIK, üstelik BİRLİKTE gelmeli; çocuk ayrımı
// üst üste yapınca da sıklık normale dönmeli.
import { describe, it, expect, beforeEach } from "vitest";
import {
  heatBetween, itemHeat, pickContrastId, pickDistractors,
  recordConfusionPick, recordDiscrimination, recordMiss,
  resetConfusion, __resetConfusionCache,
} from "@/lib/confusion";
import { baseConfusable, formOf, letterNumOf } from "@/lib/confusables";
import { getAllTopics } from "@/data/subjects";
import { pickNextLetterFromTopic, __resetSelectorState, type TopicSrs } from "@/data/srs";
import type { ContentItem } from "@/data/types";

const topics = getAllTopics();
const harfler = topics.find((t) => t.id === "harfler")!.items;       // l1-01..l1-28
const yazilislar = topics.find((t) => t.id === "yazilislar")!.items; // l2-NN-init|med|fin

const ELIF = "l1-01", LEM = "l1-23", BE = "l1-02";

beforeEach(() => {
  localStorage.clear();
  __resetConfusionCache();
  resetConfusion();
});

describe("statik bilgi (confusables)", () => {
  it("Elif ile Lem a-priori karışandır", () => {
    expect(baseConfusable(ELIF, LEM)).toBe(true);
  });

  it("AYNI harfin başta/ortada/sonda hâlleri de karışan sayılır", () => {
    expect(baseConfusable("l2-05-init", "l2-05-med")).toBe(true);
    expect(baseConfusable("l2-05-init", "l2-05-init")).toBe(false);
    expect(formOf("l2-05-fin")).toBe("fin");
    expect(formOf("l1-05")).toBeNull();
  });

  it("alakasız harfler karışan değildir", () => {
    expect(baseConfusable(ELIF, BE)).toBe(false);
  });
});

describe("ısı: ölçüm ve sönümlenme", () => {
  it("yanlış seçim çiftin ısısını yükseltir", () => {
    expect(heatBetween(ELIF, LEM)).toBe(0);
    recordConfusionPick(ELIF, LEM);
    expect(heatBetween(ELIF, LEM)).toBeGreaterThan(0.3);
  });

  it("harf ısısı BÜTÜN hâllere/harekelere taşınır (Elif↔Lem → sondaki hâli de)", () => {
    recordConfusionPick(ELIF, LEM);
    // l2-01-fin = Elif'in sondaki hâli, l3-23-fetha = Lem üstün
    expect(itemHeat("l2-01-fin")).toBeGreaterThan(0.3);
    expect(itemHeat("l3-23-fetha")).toBeGreaterThan(0.3);
    expect(itemHeat("l1-02")).toBe(0); // Be etkilenmez
  });

  it("form karışıklığı yalnız O harfin hâlleri arasında kalır", () => {
    recordConfusionPick("l2-05-init", "l2-05-med");
    expect(heatBetween("l2-05-init", "l2-05-med")).toBeGreaterThan(0.3);
    expect(heatBetween("l2-06-init", "l2-06-med")).toBe(0);
  });

  it("üst üste 3 doğru ayrım ısıyı düşürür (karışıklığı yapmayana kadar)", () => {
    recordConfusionPick(ELIF, LEM);
    const start = heatBetween(ELIF, LEM);
    recordDiscrimination(ELIF, [LEM]);
    recordDiscrimination(ELIF, [LEM]);
    expect(heatBetween(ELIF, LEM)).toBeCloseTo(start, 5); // 2 yeterli değil
    recordDiscrimination(ELIF, [LEM]);
    expect(heatBetween(ELIF, LEM)).toBeLessThan(start);
  });

  it("yeterince ayrım yapılınca ısı tamamen söner", () => {
    recordConfusionPick(ELIF, LEM);
    for (let i = 0; i < 9; i++) recordDiscrimination(ELIF, [LEM]);
    expect(heatBetween(ELIF, LEM)).toBe(0);
  });

  it("seçim bilinmiyorsa a-priori partnerlere hafif ısı dağılır", () => {
    recordMiss(ELIF);
    expect(heatBetween(ELIF, LEM)).toBeGreaterThan(0);
    expect(heatBetween(ELIF, BE)).toBe(0); // karışan değil → dokunulmaz
  });
});

describe("seçim: çeldirici ve ardışıklık", () => {
  it("ısınmış partner çeldirici olarak İLK sırada gelir", () => {
    recordConfusionPick(ELIF, LEM);
    const elif = harfler.find((i) => i.id === ELIF)!;
    for (let k = 0; k < 20; k++) {
      const wrongs = pickDistractors(harfler, elif, 3);
      expect(wrongs[0].id).toBe(LEM);
    }
  });

  it("ısı yokken bile a-priori karışanlar rastgeleye tercih edilir", () => {
    const be = harfler.find((i) => i.id === BE)!;
    const conf = [3, 4, 25, 28];
    for (let k = 0; k < 20; k++) {
      const wrongs = pickDistractors(harfler, be, 3);
      expect(wrongs.every((w) => conf.includes(letterNumOf(w.id)!))).toBe(true);
    }
  });

  it("başta/ortada/sonda konusunda AYNI harfin öbür hâlleri çeldirici olur", () => {
    const target = yazilislar.find((i) => i.id === "l2-05-init")!;
    const ids = new Set<string>();
    for (let k = 0; k < 40; k++) {
      for (const w of pickDistractors(yazilislar, target, 3)) ids.add(w.id);
    }
    expect(ids.has("l2-05-med")).toBe(true);
    expect(ids.has("l2-05-fin")).toBe(true);
  });

  it("flashcard ardışıklığı: ısınmış partner bir sonraki kart olur", () => {
    recordConfusionPick(ELIF, LEM);
    const ids = harfler.map((i) => i.id);
    let hit = 0;
    for (let k = 0; k < 200; k++) if (pickContrastId(ELIF, ids, 0) === LEM) hit++;
    expect(hit).toBeGreaterThan(60);   // ~%50+ — sık ama her seferinde değil
    expect(hit).toBeLessThan(200);
  });

  it("zincir sınırına gelince karşıtlık durur (çocuk döngüde sıkışmasın)", () => {
    recordConfusionPick(ELIF, LEM);
    const ids = harfler.map((i) => i.id);
    expect(pickContrastId(ELIF, ids, 3)).toBeNull();
  });

  it("soğuk çiftte ardışıklık tetiklenmez", () => {
    const ids = harfler.map((i) => i.id);
    for (let k = 0; k < 50; k++) expect(pickContrastId(ELIF, ids, 0)).toBeNull();
  });

  it("havuz çeldirici sayısı kadar veya azsa hepsini döndürür", () => {
    const small: ContentItem[] = harfler.slice(0, 3);
    expect(pickDistractors(small, small[0], 3)).toHaveLength(2);
  });
});

// --- SIKLIK: karıştırılan harf gerçekten daha sık mı geliyor? ---
// Kullanıcının asıl istediği bu: "elif ile lam karıştırılıyorsa ona göre sık
// belirsin". Bilet çarpanı iddiasını sayarak doğrula.
//
// Not: seçici, adayları görülme/tazelik sırasına dizip yalnız EN TAZE YARIDAN
// çekiliş yapar. Bu yüzden mutlak sayı değil, aynı yarıdaki iki harfin
// BİRBİRİNE oranı ölçülür (Elif ile Be — ikisi de dilimin içinde).
describe("SRS seçimi: karışan harf daha sık gelir", () => {
  const ids = harfler.slice(0, 4).map((i) => i.id); // l1-01..l1-04

  const makeSrs = (): TopicSrs => {
    const now = Date.now() - 3 * 86_400_000; // hepsi 3 gün önce görülmüş
    const s: TopicSrs = {};
    for (const id of ids) {
      s[id] = { level: 2, correct: 3, total: 4, seen: 4, lastSeen: now, totalMs: 4000 };
    }
    return s;
  };

  const ratio = (runs = 3000) => {
    const srs = makeSrs();
    const tally: Record<string, number> = {};
    for (let i = 0; i < runs; i++) {
      __resetSelectorState();
      const id = pickNextLetterFromTopic(srs, ids);
      tally[id] = (tally[id] ?? 0) + 1;
    }
    return (tally[ELIF] ?? 0) / Math.max(1, tally[BE] ?? 0);
  };

  it("ısı yokken Elif ile Be eşit sıklıkta gelir", () => {
    const r = ratio();
    expect(r).toBeGreaterThan(0.8);
    expect(r).toBeLessThan(1.25);
  });

  it("Elif↔Lem karıştırılınca Elif belirgin biçimde daha sık seçilir", () => {
    recordConfusionPick(ELIF, LEM);
    expect(ratio()).toBeGreaterThan(1.3);
  });

  it("ayrım öğrenilince sıklık normale döner", () => {
    recordConfusionPick(ELIF, LEM);
    const hot = ratio();
    for (let i = 0; i < 9; i++) recordDiscrimination(ELIF, [LEM]);
    const cooled = ratio();
    expect(cooled).toBeLessThan(hot);
    expect(cooled).toBeLessThan(1.25);
  });
});
