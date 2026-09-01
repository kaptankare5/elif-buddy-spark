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
   * ⚠️ KELEPÇE GERÇEK ÖLÇÜMÜ KESMEMELİ. 0.5 em sınırı "ölçüm bozulursa"
   * konmuştu ama ÖLÇÜLDÜ (Amiri Quran, 28 harf + 8 harekeli dizi): gereken
   * kaydırma −0.815 .. −0.177 em ve **36 glifin 14'ü** kelepçeye takılıyordu —
   * tam da şikâyet edilen derin çanaklılar (ج ح خ 0.285 em · م 0.235 ·
   * ي 0.165 · ع 0.145). Kelepçe doğru ölçümü sessizce kırpıyordu.
   */
  it("kaydırma kelepçesi ölçülen aralığı (0.815 em) kapsıyor", () => {
    const src = oku("src/lib/glifOlcu.ts");
    const m = src.match(/Math\.max\((-?[\d.]+),\s*Math\.min\(([\d.]+),\s*kaydir\)\)/);
    expect(m, "kelepçe ifadesi bulunamadı").not.toBeNull();
    expect(Math.abs(Number(m![1])), "alt kelepçe 0.815 em'i kesiyor").toBeGreaterThanOrEqual(0.9);
    expect(Number(m![2]), "üst kelepçe 0.815 em'i kesiyor").toBeGreaterThanOrEqual(0.9);
  });

  /**
   * ⚠️ FONT GELİNCE YENİDEN ÇİZİLMELİ. Ölçüm fontun yüklü olmasını gerektiriyor;
   * `glifOlcu` font hazır olunca önbelleği atıyordu ama kimse yeniden
   * çizmediği için bileşen YEDEK FONTLA hesaplanmış kaydırmayı ömür boyu
   * taşıyordu (ölçüldü: ح'ye −0.29 em uygulanmış, doğrusu −0.785 em → harf
   * kutunun 31 px altında kalıyordu).
   */
  it("EmojiView font hazır olunca yeniden çiziliyor", () => {
    const olcu = oku("src/lib/glifOlcu.ts");
    expect(/glifOlcumAboneOl/.test(olcu), "abonelik dışa aktarılmamış").toBe(true);
    expect(/_surum\s*\+=\s*1/.test(olcu), "font hazır olunca sürüm artmıyor").toBe(true);
    const src = oku("src/components/EmojiView.tsx");
    expect(/useSyncExternalStore\(\s*glifOlcumAboneOl/.test(src),
      "EmojiView ölçüm sürümüne abone değil").toBe(true);
  });

  /**
   * ⚠️ DENETİM KARTI DA `EmojiView` KULLANIR. Bu kart ortak bileşene
   * geçirilmemişti; kullanıcı ekran görüntüsüyle bildirdi (ح kutunun altından
   * taşıp şıkkın üstüne biniyordu). ÖLÇÜLDÜ (412px ekran): önce ح kutunun
   * 27 px altına taşıyordu, mürekkep merkezi kutu merkezinin 51.5 px altında;
   * sonra taşma yok, sapma −4.6 px (kasıtlı YUKARI_PAY).
   */
  it("Denetim kartı glifi EmojiView ile çiziyor", () => {
    const src = oku("src/components/AuditCard.tsx");
    expect(/<EmojiView\s/.test(src), "AuditCard EmojiView kullanmıyor").toBe(true);
    expect(/font-arabic[^"]*"\s*\)?\s*\}?\s*dir="rtl"/.test(src),
      "glif hâlâ düz metin olarak basılıyor").toBe(false);
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
