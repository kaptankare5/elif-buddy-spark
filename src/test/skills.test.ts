// BECERİ KATMANI — "soru neyi gösterir" ile "soru neyi ölçer" ayrımı.
//
// Yeni müfredatın çekirdeği: 3. konuda 84 hece sorulur ama ölçülen 3 şeydir
// (üstün/esre/ötre); 4. konuda "şe" sorulur ama ölçülen şın'ın ORTADAKİ
// hâlidir. Bu testler hem yeni davranışı hem de eski konuların HİÇ
// değişmediğini kilitler.
import { describe, it, expect, beforeEach } from "vitest";
import { getAllTopics } from "@/data/subjects";
import { getTopicSrs, recordSrsAnswer, __resetSelectorState, type Level } from "@/data/srs";
import { isTopicCompleted, getUnlockedSections, practiceItems } from "@/lib/unlock";
import { skillOf, skillIdsOf, topicSkillIds, itemsForSkill, pickItemForSkill, blameTarget, skillLevel, PREREQ_LEVEL } from "@/lib/skills";
import { pickDistractors, resetConfusion, __resetConfusionCache } from "@/lib/confusion";
import { letterNumOf } from "@/lib/confusables";

const topics = getAllTopics();
const T = (id: string) => topics.find((t) => t.id === id)!;

beforeEach(() => {
  localStorage.clear();
  __resetConfusionCache();
  resetConfusion();
  __resetSelectorState();
});

describe("beceri anahtarı", () => {
  it("skill'i olmayan öğede beceri = öğe id'si (eski davranış korunur)", () => {
    const harfler = T("harfler");
    expect(harfler.items.every((it) => skillOf(it) === it.id)).toBe(true);
    expect(topicSkillIds(harfler)).toHaveLength(harfler.items.length);
  });

  it("3. Harekeler: 84 öğe → 3 beceri (üstün, esre, ötre)", () => {
    const t = T("harekeler");
    expect(t.items.length).toBeGreaterThan(80);
    expect(topicSkillIds(t).sort()).toEqual(["hrk-esre", "hrk-fetha", "hrk-otre"]);
    // Her beceri 28 harfin hepsiyle sorulabilir → çocuk aynı harekeyi
    // her seferinde başka harfle görür.
    expect(itemsForSkill(t.items, "hrk-fetha")).toHaveLength(28);
  });

  it("4. Harf + Hareke: beceri harfin ŞEKLİ (l2-NN-pos), hareke değil", () => {
    const t = T("harf-hareke");
    const sks = topicSkillIds(t);
    expect(sks.length).toBeGreaterThan(20);
    expect(sks.every((s) => /^l2-\d{2}-(init|med|fin)$/.test(s))).toBe(true);
    // Aynı şekil farklı harekelerle sorulabilir (şe/şi/şü → hep şın-ortada)
    const cok = sks.filter((s) => itemsForSkill(t.items, s).length > 1);
    expect(cok.length).toBeGreaterThan(0);
  });

  it("pickItemForSkill yalnız o beceriyi taşıyan öğe döndürür", () => {
    const t = T("harekeler");
    for (let i = 0; i < 20; i++) {
      const it0 = pickItemForSkill(t.items, "hrk-esre")!;
      expect(skillOf(it0)).toBe("hrk-esre");
    }
  });
});

describe("konu tamamlanması BECERİ sayar", () => {
  const cevapla = async (topicId: string, skillId: string, kez: number) => {
    for (let i = 0; i < kez; i++) {
      await recordSrsAnswer("quiz", topicId, skillId, true, { responseMs: 1200 });
    }
  };

  it("Harekeler 3 beceri × 2 doğru = 6 cevapta biter (eskiden 168)", async () => {
    const t = T("harekeler");
    expect(isTopicCompleted(t)).toBe(false);
    for (const sk of topicSkillIds(t)) await cevapla(t.id, sk, 2);
    expect(isTopicCompleted(t)).toBe(true);
    const srs = getTopicSrs("quiz", t.id);
    // hızlı geçiş: ilk doğru L3, ikinci L4
    expect(Object.values(srs).every((e) => (e.level as Level) === 4)).toBe(true);
  });

  it("Harekeler'de ilk bölüm bitince bütün bölümler açılır", async () => {
    const t = T("harekeler");
    const acikOnce = getUnlockedSections(t);
    expect(acikOnce.size).toBe(1);              // başta yalnız 1. bölüm
    for (const sk of topicSkillIds(t)) await cevapla(t.id, sk, 2);
    // Her bölüm aynı 3 beceriyi taşıdığı için hepsi birden açılır —
    // özel kural yok, genelleme doğal olarak çalışıyor.
    expect(getUnlockedSections(t).size).toBeGreaterThan(1);
  });

  it("Harfler konusu ESKİSİ gibi: her harf tek tek gerekiyor", async () => {
    const t = T("harfler");
    const sks = topicSkillIds(t);
    for (const sk of sks.slice(0, sks.length - 1)) await cevapla(t.id, sk, 1);
    expect(isTopicCompleted(t)).toBe(false);     // biri eksikken bitmez
    await cevapla(t.id, sks[sks.length - 1], 1);
    expect(isTopicCompleted(t)).toBe(true);
  });
});

describe("müfredat bütünlüğü", () => {
  it("konu sırası ve numaraları tutarlı", () => {
    const sirali = topics.map((t) => t.title);
    expect(sirali[2]).toBe("3. Harekeler");
    expect(sirali[3]).toBe("4. Harf + Hareke Alıştırması");
    expect(sirali[4]).toBe("5. Cezm");
    // Başlıktaki numara ile dizideki sıra aynı olmalı
    sirali.forEach((baslik, i) => {
      const n = Number(baslik.split(".")[0]);
      expect(n, baslik).toBe(i + 1);
    });
  });

  it("Yazılışlar alıştırmasız, Harf+Hareke onun yerini alıyor", () => {
    expect(T("yazilislar").noPractice).toBe(true);
    // Yazılışlar'ın ölçülemeyen şekilleri, 4. konuda beceri olarak ölçülüyor.
    const formSkills = new Set(topicSkillIds(T("harf-hareke")));
    const yazForms = T("yazilislar").items.map((i) => i.id);
    const kesisim = yazForms.filter((id) => formSkills.has(id));
    expect(kesisim.length).toBeGreaterThan(20);
  });

  it("her öğenin becerisi ya kendisi ya da tanımlı bir anahtar", () => {
    for (const t of topics) {
      for (const it of t.items) {
        expect(typeof skillOf(it)).toBe("string");
        expect(skillOf(it).length).toBeGreaterThan(0);
      }
      // skillIdsOf sıralamayı korur ve tekrar etmez
      const sks = skillIdsOf(t.items);
      expect(new Set(sks).size).toBe(sks.length);
    }
  });
});

// ÇELDİRİCİ KISITI — şıklar yalnız ölçülen eksende farklılaşmalı.
describe("çeldirici kısıtı (distractorKey)", () => {
  const harekeler = T("harekeler");
  const harfHareke = T("harf-hareke");

  it("Harekeler'de şıklar AYNI HARF, farklı hareke", () => {
    // Ölçülen hareke; farklı harf koyulsaydı çocuk harften tanır, harekeye
    // hiç bakmazdı — soru ölçmek istediğini ölçmezdi.
    for (const hedef of harekeler.items.slice(0, 20)) {
      // Konu 3 şıklı → 2 çeldirici. Kısıt sessizce düşmemeli.
      const wrongs = pickDistractors(harekeler.items, hedef, 2);
      expect(wrongs).toHaveLength(2);
      for (const w of wrongs) {
        expect(w.distractorKey, `${hedef.id} → ${w.id}`).toBe(hedef.distractorKey);
        expect(letterNumOf(w.id)).toBe(letterNumOf(hedef.id));   // aynı harf
        expect(w.id).not.toBe(hedef.id);
      }
    }
  });

  it("Harf+Hareke'de şıklar AYNI HAREKELİ, farklı harf/şekil", () => {
    // Ölçülen harfin şekli; harekeler karışsaydı çocuk sesteki ünlüden eler.
    for (const hedef of harfHareke.items.slice(0, 20)) {
      const wrongs = pickDistractors(harfHareke.items, hedef, 3);
      expect(wrongs.length).toBeGreaterThan(0);
      for (const w of wrongs) {
        expect(w.distractorKey, `${hedef.id} → ${w.id}`).toBe(hedef.distractorKey);
      }
    }
  });

  it("Harekeler konusu 3 şıklı (4. şık başka harf olurdu)", () => {
    expect(harekeler.optionCount).toBe(3);
    expect(harfHareke.optionCount).toBeUndefined();   // varsayılan 4
  });

  it("kısıt 3 çeldirici istense bile düşmez, ŞIK AZ OLUR", () => {
    // Eski hata: aday sayısı istenenden azsa kısıt düşüp havuzun tamamına
    // açılıyor, şıklara başka harfler giriyordu.
    const hedef = harekeler.items[0];
    const wrongs = pickDistractors(harekeler.items, hedef, 3);
    expect(wrongs.length).toBeLessThanOrEqual(2);
    expect(wrongs.every((w) => w.distractorKey === hedef.distractorKey)).toBe(true);
  });

  it("kısıtı olmayan konuda (Harfler) davranış eskisi gibi", () => {
    const harfler = T("harfler");
    const be = harfler.items.find((i) => i.id === "l1-02")!;
    expect(be.distractorKey).toBeUndefined();
    const wrongs = pickDistractors(harfler.items, be, 3);
    expect(wrongs).toHaveLength(3);
    expect(wrongs.every((w) => w.id !== be.id)).toBe(true);
  });
});

// ÖĞRETME ÖRNEKLEMİ + ÖN KOŞUL — yeni müfredatın son iki kuralı.
describe("öğretme örneklemi (practice: false)", () => {
  it("Şedde/Med/Tenvin'de yalnız 4 harf sorulur, gerisi görülür", () => {
    for (const id of ["sedde", "med", "tenvin"]) {
      const t = T(id);
      const sorulan = practiceItems(t.items);
      expect(sorulan.length, id).toBeLessThan(t.items.length);
      // Çekirdek örneklem 4 harf (× 3 hareke) + Ekstralar
      const cekirdek = sorulan.filter((i) => i.section !== "Ekstralar");
      const harfler = new Set(cekirdek.map((i) => i.id.split("-")[1]));
      expect(harfler.size, id).toBe(4);
      // Sorulmayan öğeler konu sayfasında DURUYOR (silinmedi)
      expect(t.items.length).toBeGreaterThan(80);
    }
  });

  it("Cezm İSTİSNA: bütün harfler sorulur (yeni alfabe gibi)", () => {
    const t = T("cezm");
    expect(practiceItems(t.items)).toHaveLength(t.items.length);
  });

  it("Ekstralar L4'te bile diğerlerinden daha sık sorulur (bilet ağırlığı)", () => {
    for (const id of ["cezm", "sedde", "med", "tenvin"]) {
      const t = T(id);
      const ekstra = t.items.filter((i) => i.section === "Ekstralar");
      const cekirdek = t.items.filter((i) => i.section !== "Ekstralar");
      expect(ekstra.length, id).toBeGreaterThan(0);
      const enAzEkstra = Math.min(...ekstra.map((i) => i.weight ?? 3));
      const enCokCekirdek = Math.max(...cekirdek.map((i) => i.weight ?? 3));
      expect(enAzEkstra, id).toBeGreaterThan(enCokCekirdek);
    }
  });
});

describe("ön koşul (prereqSkill) — yanlış teşhis koymayalım", () => {
  const t4 = () => T("harf-hareke");

  it("4. konudaki her soru bir hareke ön koşulu taşır", () => {
    for (const it0 of t4().items) {
      expect(it0.prereqSkill, it0.id).toMatch(/^hrk-(fetha|esre|otre)$/);
    }
  });

  it("hareke ZAYIFSA hata harekeye yazılır, şekle değil", () => {
    const hedef = t4().items.find((i) => i.prereqSkill === "hrk-fetha")!;
    // fetha hiç çalışılmamış (L1)
    const b = blameTarget(hedef, "harf-hareke");
    expect(b.prereqBlamed).toBe(true);
    expect(b.skillId).toBe("hrk-fetha");
    expect(b.topicId).toBe("harekeler");
  });

  it("hareke L4'teyse hata ŞEKLE yazılır", async () => {
    await recordSrsAnswer("quiz", "harekeler", "hrk-fetha", true, { responseMs: 900 });
    await recordSrsAnswer("quiz", "harekeler", "hrk-fetha", true, { responseMs: 900 });
    expect(skillLevel("hrk-fetha")).toBe(PREREQ_LEVEL);
    const hedef = t4().items.find((i) => i.prereqSkill === "hrk-fetha")!;
    const b = blameTarget(hedef, "harf-hareke");
    expect(b.prereqBlamed).toBe(false);
    expect(b.skillId).toBe(skillOf(hedef));
    expect(b.topicId).toBe("harf-hareke");
  });

  it("L3 YETMEZ — eşik L4 (biliyor ama tereddütlü sayılmaz)", async () => {
    // tek doğru → L3
    await recordSrsAnswer("quiz", "harekeler", "hrk-esre", true, { responseMs: 900 });
    expect(skillLevel("hrk-esre")).toBe(3);
    const hedef = t4().items.find((i) => i.prereqSkill === "hrk-esre")!;
    expect(blameTarget(hedef, "harf-hareke").prereqBlamed).toBe(true);
  });

  it("ön koşulu olmayan konuda davranış değişmez", () => {
    const be = T("harfler").items[1];
    const b = blameTarget(be, "harfler");
    expect(b).toMatchObject({ topicId: "harfler", skillId: be.id, prereqBlamed: false });
  });
});
