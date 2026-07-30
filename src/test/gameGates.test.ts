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
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { __resetSelectorState, resetTopicSrs } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { setGameMode } from "@/lib/gameMode";

const topics = getAllTopics();
const t1 = topics[0];
const pool = t1.items.slice(0, 12);

beforeEach(() => {
  localStorage.clear();
  __resetSelectorState();
  resetTopicSrs("quiz", t1.id);
  setGameMode("super");
});

describe("oyun kapılarına soru dağıtımı", () => {
  it("HATALI DESEN: hepsi bir anda seçilirse aynı harf tekrarlanır", () => {
    // Bu, düzeltme öncesi davranışın kaydı: cevap kaydedilmeden art arda
    // seçim yapılırsa seçici ilerleyemez. Test bunu "yapılmaması gereken"
    // olarak sabitler; oyunlar artık bu deseni kullanmıyor.
    const hepsi = Array.from({ length: 6 }, () => pickNextGameItem(pool)!.id);
    expect(new Set(hepsi).size).toBe(1);
  });

  it("DOĞRU DESEN: her kapı cevaplandıktan sonra seçilirse harfler değişir", () => {
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

  it("normal modda oyun cevabı seviyeyi DEĞİŞTİRMEZ (arada-test mekaniği kaldırıldı)", () => {
    setGameMode("normal");
    const it = pool[0];
    // Eskiden her 3. cevap SRS'e yazılıyordu; 9 cevapta 3 kez ilerlerdi.
    for (let i = 0; i < 9; i++) {
      recordGameAnswer(it, true, { gameId: "party", chosenId: it.id, shownIds: [it.id] });
    }
    // Hiç yazılmadıysa öğe hâlâ "görülmemiş" → seçici onu ilk harf olarak verir.
    expect(pickNextGameItem(pool)!.id).toBe(pool[0].id);
  });

  it("süper modda oyun cevabı seviyeye işler", () => {
    setGameMode("super");
    const it = pool[0];
    recordGameAnswer(it, true, { gameId: "party", chosenId: it.id, shownIds: [it.id] });
    // Görüldüğü için seçici artık ikinci harfe geçebilmeli.
    expect(pickNextGameItem(pool)!.id).not.toBe(it.id);
  });
});
