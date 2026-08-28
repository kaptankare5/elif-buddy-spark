/**
 * ZORLUK KAPSAMI — "her oyunda zorluk ayarı var" bekçisi.
 *
 * ⚠️ NEDEN TEST: zorluk.ts eklendiğinde 15 oyunun yalnız 6'sı bağlanmıştı,
 * ama Ayarlar'daki düğme her oyunda çalışıyormuş gibi duruyordu. Çocuk Kolay
 * seçip Yarışı'na giriyor, hiçbir şey değişmiyordu. Yeni oyun eklendiğinde
 * bu test unutmayı yakalar.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ZORLUKLAR, rampa, sureIcin, tahtaBoyu, sikSayisiIcin } from "@/lib/zorluk";

const OYUN_DIZINI = join(process.cwd(), "src/pages/games");

/** Zorluk gerektirmeyen dosyalar: yardımcı modüller. */
const YARDIMCI = new Set(["_shared.ts", "_askUI.tsx", "_letterTexture.ts", "_perf.ts"]);

describe("zorluk kapsamı", () => {
  const dosyalar = readdirSync(OYUN_DIZINI)
    .filter((f) => f.endsWith(".tsx") && !YARDIMCI.has(f));

  // ⚠️ Sayı BİLEREK sabit: yeni oyun eklenip zorluğa bağlanmayı unutmak
  // ya da bir oyunu silip kaydını unutmak burada yakalanır.
  // (İki Yol Koşusu kullanıcı isteğiyle kaldırıldı: 15 → 14.)
  it("14 oyun dosyası bulunur", () => {
    expect(dosyalar.length).toBe(14);
  });

  it.each(dosyalar)("%s zorluk ayarını okur", (dosya) => {
    const kaynak = readFileSync(join(OYUN_DIZINI, dosya), "utf8");
    expect(kaynak, `${dosya} @/lib/zorluk'tan hiçbir şey almıyor`)
      .toMatch(/from "@\/lib\/zorluk"/);
  });
});

describe("zorluk kademeleri gerçekten farklı", () => {
  it("hız rampası üç kademede ayrışır", () => {
    const on = (["kolay", "orta", "zor"] as const).map((z) => rampa(10, z));
    expect(on[0]).toBeLessThan(on[1]);
    expect(on[1]).toBeLessThan(on[2]);
  });

  it("süre kolayda uzar, zorda kısalır (hızın TERSİ yönde)", () => {
    expect(sureIcin(60, "kolay")).toBeGreaterThan(60);
    expect(sureIcin(60, "orta")).toBe(60);
    expect(sureIcin(60, "zor")).toBeLessThan(60);
  });

  it("tahta boyu kolayda küçülür, zorda büyür", () => {
    expect(tahtaBoyu(6, 3, 8, "kolay")).toBeLessThan(tahtaBoyu(6, 3, 8, "orta"));
    expect(tahtaBoyu(6, 3, 8, "orta")).toBeLessThan(tahtaBoyu(6, 3, 8, "zor"));
  });

  it("tahta alt sınırı oyunu bozacak kadar küçülmeye izin vermez", () => {
    // 2 çeşitli bir eşleştirme tahtası kendi kendini patlatır.
    expect(tahtaBoyu(3, 3, 6, "kolay")).toBeGreaterThanOrEqual(3);
  });

  it("ÖLÇÜM BÖLGESİ (L3+) kolayda bile sulandırılmaz", () => {
    // srs.ts sansPayi ile birlikte çalışır: az şık = az kanıt. L3+ öğede
    // en az 3 şık şart, yoksa yalan ustalık üretilir.
    for (const z of ["kolay", "orta", "zor"] as const) {
      expect(sikSayisiIcin(3, 4, z)).toBeGreaterThanOrEqual(3);
      expect(sikSayisiIcin(5, 4, z)).toBeGreaterThanOrEqual(3);
    }
  });

  it("kolayda can sayısı en az ortadaki kadar", () => {
    expect(ZORLUKLAR.kolay.can).toBeGreaterThanOrEqual(ZORLUKLAR.orta.can);
  });
});
