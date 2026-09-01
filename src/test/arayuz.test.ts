/**
 * ARAYÜZ DENETİMİ — rota taramasında GÖZLE bulunan, sonra ÖLÇÜLEREK
 * doğrulanan iki gerçek kusurun bekçisi.
 *
 * ⚠️ Taramada dört şey şüpheli görünmüştü; ikisi ölçünce YANLIŞ ALARM çıktı:
 *  · Ana sayfada Arapça başlık ile "Elifbâ" yazısı çakışıyor sanmıştım —
 *    ölçüldü: kutular y=80..158 ve y=162..202, ARALARINDA 4 px var, çakışma
 *    yok. Ekran görüntüsünden göz kararı verdiğim için yanılmışım.
 *  · Bahçe'deki konu rozetleri küçük görünüyordu — hiçbir kutuda taşma yok,
 *    tasarım öyle.
 * Kalan ikisi gerçekti ve buradaki testler onları kilitliyor.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const oku = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/**
 * ⚠️ YORUMLARI AT: bu dosyadaki notlar eski İngilizce metinleri ALINTILIYOR.
 * Ham kaynakta arayan test kendi belgelendirmesine takılıyordu (ilk yazışta
 * tam olarak bu oldu) — ölçülen şey EKRANA ÇIKAN metin olmalı.
 */
const kod = (p: string) =>
  oku(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("404 sayfası", () => {
  const src = kod("src/pages/NotFound.tsx");

  /**
   * ⚠️ GERÇEK KUSUR: sayfa şablondan geldiği gibi kalmıştı — başlık/açıklama
   * Türkçeydi ama EKRANDAKİ yazı İngilizceydi. Kullanıcı 5-8 yaşında bir
   * çocuk ve ebeveyni; eski bir yer imine (ya da kaldırılan İki Yol
   * Koşusu'nun adresine) tıklayınca gördükleri tek ekran burasıydı.
   */
  it("ekrandaki metin Türkçe", () => {
    for (const ing of ["Oops! Page not found", "Return to Home", "Page not found"]) {
      expect(src.includes(ing), `İngilizce şablon metni duruyor: "${ing}"`).toBe(false);
    }
    expect(/Ana sayfaya dön/.test(src), "Türkçe dönüş bağlantısı yok").toBe(true);
  });

  /** Çıkış yolu tek bir alt çizgili bağlantıydı — çocuk için dokunma hedefi zor. */
  it("dönüş bağlantısı büyük bir dokunma hedefi", () => {
    expect(/<Link[\s\S]{0,400}px-7 py-3\.5/.test(src), "dönüş düğmesi küçük").toBe(true);
  });

  it("çıkış yolu var", () => {
    expect(/to="\/"/.test(src), "ana sayfa bağlantısı yok").toBe(true);
  });
});

describe("Macera bölüm seçme paneli", () => {
  const src = kod("src/pages/games/PlatformGame.tsx");

  /**
   * ⚠️ GERÇEK KUSUR, ÖLÇÜLDÜ: kutu 230 px, içerik 261 px → 31 px taşıyor ve
   * kap `overflow-hidden` olduğu için alttaki talimat satırı KALICI olarak
   * kesiliyordu; kaydırma da yoktu, yani çocuk onu hiçbir şekilde okuyamıyordu.
   * Metin kısaltılıp dolgu daraltılınca taşma 0'a indi (yeniden ölçüldü).
   */
  it("panel kaydırılabilir — içerik hiçbir ekranda erişilemez kalmaz", () => {
    const i = src.indexOf("{!started && !gameOver && !won && (");
    expect(i, "bölüm seçme ekranı bulunamadı").toBeGreaterThan(-1);
    const blok = src.slice(i, i + 1600);
    // Yalnız PANELİN KENDİ sınıf dizgisine bak: içerideki düğmeler de
    // `justify-center` kullanıyor, blokta arama yapmak yanıltıyor.
    const kap = blok.match(/<div className="absolute inset-0 z-30([^"]*)"/);
    expect(kap, "panel kabı bulunamadı").not.toBeNull();
    expect(/overflow-y-auto/.test(kap![1]), "panel hâlâ overflow-hidden ile kırpıyor").toBe(true);
    /**
     * ⚠️ `justify-center` + kaydırma BİRLİKTE kullanılınca içeriğin ÜSTÜ
     * erişilemez hâle gelir (bilinen tuzak). Ortalama `m-auto` ile yapılır:
     * yer varken ortalar, taşınca üstten düzgün kaydırılır.
     */
    expect(/justify-center/.test(kap![1]), "kaydırılabilir kapta justify-center kullanılmış").toBe(false);
    expect(/m-auto/.test(blok), "iç blok m-auto ile ortalanmıyor").toBe(true);
  });
});
