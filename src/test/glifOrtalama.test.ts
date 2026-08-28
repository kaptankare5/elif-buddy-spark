/**
 * GLİF ORTALAMA BEKÇİSİ — Arapça harf kutusunun/dairesinin DIŞINA taşmamalı.
 *
 * ⚠️ NEDEN TEST: kullanıcı iki kez aynı sınıf hatayı bildirdi —
 * "cim gibi harfler beyaz arka planın tam ortasında değil, aşağıdan dışarı
 * sarkıyor" ve "uzay oyununda ayın, ha gibi harflerin alt kısımları beyaz
 * yuvarlağın dışına çıkıyor". Çözüm `glifOlcu.ts`'te vardı ama ortak
 * bileşen `EmojiView` onu KULLANMIYORDU; her oyun tek tek uygulamak zorunda
 * kalıyordu ve çoğu unutulmuştu.
 *
 * ÖLÇÜM (`tools/perf/glifKutu.mjs` — gerçek Amiri Quran, 56px daire, ekran
 * görüntüsünden piksel sayımı): 34px puntoda 37 glifin **19'u** diskin
 * dışına taşıyordu (en derin 9.6 px, 826 px² mürekkep dışarıda). Mürekkep
 * ortalaması taşmayı 7'ye, punto 30 ile 2'ye indirdi (62 px², yalnız iki
 * glifte ötre işareti üstten 3 px değiyor).
 *
 * ⚠️ Ölçüt DAİRE, kutu değil: ilk ölçümde mürekkebi kutunun sınırlarıyla
 * kıyaslayıp "taşma yok" sonucuna varmıştım — daire alta doğru daraldığı
 * için geniş bir çanak kutunun içinde ama diskin dışında kalabiliyor.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const oku = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("Arapça glif ortalama", () => {
  /** Ortak bileşen mürekkebi ortalamalı — yoksa her oyun tek tek unutuyor. */
  it("EmojiView mürekkep ortalamasını uyguluyor", () => {
    const src = oku("src/components/EmojiView.tsx");
    expect(/glifKaydirmaEm\s*\(/.test(src), "EmojiView glifKaydirmaEm çağırmıyor").toBe(true);
    expect(/translateY\(/.test(src), "kaydırma transform olarak uygulanmıyor").toBe(true);
  });

  /**
   * ⚠️ Daire içindeki glif 12px salınamaz: 56px'lik dairede bu yarıçapın
   * %21'i ve ölçümde glifleri uçta dışarı çıkarıyordu. Daire/kutu içindeki
   * gliflerde kısa salınım (`animate-float-az`) kullanılmalı.
   */
  it.each(["src/pages/games/RunnerGame.tsx"])(
    "%s kutu içindeki glifte KISA salınım kullanıyor",
    (yol) => {
      const src = oku(yol);
      expect(/animate-float-az/.test(src), "kısa salınım kullanılmıyor").toBe(true);
      expect(/animate-float"/.test(src), "12px'lik tam salınım geri gelmiş").toBe(false);
    },
  );

  it("kısa salınım CSS'te tanımlı ve gerçekten kısa", () => {
    const css = oku("src/index.css");
    const m = css.match(/@keyframes float-y-az[^}]*\{[^}]*\}[^}]*\}/);
    expect(m, "float-y-az tanımı yok").not.toBeNull();
    const px = [...(m![0].matchAll(/translateY\((-?\d+)px\)/g))].map((x) => Math.abs(+x[1]));
    expect(Math.max(...px), "salınım 6px'i aşmamalı").toBeLessThanOrEqual(6);
  });

  /** Uzay Savaşı'nın puntosu ölçülen güvenli değerin üstüne çıkmamalı. */
  it("Uzay Savaşı'nda klasik glif puntosu ≤ 30px", () => {
    const src = oku("src/pages/games/RunnerGame.tsx");
    const m = src.match(/fontSize:\s*ask\.yazili\s*\?\s*"(\d+)px"\s*:\s*"(\d+)px"/);
    expect(m, "enemy fontSize bulunamadı").not.toBeNull();
    expect(Number(m![2]), "56px dairede 30px'in üstü taşıyor (ölçüldü)").toBeLessThanOrEqual(30);
  });
});
