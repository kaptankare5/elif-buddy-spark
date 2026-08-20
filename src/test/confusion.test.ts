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
import { hotPairInSection } from "@/lib/unlock";
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
  it("Elif YALNIZ Lem'in başta/ortada hâliyle karışır (kullanıcı kararı)", () => {
    // Elif sola bağlanmaz → her hâlinde düz dikey çizgi. Lem'in BAŞTA (لـ) ve
    // ORTADA (ـلـ) hâlleri de düz çizgi → karışır. SONDA (ـل) ve YALIN (ل)
    // hâlinde derin çanak var → karışmaz, çeldirici olarak da gelmemeli.
    expect(baseConfusable("l2-01-init", "l2-23-init")).toBe(true);
    expect(baseConfusable("l2-01-med", "l2-23-med")).toBe(true);
    expect(baseConfusable("l2-01-fin", "l2-23-fin")).toBe(false);
    expect(baseConfusable(ELIF, LEM)).toBe(false);   // ikisi de yalın
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

  // Soru sesle sorulduğu için (Dinle → hangisi?) aynı sesi çalan iki öğe
  // asla birlikte şıkka giremez: sorunun iki doğru cevabı olurdu.
  it("AYNI SESLİ öğe çeldirici olmaz — Fe'nin başka hâli şıklara girmez", () => {
    const target = yazilislar.find((i) => i.id === "l2-20-med")!;   // Fe ortada
    for (let k = 0; k < 40; k++) {
      const w = pickDistractors(yazilislar, target, 3).map((x) => x.id);
      expect(w).not.toContain("l2-20-init");
      expect(w).not.toContain("l2-20-fin");
      // yine de karışan HARFLER geliyor (Gaf — Fe ile aynı öbekte)
      expect(w.some((id) => id.startsWith("l2-21-"))).toBe(true);
    }
  });

  it("konular karışık havuzda da aynı ses ayıklanır (l1 Fe ↔ l2 Fe)", () => {
    const mixed = [...harfler, ...yazilislar];
    const target = mixed.find((i) => i.id === "l2-20-med")!;
    for (let k = 0; k < 40; k++) {
      for (const w of pickDistractors(mixed, target, 3)) {
        expect(w.audio).not.toBe(target.audio);
      }
    }
  });

  it("ısınmış partner bile olsa aynı sesliyse şıkka girmez", () => {
    recordConfusionPick("l2-20-med", "l2-20-init");   // form karışıklığı ölçüldü
    const target = yazilislar.find((i) => i.id === "l2-20-med")!;
    for (let k = 0; k < 30; k++) {
      const w = pickDistractors(yazilislar, target, 3).map((x) => x.id);
      expect(w).not.toContain("l2-20-init");
    }
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

// --- BÖLÜMLEME: aile gruplaması YALNIZ 2. konuda; ayrım şartlı kilit ---
describe("bölümler ve kilit", () => {
  const yaz = topics.find((t) => t.id === "yazilislar")!;

  const sectionMap = (items: typeof harfler) => {
    const m = new Map<number, string>();
    for (const it of items) {
      const n = letterNumOf(it.id);
      if (n != null && !m.has(n)) m.set(n, it.section!);
    }
    return m;
  };

  // confusables.ts'teki 12 karışma öbeği
  const FAMILIES = [
    [2, 3, 4, 25, 28], [5, 6, 7], [8, 9], [10, 11], [12, 13], [14, 15],
    [16, 17], [18, 19], [20, 21], [1, 23], [22, 23], [24, 27],
  ];

  // Bölüm = karışan harflerin bir arada durduğu KÜÇÜK grup. Bir harf burada
  // ÜÇ yeni öğe (başta/ortada/sonda) demek, o yüzden gruplar küçük tutulur.
  it("2. konuda bölümdeki harfler birbiriyle karışabilir (kopuk grup yok)", () => {
    const secOf = sectionMap(yaz.items);
    const bySec = new Map<string, number[]>();
    for (const [n, sec] of secOf) bySec.set(sec, [...(bySec.get(sec) ?? []), n]);
    for (const [sec, letters] of bySec) {
      if (letters.length < 2) continue;
      // Grup, karışabilirlik grafiğinde BAĞLI olmalı: her harfin gruptan
      // en az bir karıştığı komşusu bulunmalı.
      for (const n of letters) {
        // ⚠️ Bu KONU başta/ortada/sonda hâllerini öğretiyor; bağlantı da o
        // hâller üzerinden aranmalı. Yalın (l1-) id'leriyle bakmak yanıltıcı:
        // Elif ile Lem yalın hâlde karışmaz (Lem'in çanağı belli), ama
        // BAŞTA/ORTADA hâllerinde karışır — bölümü bir arada tutan da bu.
        const FORMS = ["init", "med", "fin"] as const;
        const id = (x: number, f: string) => `l2-${String(x).padStart(2, "0")}-${f}`;
        const linked = letters.some((m) => m !== n && FORMS.some((fa) =>
          FORMS.some((fb) => baseConfusable(id(n, fa), id(m, fb)))));
        expect(linked, `${sec}: ${n} numaralı harf gruptaki hiçbir harfle karışmıyor`).toBe(true);
      }
    }
  });

  it("2. konu bölümleri EN FAZLA 3 harf (harf başına 3 yeni şekil)", () => {
    const secOf = sectionMap(yaz.items);
    const count = new Map<string, number>();
    for (const sec of secOf.values()) count.set(sec, (count.get(sec) ?? 0) + 1);
    for (const [sec, n] of count) {
      expect(n, `${sec} = ${n} harf = ${n * 3} yeni şekil`).toBeLessThanOrEqual(3);
    }
    expect([...count.values()].reduce((a, b) => a + b, 0)).toBe(28);
  });

  it("DİĞER konular geleneksel 4'erli bölümlemeyi korur (elif be te se…)", () => {
    const secOf = sectionMap(harfler);
    expect(secOf.get(1)).toBe("1. Bölüm");   // Elif
    expect(secOf.get(4)).toBe("1. Bölüm");   // Se — ilk dörtlü
    expect(secOf.get(5)).toBe("2. Bölüm");   // Cim
    expect(secOf.get(23)).toBe("6. Bölüm");  // Lem — Elif'le AYNI bölümde DEĞİL
    expect(secOf.get(28)).toBe("7. Bölüm");  // Ye
  });

  it("bölüm adları sade ('N. Bölüm'), aile etiketi yok", () => {
    for (const it of [...harfler, ...yaz.items]) {
      expect(it.section).toMatch(/^\d+\. Bölüm$/);
    }
  });

  it("bölüm içi karışıklık sıcakken bölüm ustalaşmış sayılmaz", () => {
    const sec1 = yaz.items.filter((it) => it.section === yaz.items[0].section);
    expect(hotPairInSection(sec1)).toBeNull();
    recordConfusionPick("l2-01-init", "l2-23-init"); // 0.34 — tek hata kapıyı kapatmaz
    expect(hotPairInSection(sec1)).toBeNull();
    recordConfusionPick("l2-01-init", "l2-23-init"); // 0.68 — ısrarlı → kapı kapanır
    expect(hotPairInSection(sec1)).not.toBeNull();
  });

  it("üst üste 3 doğru ayrımdan sonra kapı yeniden açılır (kilitlenip kalmaz)", () => {
    const sec1 = yaz.items.filter((it) => it.section === yaz.items[0].section);
    recordConfusionPick("l2-01-init", "l2-23-init");
    recordConfusionPick("l2-01-init", "l2-23-init");
    expect(hotPairInSection(sec1)).not.toBeNull();
    for (let i = 0; i < 3; i++) recordDiscrimination("l2-01-init", ["l2-23-init"]);
    expect(hotPairInSection(sec1)).toBeNull();
  });
});
