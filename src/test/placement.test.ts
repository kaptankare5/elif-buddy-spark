// Problem 1 (öğrenme seti kapısı) + Problem 2 (yerleştirme / ara-kontrol)
// davranış testleri. Gerçek modülleri jsdom localStorage'ı ile sürer.
import { describe, it, expect, beforeEach } from "vitest";
import {
  pickNextLetterFromTopic,
  getIntroGateInfo,
  LEARNING_SET_K,
  recordSrsAnswer,
  retrievabilityOf,
  isDue,
  isGraduated,
  SPACING,
  GRADUATED_STEP,
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
import { getUnlockedTopicIds, getUnlockedItemIdSet, isTopicCompleted } from "@/lib/unlock";
import { pickReviewItem } from "@/lib/review";
import { letterNumOf } from "@/lib/confusables";
import { pickDistractors } from "@/lib/confusion";
import { getTopicSrs } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";

const topics = getAllTopics();
const practice = topics.filter((t) => !t.noPractice);
const ids = topics[0].items.map((i) => i.id); // "harfler" harf id'leri

const seenAt = (level: number): TopicSrs[string] => ({
  level: level as 1 | 2 | 3 | 4, correct: 1, total: 1, seen: 1, lastSeen: Date.now(),
});

// ⚠️ ARALIKLI TEKRAR: L4 için ikinci doğru BAŞKA BİR GÜN olmalı (aynı gün
// sayılmaz). Testlerde günü ilerletmek için saati sabitliyoruz.
const gercekNow = Date.now;
const gunde = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };

beforeEach(() => { localStorage.clear(); Date.now = gercekNow; });

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
    // ⚠️ L4 yalnız ÜRETİM kanıtıyla verilir (Flashcard: harfi gör → söyle).
    // Akıcılık kapısını sınamak için üretim kanıtı geçiyoruz.
    const rec = (correct: boolean, ms?: number) =>
      recordSrsAnswer("quiz", "harfler", "l1-05", correct,
        { ...(ms !== undefined ? { responseMs: ms } : {}), evidence: "production" as const });
    // ⚠️ İlk cevap YANLIŞ olmalı: doğru olsaydı hızlı geçiş devreye girip
    // harfi tek cevapta L3'e çıkarırdı ve burada ölçmek istediğimiz ÖĞRENME
    // yolundaki akıcılık kapısı hiç çalışmazdı.
    gunde(300);
    await rec(false, 1000); // öğrenme yoluna gir (L1'de kalır)
    await rec(true, 1000); // L1→L2
    await rec(true, 1000); // L2→L3
    expect(getTopicSrs("quiz", "harfler")["l1-05"].level).toBe(3);
    gunde(302);            // L4 kapısı için ertesi gün
    await rec(true, 9000); // YAVAŞ doğru → L3'te kalır, kırılgan
    const e1 = getTopicSrs("quiz", "harfler")["l1-05"];
    expect(e1.level).toBe(3);
    expect(e1.fragile).toBe(true);
    expect(e1.lastMs).toBe(9000);
    gunde(305);
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

  it("takvim basamakları: AYNI GÜN ilerletmez, ertesi gün ilerletir", async () => {
    // ⚠️ Aralıklı tekrarın çekirdeği. Basamak yalnız FARKLI BİR GÜNDE verilen
    // doğru cevapla ilerler — aynı oturumda üst üste doğru yapmak öğretmez.
    __resetSelectorState();
    const gun = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };

    gun(600); await rec(true);
    expect(entry().step).toBe(1);
    const s1 = entry().stab!;

    await rec(true);                       // AYNI GÜN ikinci doğru
    expect(entry().step, "aynı gün basamak ilerletmez").toBe(1);
    expect(entry().stab).toBe(s1);

    gun(601); await rec(true);             // ertesi gün → 2. basamak
    expect(entry().step).toBe(2);
    expect(entry().stab!).toBeGreaterThan(s1);

    gun(605); await rec(true);             // 3. basamak
    expect(entry().step).toBe(3);

    // Yanlış: basamakta 2 geri (seviyedeki −2 kuralıyla aynı ilke)
    gun(620); await rec(false);
    expect(entry().step).toBe(1);
    Date.now = realNow;
  });

  it("basamak aralıkları takvimi izler (1 → 3 → 7 → 21 … gün)", async () => {
    __resetSelectorState();
    const gun = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };
    const araliklar: number[] = [];
    for (let i = 0; i < SPACING.STEPS_DAYS.length; i++) {
      gun(700 + i * 400);                  // her seferinde başka gün
      await rec(true);
      const e = entry();
      // Hedef hatırlamaya tam basamak sonunda inilmeli:
      // R(t) = 2^(−t/stab) = DESIRED_RETENTION  →  t = basamak aralığı
      const t = SPACING.STEPS_DAYS[i] * SPACING.INTERVAL_SCALE;
      expect(retrievabilityOf(e, Date.now() + t * 86_400_000))
        .toBeCloseTo(SPACING.DESIRED_RETENTION, 4);
      araliklar.push(t);
    }
    expect(araliklar).toEqual([1, 3, 7, 21, 60, 150, 365]);
    Date.now = realNow;
  });

  it("takvimi deviren öğe MEZUN olur, bir daha programa girmez", async () => {
    // Bahrick: 733 kişi 50 yıl — bilgi ilk 3-6 yıl düşüyor, sonra 30 yıl
    // sabit kalıyor ("permastore"). Yılı geçen öğeyi sonsuza kadar sormanın
    // karşılığı yok.
    __resetSelectorState();
    const gun = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };
    for (let i = 0; i <= SPACING.STEPS_DAYS.length; i++) {
      gun(800 + i * 500);
      await rec(true);
    }
    const e = entry();
    expect(e.step).toBeGreaterThanOrEqual(GRADUATED_STEP);
    expect(isGraduated(e)).toBe(true);
    // Yıllar geçse bile vadesi gelmez
    expect(isDue(e, Date.now() + 3 * 365 * 86_400_000)).toBe(false);
    Date.now = realNow;
  });

  it("vadesi gelen öğe KURAYA girmez, doğrudan öne alınır", () => {
    // Eskiden vade yalnız bir bilet çarpanıydı (en fazla ×3) ve kalabalık
    // havuzda unutulmuş öğe kurayı kaybediyordu — "L3+ ama unutmuş" sayısı
    // böyle şişiyordu.
    __resetSelectorState();
    const now = Date.now();
    const taze = (id: string): TopicSrs[string] =>
      ({ level: 4, correct: 5, total: 5, seen: 3, lastSeen: now - 3_600_000, stab: 400, step: 4 });
    const unutulmus: TopicSrs[string] =
      { level: 4, correct: 5, total: 5, seen: 3, lastSeen: now - 90 * 86_400_000, stab: 6.6, step: 2 };
    const topic: TopicSrs = { x: unutulmus };
    const ids2 = ["x"];
    for (let i = 0; i < 25; i++) { const k = `t${i}`; topic[k] = taze(k); ids2.push(k); }

    expect(isDue(topic.x, now)).toBe(true);
    let secildi = 0;
    for (let i = 0; i < 300; i++) {
      __resetSelectorState();
      if (pickNextLetterFromTopic(topic, ids2) === "x") secildi++;
    }
    // 26 öğe arasında kura olsaydı ~%4 çıkardı; vade önceliğiyle çok üstünde.
    expect(secildi / 300).toBeGreaterThan(0.5);
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

// --- HIZLI GEÇİŞ: konuyu bilerek gelen çocuk oyalanmasın (kullanıcı kararı) ---
// İlk karşılaşmada doğru bilinen harf ÖĞRENİLMİYOR, ZATEN BİLİNİYOR sayılır →
// doğrudan L3, ikinci doğruda L4. Eskiden 28 harflik konu için en az 56 doğru
// cevap gerekiyordu; artık 56 yerine 56 değil, harf başına 2 cevap yeter.
describe("hızlı geçiş — ilk karşılaşmada doğru", () => {
  const lvl = (id: string) => getTopicSrs("quiz", "harfler")[id]?.level;

  it("ilk doğru L3, ikinci doğru L4; L5 için AYRI GÜNLERE yayılmış kanıt gerekir", async () => {
    // ⚠️ MERDİVENİN İKİ HIZI VAR (bilerek):
    //   L3→L4 hızlı — üst üste 2 doğru, aynı oturumda olabilir. Çocuk ilerleme
    //   görmeli, yoksa ⭐⭐⭐'te park edip "bir şey olmuyor" hissine kapılıyor.
    //   L4→L5 yavaş — kanıt puanı + en az MIN_DAYS ayrı gün. Ustalık rozeti
    //   ancak burada verilir.
    const uret = () => recordSrsAnswer("quiz", "harfler", "l1-09", true,
      { responseMs: 1200, evidence: "production" as const });
    gunde(400); await uret();
    expect(lvl("l1-09")).toBe(3);
    await uret();
    expect(lvl("l1-09"), "üst üste 2 doğru → L4 (aynı gün olabilir)").toBe(4);
    gunde(402); await uret();
    gunde(405); await uret();
    expect(lvl("l1-09"), "3 puan var ama 3 gün var — MIN_DAYS 5").toBe(4);
    gunde(408); await uret();
    expect(lvl("l1-09"), "4 gün, hâlâ yetmez").toBe(4);
    gunde(411); await uret();
    expect(lvl("l1-09"), "5 ayrı gün üretim kanıtı → L5").toBe(5);
  });

  it("hızlı geçişte SÜRE şartı aranmaz (yavaş ama bilen çocuk cezalanmaz)", async () => {
    // Ölçüm: L3→L4'e akıcılık şartı koyunca bilen ama temkinli çocuğun
    // geçme oranı %99'dan %87'ye düşüyordu. Hızlı geçiş yolunda şart yok.
    for (const g of [410, 412, 415]) {
      gunde(g);
      await recordSrsAnswer("quiz", "harfler", "l1-10", true, { responseMs: 9000, evidence: "production" });
    }
    expect(lvl("l1-10")).toBe(4);
  });

  it("TANIMA kanıtı da L5 verir — ama 2 KAT daha çok GÜN ister", async () => {
    // Kullanıcı itirazı (haklıydı): "sürekli harfe maruz kalırsa, ters yönde
    // de olsa, oyun oynaya oynaya öğrenir — belki 2-3 kat daha çok zaman
    // ister ama öğrenir." Literatür de öyle: tanıma pratiği de üretim
    // bilgisine katkı yapıyor, sadece daha yavaş. O yüzden DUVAR değil KUR:
    // üretim 1 puan, tanıma 1/2 puan, L5 için 3 puan gerekiyor.
    gunde(430);
    await recordSrsAnswer("quiz", "harfler", "l1-15", true, { responseMs: 900 });
    for (const g of [432, 435, 440, 450]) {           // toplam 5 gün = 2.5 puan
      gunde(g);
      await recordSrsAnswer("quiz", "harfler", "l1-15", true, { responseMs: 900 });
    }
    expect(lvl("l1-15"), "5 tanıma günü = 2.5 puan, eşik 3 → henüz değil").toBe(4);
    gunde(460);                                        // 6. gün = 3.0 puan
    await recordSrsAnswer("quiz", "harfler", "l1-15", true, { responseMs: 900 });
    expect(lvl("l1-15"), "6 tanıma gününde L5").toBe(5);
  });

  it("ÜRETİM kanıtı 2 kat hızlı: 5 günde L5 (tanımada 6)", async () => {
    // Üretim puanı 2 katı ama gün TABANI (MIN_DAYS 5) ikisinde de geçerli —
    // 3 puanı 3 günde toplasa bile hafıza izi o kadar tekrarla ayakta durmuyor.
    for (const g of [470, 472, 475, 478]) {
      gunde(g);
      await recordSrsAnswer("quiz", "harfler", "l1-16", true, { responseMs: 900, evidence: "production" });
    }
    expect(lvl("l1-16"), "4 gün — puan yeter, gün yetmez").toBe(4);
    gunde(482);
    await recordSrsAnswer("quiz", "harfler", "l1-16", true, { responseMs: 900, evidence: "production" });
    expect(lvl("l1-16")).toBe(5);
  });

  it("karışık kanıt TOPLANIR: 1 üretim + 4 tanıma = L5", async () => {
    gunde(480);
    await recordSrsAnswer("quiz", "harfler", "l1-17", true, { responseMs: 900, evidence: "production" });
    for (const g of [482, 485, 490]) {
      gunde(g);
      await recordSrsAnswer("quiz", "harfler", "l1-17", true, { responseMs: 900 });
    }
    expect(lvl("l1-17"), "1 + 1.5 = 2.5 → henüz değil").toBe(4);
    gunde(495);
    await recordSrsAnswer("quiz", "harfler", "l1-17", true, { responseMs: 900 });
    expect(lvl("l1-17"), "1 + 2.0 = 3.0 puan ve 5 gün → L5").toBe(5);
  });

  it("ilk karşılaşmada YANLIŞ ise hızlı geçiş yok — normal öğrenme yolu", async () => {
    await recordSrsAnswer("quiz", "harfler", "l1-11", false, { responseMs: 1200 });
    expect(lvl("l1-11")).toBe(1);
    await recordSrsAnswer("quiz", "harfler", "l1-11", true, { responseMs: 1200 });
    expect(lvl("l1-11")).toBe(2);   // L3'e sıçramaz
  });

  it("hızlı geçişle L4 olan harf, sonradan yanlışta -2 ile geri düşer", async () => {
    for (const g of [420, 422, 425]) {
      gunde(g);
      await recordSrsAnswer("quiz", "harfler", "l1-12", true, { responseMs: 1000, evidence: "production" });
    }
    expect(lvl("l1-12")).toBe(4);
    // Şansla geçmişse (4 şıkta iki kez tutturma ihtimali 1/16) emniyet burada.
    await recordSrsAnswer("quiz", "harfler", "l1-12", false, { responseMs: 1000 });
    expect(lvl("l1-12")).toBe(2);
  });
});

// --- YENİ MÜFREDAT: alıştırmasız konu + Flashcard tek-seferde ustalık ---
describe("yeni müfredat kabulleri", () => {
  it("Flashcard beyanı tek oturumda USTALIK (L5) vermez", async () => {
    // Flashcard'da şık yok → şansla tutturma ihtimali 0, o yüzden ilk doğru
    // doğrudan L3, ikincisi L4. Ama USTALIK (L5) için AYRI GÜNLERDE kanıt
    // birikmeli: tek oturumda ustalık vermek öğeyi programdan düşürüp
    // unutulmaya bırakıyordu (ölçüm: yalnız Flashcard oynayan çocukta
    // ⭐ rozetinin %33'ü yalandı — 7 gün sonra hatırlama %50'nin altında).
    const seviye = () => getTopicSrs("quiz", "harfler")["l1-13"].level;
    const kart = () => recordSrsAnswer("quiz", "harfler", "l1-13", true,
      { responseMs: 1500, selfReport: true });
    gunde(500);
    await kart();
    expect(seviye()).toBe(3);
    await kart();
    expect(seviye(), "üst üste 2 doğru → L4").toBe(4);
    for (let i = 0; i < 20; i++) await kart();
    expect(seviye(), "aynı gün 20 kart daha — ustalık YOK").toBe(4);
    for (const g of [502, 505, 508, 511]) { gunde(g); await kart(); }
    expect(seviye(), "5 ayrı gün → L5").toBe(5);
  });

  it("şıklı cevap (selfReport yok) ilk karşılaşmada L3'te kalır", async () => {
    await recordSrsAnswer("quiz", "harfler", "l1-14", true, { responseMs: 1500 });
    expect(getTopicSrs("quiz", "harfler")["l1-14"].level).toBe(3);
  });

  it("'Harflerin Yazılışları' alıştırmasız ve oyun havuzuna girmez", () => {
    const yaz = topics.find((t) => t.id === "yazilislar")!;
    expect(yaz.noPractice).toBe(true);
    expect(isTopicCompleted(yaz)).toBe(true);          // kilit için engel değil
    const havuz = getUnlockedItemIdSet();
    for (const it of yaz.items) expect(havuz.has(it.id)).toBe(false);
  });

  it("alıştırmasız konu sonraki konuyu kilitlemez", () => {
    const i = topics.findIndex((t) => t.id === "yazilislar");
    // 1. konu tamamlanmadan 2. konu zaten kilitli; 2. konu açıldığında
    // alıştırması olmadığı için 3. konu da onunla birlikte açılır.
    for (const it of topics[0].items) {
      localStorage.setItem("elifba-srs-quiz-guest-v1", "{}");
    }
    const state: Record<string, Record<string, unknown>> = { [topics[0].id]: {} };
    for (const it of topics[0].items) {
      state[topics[0].id][it.id] = { level: 4, correct: 2, total: 2, seen: 2, lastSeen: Date.now() };
    }
    localStorage.setItem("elifba-srs-quiz-guest-v1", JSON.stringify(state));
    const acik = getUnlockedTopicIds();
    expect(acik.has(topics[i].id)).toBe(true);
    expect(acik.has(topics[i + 1].id)).toBe(true);     // yazılışlar geçildi
  });
});
