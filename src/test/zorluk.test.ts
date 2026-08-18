// ZORLUK RAMPASI — "oyunlar hep aynı hızda" regresyonu.
import { describe, it, expect, beforeEach } from "vitest";
import { rampa, setZorluk, sikSayisiIcin, zorlukAyari, ZORLUKLAR } from "@/lib/zorluk";

beforeEach(() => localStorage.clear());

describe("zorluk", () => {
  it("varsayılan KOLAY", () => {
    expect(zorlukAyari().ad).toBe("Kolay");
  });

  it("rampa doğru sayısıyla artar ve tavanda durur", () => {
    setZorluk("kolay");
    const a = ZORLUKLAR.kolay;
    expect(rampa(0)).toBeCloseTo(a.baslangic, 6);
    expect(rampa(a.tavanDogru)).toBeCloseTo(a.tavan, 6);
    expect(rampa(a.tavanDogru * 5), "tavanı aşmamalı").toBeCloseTo(a.tavan, 6);
    expect(rampa(5)).toBeGreaterThan(rampa(0));
    expect(rampa(20)).toBeGreaterThan(rampa(5));
  });

  it("karekök eğrisi: ilk doğrularda fark HEMEN hissedilir", () => {
    setZorluk("orta");
    const a = ZORLUKLAR.orta;
    const yol = (n: number) => (rampa(n) - a.baslangic) / (a.tavan - a.baslangic);
    // yolun dörtte birinde artışın YARISI tamamlanmış olmalı (doğrusalda 1/4 olurdu)
    expect(yol(a.tavanDogru / 4)).toBeCloseTo(0.5, 2);
  });

  it("her zorluk bandı bir öncekinden hızlı", () => {
    expect(ZORLUKLAR.kolay.baslangic).toBeLessThan(ZORLUKLAR.orta.baslangic);
    expect(ZORLUKLAR.orta.baslangic).toBeLessThan(ZORLUKLAR.zor.baslangic);
    expect(ZORLUKLAR.kolay.tavan).toBeLessThan(ZORLUKLAR.zor.tavan);
    expect(ZORLUKLAR.kolay.tavanDogru).toBeGreaterThan(ZORLUKLAR.zor.tavanDogru);
  });

  it("⚠️ az şık YALNIZ öğrenme bölgesinde — L3+ harfte en az 3 şık", () => {
    setZorluk("kolay");
    expect(sikSayisiIcin(1, 4), "L1: kolaylık geçerli").toBe(2);
    expect(sikSayisiIcin(2, 4), "L2: kolaylık geçerli").toBe(2);
    expect(sikSayisiIcin(3, 4), "L3: ölçüm bölgesi, şık düşmez").toBe(3);
    expect(sikSayisiIcin(5, 4), "L5: ölçüm bölgesi").toBe(3);
  });

  it("şık sayısı oyunun tavanını aşmaz (şimşek 2 şıklıysa Zor'da da 2)", () => {
    setZorluk("zor");
    expect(sikSayisiIcin(1, 2)).toBe(2);
    expect(sikSayisiIcin(4, 2)).toBe(2);
  });
});
