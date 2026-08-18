// ŞIK SAYISI ↔ ÖLÇÜM — "2 şıkta %50 şansla doğru yapıyor" regresyonu.
//
// Merdivenin bütün gerekçeleri 4 şıka göre yazılmıştı ("4 şıkta iki kez
// şansla tutturma 1/16"). Oysa şimşek modu 2, tabela modu 3 şık gösteriyor;
// Kolay zorlukta da şık azalıyor. O modlarda ilk karşılaşmada YAZI TURA ile
// L3'e çıkılabiliyordu. Bu dosya üç korumayı kilitler:
//   1) hızlı geçiş (ilk doğru → L3) yalnız 4+ şıkta
//   2) L3→L4 mandalı az şıkta 3 üst üste doğru ister (4 şıkta 2)
//   3) ustalık puanı şans oranıyla ölçeklenir (2 şık = 4 şıkın yarısı)
import { describe, it, expect, beforeEach } from "vitest";
import { clearRecentAsked, recordGameAnswer } from "@/lib/gameProgress";
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

/** n şıklı bir doğru cevap (şıklar: hedef + havuzdan doldurma). */
function dogruCevap(it: { id: string }, n: number) {
  const sik = [it.id, ...pool.filter((p) => p.id !== it.id).slice(0, n - 1).map((p) => p.id)];
  recordGameAnswer(pool.find((p) => p.id === it.id), true, {
    gameId: "party", chosenId: it.id, shownIds: sik,
  });
}
const seviye = (id: string) => getTopicSrs("quiz", t1.id)[id]?.level;
const puan = (id: string) => getTopicSrs("quiz", t1.id)[id]?.mastery ?? 0;

describe("şık sayısı ölçümü korur", () => {
  it("4 şıkta ilk doğru hızlı geçişle L3 yapar (mevcut davranış)", () => {
    const it0 = pool[0];
    dogruCevap(it0, 4);
    expect(seviye(it0.id)).toBe(3);
  });

  it("2 şıkta ilk doğru L3 YAPMAZ — yazı tura ile kestirme kapalı", () => {
    const it0 = pool[0];
    dogruCevap(it0, 2);
    expect(seviye(it0.id), "2 şıkta hızlı geçiş olmamalı").toBe(2);
  });

  it("3 şıkta da hızlı geçiş kapalı (tabela modu)", () => {
    const it0 = pool[0];
    dogruCevap(it0, 3);
    expect(seviye(it0.id)).toBe(2);
  });

  it("şansla L4'e çıkma olasılığı her modda 1/16'nın altında kalır", () => {
    const az = pool[0], cok = pool[1];
    // 2 şık: hızlı geçiş yok → L1→L2→L3, L4 için toplam 4 üst üste doğru
    dogruCevap(az, 2); expect(seviye(az.id)).toBe(2);
    dogruCevap(az, 2); expect(seviye(az.id)).toBe(3);
    dogruCevap(az, 2);
    expect(seviye(az.id), "3 doğru yetmemeli (1/8 fazla kolay)").toBe(3);
    dogruCevap(az, 2);
    expect(seviye(az.id), "4. doğruda L4 (1/16)").toBe(4);
    // 4 şık: hızlı geçişle L3, iki doğruda L4
    dogruCevap(cok, 4);
    expect(seviye(cok.id)).toBe(3);
    dogruCevap(cok, 4);
    expect(seviye(cok.id)).toBe(4);
  });

  it("2 şıklı doğru cevap 4 şıklının YARISI kadar ustalık puanı verir", () => {
    const a = pool[0], b = pool[1];
    dogruCevap(a, 4);
    dogruCevap(b, 2);
    expect(puan(a.id)).toBeGreaterThan(0);
    expect(puan(b.id)).toBeCloseTo(puan(a.id) / 2, 6);
  });

  it("şık sayısı bilinmiyorsa eski davranış sürer (4 şık varsayımı)", () => {
    const it0 = pool[0];
    // shownIds tek elemanlı → güvenilir sayım yok
    recordGameAnswer(it0, true, { gameId: "party", chosenId: it0.id, shownIds: [it0.id] });
    expect(seviye(it0.id)).toBe(3);
  });
});
