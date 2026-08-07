// OYUN KAPILARI — "verileri sildim, oyunlar sürekli Elif soruyor" regresyonu.
//
// Bildirilen davranış: taze (silinmiş) ilerlemeyle Elifbâ Partisi/Yarışı'na
// girince bütün kapılar aynı harfi soruyordu.
// Sebebi: her iki oyun da bölüm/yarış KURULURKEN bütün kapılara birden soru
// dağıtıyordu. Aralarında hiç cevap kaydedilmediği için SRS durumu hiç
// değişmiyor, pickNextGameItem de her çağrıda müfredatın ilk görülmemiş
// harfini (Elif) döndürüyordu.
// Düzeltme: kapı sorusu SIRASI GELİNCE (armGate) dağıtılır — yani bir önceki
// cevap SRS'e işlendikten sonra.
import { describe, it, expect, beforeEach } from "vitest";
import { clearRecentAsked, pickNextGameItem, recordGameAnswer, showHintFor } from "@/lib/gameProgress";
import { __resetSelectorState, getTopicSrs, resetTopicSrs } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { setGameMode, FREE_PLAY_MIN_SEEN } from "@/lib/gameMode";
import { canPlayFreeMode, freePlaySeenCount, gamePool } from "@/pages/games/_shared";

const topics = getAllTopics();
const t1 = topics[0];
const pool = t1.items.slice(0, 12);

beforeEach(() => {
  localStorage.clear();
  __resetSelectorState();
  clearRecentAsked();
  resetTopicSrs("quiz", t1.id);
  setGameMode("super");
});

describe("oyun kapılarına soru dağıtımı", () => {
  it("cevap kaydedilmeden art arda seçilse bile harf tekrarlanmaz", () => {
    // Seçici SRS durumuna bakar; cevap yazılmazsa (normal mod) durum hiç
    // değişmez ve eskiden hep aynı harf dönüyordu. `_recentAsked` tamponu
    // seçimi SRS'ten bağımsız ilerletir.
    const hepsi = Array.from({ length: 6 }, () => pickNextGameItem(pool)!.id);
    expect(new Set(hepsi).size).toBeGreaterThan(2);
    for (let i = 1; i < hepsi.length; i++) expect(hepsi[i]).not.toBe(hepsi[i - 1]);
  });

  it("her kapı cevaplandıktan sonra seçilirse harfler değişir", () => {
    const secilen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const it = pickNextGameItem(pool)!;
      secilen.push(it.id);
      // oyunda kapıdan geçince olan şey
      recordGameAnswer(it, true, { gameId: "party", chosenId: it.id, shownIds: [it.id] });
    }
    // Taze başlangıçta ilk harf Elif olmalı (müfredat sırası korunur)…
    expect(secilen[0]).toBe(pool[0].id);
    // …ama sonrası tek harfte kilitlenmemeli.
    expect(new Set(secilen).size).toBeGreaterThan(2);
    // Aynı harf art arda iki kapıda gelmemeli.
    for (let i = 1; i < secilen.length; i++) {
      expect(secilen[i]).not.toBe(secilen[i - 1]);
    }
  });

  // NORMAL MOD KALDIRILDI (kullanıcı kararı) — tek mod var: Süper Öğrenme.
  // Eski iki test ("normal modda seviye değişmez", "normal modda sorular
  // ilerler") artık anlamsız; yerlerine tek modun garantisi geldi.
  it("mod seçimi yok: her oyun cevabı seviyeye işler", () => {
    const it0 = pool[0];
    recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
    const srs = getTopicSrs("quiz", t1.id);
    expect(srs[it0.id]?.seen).toBe(1);
  });

  // HIZLI GEÇİŞ: ilk karşılaşmada doğru → doğrudan L3, ikinci doğru → L4.
  // Konuyu bilerek gelen çocuk harf başına 2 cevapta bitirir.
  it("OYUN da USTALIK (L5) verir — ama 6 farklı GÜN ister (üretimde 5)", () => {
    // Duvar değil KUR: oyunda çocuk şıktan seçiyor (şansla %25, üstelik
    // eleyerek de bulunur) ve yön ters — kitap "harfi gör → söyle" der.
    // Ama maruz kalma da öğretir, sadece daha yavaş: tanıma 1/2 puan,
    // üretim 1 puan, L5 için 3 puan.
    const gercekNow = Date.now;
    try {
      const gun = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };
      const it0 = pool[0];
      const cevap = () => recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
      const lvl = () => getTopicSrs("quiz", t1.id)[it0.id]?.level;
      gun(900); cevap();
      expect(lvl(), "ilk karşılaşma → L3").toBe(3);
      cevap();
      expect(lvl(), "üst üste 2 doğru → L4 (aynı gün olabilir)").toBe(4);
      for (const g of [902, 905, 910, 920]) { gun(g); cevap(); }
      expect(lvl(), "5 oyun günü = 2.5 puan, henüz yetmez").toBe(4);
      gun(930); cevap();
      expect(lvl(), "6 oyun gününde L5").toBe(5);
    } finally { Date.now = gercekNow; }
  });

  it("aynı gün ne kadar oynanırsa oynansın ustalık puanı artmaz", () => {
    const gercekNow = Date.now;
    try {
      Date.now = () => 950 * 86_400_000 + 3_600_000;
      const it0 = pool[0];
      for (let i = 0; i < 20; i++) {
        recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
      }
      const e = getTopicSrs("quiz", t1.id)[it0.id]!;
      expect(e.level, "L4'e çıkar (2 üst üste doğru) ama ustalık VERMEZ").toBe(4);
      expect(e.mastery).toBeCloseTo(1 / 2, 5);   // 20 cevap ama TEK gün
    } finally { Date.now = gercekNow; }
  });

  // İPUCU HALKASI hızlı geçişin bekçisi: ilk karşılaşmada parlarsa çocuk
  // harfi tanımadan doğru basar ve bilmediği harf L3 olur.
  it("ilk karşılaşmada ipucu halkası YANMAZ, yanlıştan sonra yanar", () => {
    const it0 = pool[0];
    expect(showHintFor(it0)).toBe(false);            // hiç görülmemiş
    recordGameAnswer(it0, false, { gameId: "party", chosenId: pool[1].id, shownIds: [it0.id, pool[1].id] });
    // yanlış → seviye 1'de kaldı ama artık görüldü → ipucu devreye girer
    expect(getTopicSrs("quiz", t1.id)[it0.id]?.level).toBe(1);
    expect(showHintFor(it0)).toBe(true);
  });

  it("oyun cevabı seviyeye işler", () => {
    const it = pool[0];
    recordGameAnswer(it, true, { gameId: "party", chosenId: it.id, shownIds: [it.id] });
    // Görüldüğü için seçici artık ikinci harfe geçebilmeli.
    expect(pickNextGameItem(pool)!.id).not.toBe(it.id);
  });
});

// SERBEST OYUN (normal mod) HAVUZU — ipucu halkası orada hep açık olduğu
// için harfin İLK karşılaşması serbest oyunda yaşanmamalı; yoksa çocuk
// harfi tanımadan ipucuna basar ve "zaten biliyormuş" ölçümü çöker.
describe("serbest oyun havuzu yalnız görülmüş harfler", () => {
  it("taze ilerlemede serbest oyun havuzu BOŞ, süper mod havuzu dolu", () => {
    setGameMode("super");
    expect(gamePool().length).toBeGreaterThan(0);
    setGameMode("normal");
    expect(gamePool()).toHaveLength(0);
  });

  it("görülen harfler serbest oyun havuzuna girer, görülmeyenler girmez", () => {
    setGameMode("super");
    const gorulen = gamePool().slice(0, 3);
    for (const it of gorulen) {
      recordGameAnswer(it, true, { gameId: "party", chosenId: it.id, shownIds: [it.id] });
    }
    setGameMode("normal");
    const serbest = gamePool().map((i) => i.id);
    expect(serbest.sort()).toEqual(gorulen.map((i) => i.id).sort());
  });

  it("serbest oyun kilidi FREE_PLAY_MIN_SEEN görülmüş harfe kadar kapalı", () => {
    // Taze ilerlemede yalnız 1. bölüm açık (4 harf). Eşiği sınamak için tüm
    // bölümleri açan test kilidini kullanıyoruz — gerçek çocukta serbest oyun
    // 2. bölüm açıldıktan sonra (8 harf görülünce) devreye girer.
    localStorage.setItem("elifba-test-unlock-v1", "1");
    setGameMode("super");
    const hepsi = gamePool();
    expect(hepsi.length).toBeGreaterThan(FREE_PLAY_MIN_SEEN);
    expect(canPlayFreeMode()).toBe(false);
    for (const it of hepsi.slice(0, FREE_PLAY_MIN_SEEN - 1)) {
      recordGameAnswer(it, true, { gameId: "party", chosenId: it.id, shownIds: [it.id] });
    }
    expect(freePlaySeenCount()).toBe(FREE_PLAY_MIN_SEEN - 1);
    expect(canPlayFreeMode()).toBe(false);          // 1 eksik → hâlâ kapalı
    const son = hepsi[FREE_PLAY_MIN_SEEN - 1];
    recordGameAnswer(son, true, { gameId: "party", chosenId: son.id, shownIds: [son.id] });
    expect(canPlayFreeMode()).toBe(true);           // eşiğe varınca açılır
  });

  it("serbest oyunda verilen cevap seviyeyi DEĞİŞTİRMEZ (sadece eğlence)", () => {
    setGameMode("super");
    const it0 = gamePool()[0];
    recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
    const once = getTopicSrs("quiz", t1.id)[it0.id]!.level;
    setGameMode("normal");
    for (let i = 0; i < 5; i++) {
      recordGameAnswer(it0, false, { gameId: "party", chosenId: "l1-99", shownIds: [it0.id] });
    }
    expect(getTopicSrs("quiz", t1.id)[it0.id]!.level).toBe(once);
  });
});
