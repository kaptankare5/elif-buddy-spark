/**
 * UYARLANIR ÇÖZÜNÜRLÜK BEKÇİSİ.
 *
 * ⚠️ İKİ HATA ÖLÇÜLEREK BULUNDU, ikisi de aynı yöne bakıyordu: uyarlama tam
 * da EN ÇOK gereken (en yavaş) cihazda çalışmıyordu.
 *   1) Pencere KARE sayıyordu → 10 fps'lik cihaz ilk düzeltmeyi 15 sn sonra
 *      alıyordu (60 fps'lik cihaz 2.5 sn sonra).
 *   2) "Sekme arkaplanda" koruması dt > 0.2 sn'yi eliyordu → 5 fps altındaki
 *      HER kare atılıyor, uyarlama hiç devreye girmiyordu. Ölçüldü: Yarışı
 *      4-5 fps'te canvas 824×1760'ta ÇAKILI kalıyordu.
 */
import { describe, it, expect } from "vitest";
import { createResSampler } from "@/pages/games/_perf";

/** `sn` saniye boyunca `fps` hızında kare besler, uygulanan oranları döndürür. */
function kosu(fps: number, sn: number, min = 1, max = 2): number[] {
  const oranlar: number[] = [];
  const s = createResSampler((r) => oranlar.push(r), min, max);
  const dt = 1 / fps;
  for (let t = 0; t < sn; t += dt) s.sample(dt);
  return oranlar;
}

describe("uyarlanır çözünürlük", () => {
  it("YAVAŞ cihazda çözünürlüğü düşürür", () => {
    const o = kosu(20, 10);          // 20 fps = 50 ms, SLOW_MS 22'nin çok üstü
    expect(o[o.length - 1]).toBeLessThan(o[0]);
  });

  it("ÇOK yavaş cihazda (4 fps) da düşürür — eski dt eşiği burada eliyordu", () => {
    const o = kosu(4, 12);
    expect(o[o.length - 1], "4 fps'te uyarlama hiç devreye girmiyor").toBeLessThan(o[0]);
    expect(o[o.length - 1]).toBe(1);  // tabana kadar iner
  });

  it("HIZLI cihazda tavanda kalır", () => {
    const o = kosu(120, 10);          // 8.3 ms — FAST_MS 13'ün altında
    expect(o[o.length - 1]).toBe(2);
  });

  it("ilk düzeltme cihaz hızından BAĞIMSIZ sürede gelir", () => {
    // ⚠️ 60 fps (16.7 ms) SINANMAZ: FAST_MS 13 ile SLOW_MS 22 arasındaki ÖLÜ
    // BANTTA, orada düzeltme yapılmaması doğru davranış (salınımı önler).
    // Sınanan şey: KASAN her cihazda düzeltme ~1.6 sn içinde gelmeli. Kare
    // sayan eski kuralda 10 fps'te 15 sn, 5 fps'te 30 sn sürüyordu.
    for (const fps of [20, 15, 10, 5, 4]) {
      const o = kosu(fps, 2.2);
      expect(o.length, `${fps} fps'te 2.2 sn içinde düzeltme gelmedi`).toBeGreaterThan(1);
    }
  });

  it("ölü bantta (60 fps) boş yere oynatmaz", () => {
    expect(kosu(60, 10).length).toBe(1);   // yalnız başlangıç değeri
  });

  it("taban ve tavan aşılmaz", () => {
    expect(Math.min(...kosu(3, 20, 1, 2))).toBeGreaterThanOrEqual(1);
    expect(Math.max(...kosu(200, 20, 1, 2))).toBeLessThanOrEqual(2);
  });
});
