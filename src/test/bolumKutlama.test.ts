/**
 * BÖLÜM KUTLAMASI KAPSAMI — üç bölümlü oyunun da bölüm bitişinde kutlama
 * çağırdığını kilitler.
 *
 * ⚠️ NEDEN TEST: bu kusur ölçülerek bulundu — Macera, Parti ve Yarışı'nın
 * bölüm bitişinde çalan tek ses `playFeedback(true)` idi, yani BİR SORUYU
 * doğru bilmekle BİR BÖLÜMÜ bitirmek kulakta AYNI şeydi. Kullanıcı istedi:
 * "bir bölümü bitirirse alkış sesi falan olsun".
 *
 * ⚠️ Test İMPORT değil ÇAĞRI arar. `kalicilik.test.ts`'te bire bir bu hata
 * yaşanmıştı: Kutu Boşalt'ta `useOyunSonu` import EDİLMİŞ ama hiç
 * ÇAĞRILMAMIŞTI (ölü import; eslint yakalamıyor).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const oku = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const OYUNLAR: [string, string][] = [
  ["Macera", "src/pages/games/PlatformGame.tsx"],
  ["Parti", "src/pages/games/PartyGame.tsx"],
  ["Yarışı", "src/pages/games/KartGame.tsx"],
];

describe("bölüm bitiş kutlaması", () => {
  it.each(OYUNLAR)("%s bölüm bitince kutlamayı ÇAĞIRIYOR", (_ad, yol) => {
    const src = oku(yol);
    expect(/useBolumKutlama\s*\(/.test(src), "ortak kutlama kancası kurulmamış").toBe(true);
    // ⚠️ Ayraç ÇAĞRIYI arar, argümanın şeklini DEĞİL: Macera kutlamayı
    // kazanma animasyonundan sonra `kutlaRef.current(kutlamaBekleyen)` ile
    // açıyor; nesne değişmezi bekleyen dar bir ayraç onu "çağrı yok" sayardı.
    expect(/kutlaRef\.current\s*\(/.test(src), "kutlama hiç ÇAĞRILMIYOR (ölü import)").toBe(true);
    expect(/\{kutlamaKatmani\}/.test(src), "kutlama katmanı çizilmiyor").toBe(true);
  });

  /**
   * ⚠️ "YENİ AÇILDI" BİLGİSİ, AÇMADAN ÖNCE ÖLÇÜLMELİ. `unlockLevel`'dan
   * sonra sorulursa yanıt hep "zaten açıktı" olur ve kilit haberi HİÇ
   * verilmez; bölümü ikinci kez oynayanda da yanlışlıkla haber verilmez.
   */
  it.each(OYUNLAR)("%s kilit durumunu açmadan ÖNCE okuyor", (_ad, yol) => {
    const src = oku(yol);
    const i = src.indexOf("const oncekiAcik");
    expect(i, "önceki kilit durumu okunmuyor").toBeGreaterThan(0);
    const j = src.indexOf("unlockLevel(", i) >= 0
      ? src.indexOf("unlockLevel(", i)
      : src.indexOf("unlockTrack(", i);
    expect(j, "kilit açma çağrısı bulunamadı").toBeGreaterThan(0);
    expect(j, "kilit durumu AÇTIKTAN SONRA okunuyor — haber hiç verilmez").toBeGreaterThan(i);
  });

  /** Kutlama sesi gerçekten yeni ses türlerini kullanmalı, "doğru cevap" dingi değil. */
  it("ortak katman kutlama + kilit seslerini kullanıyor", () => {
    const src = oku("src/pages/games/_bolumKutlama.tsx");
    expect(/kilitSesi=\{/.test(src), "kilit sesi bağlanmamış").toBe(true);
    const juice = oku("src/lib/juice.ts");
    expect(/case "kutlama"/.test(juice), "kutlama sesi tanımlı değil").toBe(true);
    expect(/case "kilit"/.test(juice), "kilit sesi tanımlı değil").toBe(true);
  });

  /**
   * ⚠️ ALKIŞ YOK — gerekçe juice.ts'te yazılı (kayıt yok, sentetiği parazit
   * gibi, alkış kalabalık sesi = "kıyas yok" ilkesine aykırı). Biri gelip
   * "alkış ekleyelim" derse bu test hatırlatsın.
   */
  it("alkış gerekçesi belgelenmiş", () => {
    const juice = oku("src/lib/juice.ts");
    expect(/NEDEN ALKIŞ DEĞİL/.test(juice), "alkış kararının gerekçesi kayıtlı değil").toBe(true);
  });
});
