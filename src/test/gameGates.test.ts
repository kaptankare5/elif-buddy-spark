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
import { setGameMode } from "@/lib/gameMode";

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
  it("ilk karşılaşmada doğru bilen harf doğrudan L3, ikincide L4 olur", () => {
    const it0 = pool[0];
    recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
    expect(getTopicSrs("quiz", t1.id)[it0.id]?.level).toBe(3);
    recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
    expect(getTopicSrs("quiz", t1.id)[it0.id]?.level).toBe(4);
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
