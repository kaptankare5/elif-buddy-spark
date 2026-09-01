// BECERİ KATMANI — "soru neyi gösterir" ile "soru neyi ölçer" ayrımı.
//
// Yeni müfredatın çekirdeği: 3. konuda 84 hece sorulur ama ölçülen 3 şeydir
// (üstün/esre/ötre); 4. konuda "şe" sorulur ama ölçülen şın'ın ORTADAKİ
// hâlidir. Bu testler hem yeni davranışı hem de eski konuların HİÇ
// değişmediğini kilitler.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAllTopics } from "@/data/subjects";
import { getTopicSrs, recordSrsAnswer, __resetSelectorState, type Level } from "@/data/srs";
import { isTopicCompleted, getUnlockedSections, practiceItems } from "@/lib/unlock";
import { skillOf, skillIdsOf, topicSkillIds, itemsForSkill, pickItemForSkill, blameTarget, skillLevel, PREREQ_LEVEL } from "@/lib/skills";
import { pickDistractors, resetConfusion, __resetConfusionCache } from "@/lib/confusion";
import { letterNumOf } from "@/lib/confusables";
import type { ContentItem } from "@/data/types";

const topics = getAllTopics();
const T = (id: string) => topics.find((t) => t.id === id)!;

// ⚠️ ARALIKLI TEKRAR: L4 (ezberledi) için ikinci doğru BAŞKA BİR GÜN olmalı.
// Testlerde günü ilerletmek için saati sabitliyoruz.
const gercekNow = Date.now;
const gunde = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };
afterEach(() => { Date.now = gercekNow; });

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
      await recordSrsAnswer("quiz", topicId, skillId, true,
        { responseMs: 1200, evidence: "production" });
    }
  };

  it("Harekeler 3 beceri, tek oturumda TAMAMLANIR (eskiden 168 cevap)", async () => {
    const t = T("harekeler");
    gunde(100);
    expect(isTopicCompleted(t)).toBe(false);
    for (const sk of topicSkillIds(t)) await cevapla(t.id, sk, 1);
    // Konu tamamlanması L3 ister → tek oturumda, 3 cevapta biter.
    expect(isTopicCompleted(t)).toBe(true);
    const srs = getTopicSrs("quiz", t.id);
    expect(Object.values(srs).every((e) => (e.level as Level) === 3)).toBe(true);
  });

  it("USTALIK (L5) için AYRI GÜNLER gerekir — aynı oturum L4'te durur", async () => {
    const t = T("harekeler");
    gunde(100);
    for (const sk of topicSkillIds(t)) await cevapla(t.id, sk, 3);   // aynı gün 3 doğru
    let srs = getTopicSrs("quiz", t.id);
    // Üst üste 2 doğru L4 verir (merdivenin hızlı yarısı) ama orada durur:
    // aynı oturumda kaç doğru yaparsa yapsın ustalık kanıtı sayılmaz.
    expect(Object.values(srs).every((e) => (e.level as Level) === 4)).toBe(true);
    // Üretim kanıtı 1 puan/gün, eşik 3 puan VE en az 5 ayrı gün.
    for (const g of [103, 110, 118, 127]) {
      gunde(g);
      for (const sk of topicSkillIds(t)) await cevapla(t.id, sk, 1);
    }
    srs = getTopicSrs("quiz", t.id);
    expect(Object.values(srs).every((e) => (e.level as Level) === 5)).toBe(true);
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
    /**
     * ⚠️ ARAYA NUMARASIZ DERS KONUSU GİREBİLİR (Yazılış Hafıza Yöntemi):
     * o bir YÖNTEM dersi, yeni bir harf konusu değil. Numara almıyor ki
     * araya girmesi sonraki dokuz konunun numaralarını — ve testlerde,
     * CLAUDE.md'de onlara yapılan bütün atıfları — kaydırmasın.
     */
    const numarali = topics.map((t) => t.title).filter((b) => /^\d+\./.test(b));
    expect(numarali[2]).toBe("3. Harekeler");
    expect(numarali[3]).toBe("4. Cezm");
    // Numaralı konularda başlıktaki numara ile sıra aynı olmalı.
    numarali.forEach((baslik, i) => {
      expect(Number(baslik.split(".")[0]), baslik).toBe(i + 1);
    });
    // Numarasız olabilmenin şartı: alıştırmasız VE kendi ders sayfası olan
    // bir konu. Yoksa numarasız başlık yalnızca unutulmuş bir numaradır.
    for (const t of topics) {
      if (/^\d+\./.test(t.title)) continue;
      expect(t.noPractice, `${t.title}: numarasız ama alıştırmalı`).toBe(true);
      expect(typeof t.page, `${t.title}: numarasız ama ders sayfası yok`).toBe("string");
    }
  });

  it("Yazılışlar bir DERS konusu — alıştırmasız, bölümleri kilitsiz", () => {
    /**
     * ⚠️ Kullanıcı kararı: "Harflerin Yazılışları"nda alıştırma YOK, o yüzden
     * bölüm kilidi de yok (uyulması imkânsız bir şart olurdu). Şekiller
     * gösterilir ve dinletilir; ölçüm 1. konudaki harf tanımaya dayanır.
     */
    const yaz = T("yazilislar");
    expect(yaz.noPractice).toBe(true);
    expect(isTopicCompleted(yaz)).toBe(false);   // girilmeden bitmez
    // Bütün bölümler açık — kilit orada anlamsız.
    expect(getUnlockedSections(yaz).size).toBe(
      new Set(yaz.items.map((i) => i.section)).size,
    );
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

  it("Şedde dizisi ebbe / ibbe / übbe biçimindedir", () => {
    const sedde = T("sedde");
    const be = ["fetha", "esre", "otre"].map((hareke) =>
      sedde.items.find((i) => i.id === `l5-02-${hareke}`),
    );
    expect(be.map((i) => i?.translit)).toEqual(["ebbe", "ibbe", "übbe"]);
    expect(be.map((i) => i?.emoji)).toEqual(["اَبَّ", "اِبَّ", "اُبَّ"]);
  });
});

// ÇELDİRİCİ KISITI — şıklar yalnız ölçülen eksende farklılaşmalı.
describe("çeldirici kısıtı (distractorKey)", () => {
  const harekeler = T("harekeler");

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

  it("Harekeler konusu 3 şıklı (4. şık başka harf olurdu)", () => {
    expect(harekeler.optionCount).toBe(3);
    expect(T("harfler").optionCount).toBeUndefined();   // varsayılan 4
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
  /**
   * ⚠️ ŞU AN HİÇBİR KONU `prereqSkill` KULLANMIYOR — "4. Harf + Hareke
   * Alıştırması" kullanıcı kararıyla silindi (oyunlar zaten alıştırma).
   * Mekanizma DURUYOR: bir soru başka bir beceriyi bildiğini varsayıyorsa
   * hatanın nereye yazılacağı hâlâ bu kuralla belirleniyor. Test bu yüzden
   * konuya değil, elde kurulmuş bir öğeye bakar.
   */
  const sahte = (pre: string): ContentItem => ({
    id: "l2-13-med",
    label: "şe",
    speech: "şe",
    lang: "ar",
    emoji: "ـشَـ",
    skill: "l2-13-med",
    prereqSkill: pre,
  });

  it("ön koşul ZAYIFSA hata ön koşula yazılır, becerinin kendisine değil", () => {
    // fetha hiç çalışılmamış (L1)
    const b = blameTarget(sahte("hrk-fetha"), "yazilislar");
    expect(b.prereqBlamed).toBe(true);
    expect(b.skillId).toBe("hrk-fetha");
    expect(b.topicId).toBe("harekeler");   // beceri hangi konudaysa oraya
  });

  it("ön koşul L4'teyse hata BECERİNİN KENDİSİNE yazılır", async () => {
    for (const g of [200, 203, 210]) {   // 3 ayrı gün × üretim = 3 puan
      gunde(g);
      await recordSrsAnswer("quiz", "harekeler", "hrk-fetha", true, { responseMs: 900, evidence: "production" });
    }
    expect(skillLevel("hrk-fetha")).toBe(PREREQ_LEVEL);
    const hedef = sahte("hrk-fetha");
    const b = blameTarget(hedef, "yazilislar");
    expect(b.prereqBlamed).toBe(false);
    expect(b.skillId).toBe(skillOf(hedef));
    expect(b.topicId).toBe("yazilislar");
  });

  it("L3 YETMEZ — eşik L4 (biliyor ama tereddütlü sayılmaz)", async () => {
    // tek doğru → L3
    await recordSrsAnswer("quiz", "harekeler", "hrk-esre", true, { responseMs: 900 });
    expect(skillLevel("hrk-esre")).toBe(3);
    expect(blameTarget(sahte("hrk-esre"), "yazilislar").prereqBlamed).toBe(true);
  });

  it("ön koşulu olmayan konuda davranış değişmez", () => {
    const be = T("harfler").items[1];
    const b = blameTarget(be, "harfler");
    expect(b).toMatchObject({ topicId: "harfler", skillId: be.id, prereqBlamed: false });
  });
});
