/**
 * KAYDIRMA KİLİDİ — oyundan çıkınca sayfa yeniden kaydırılabilmeli.
 *
 * ⚠️ NEDEN TEST (kullanıcı bildirdi): "bazen oyunlar sayfası yukarı aşağı
 * gitmiyor; oyundayken geriye bastım, oyunlar ekranına geldi ama kaydırma
 * çalışmıyordu — sayfayı yenileyince düzeldi."
 *
 * SEBEP: `useLockBodyScroll` üç yerden çağrılıyor ve İÇ İÇE geçiyor —
 * `Game.tsx` (rota sarmalayıcısı) + `PartyGame` + `KartGame`. Her çağrı kendi
 * "önceki değer"ini saklıyordu:
 *   · React ÇOCUK etkilerini ÖNCE çalıştırır → çocuk prev="" saklar ve kilidi
 *     kurar; sonra ebeveyn prev="hidden" saklar.
 *   · Çıkışta yine ÇOCUK önce temizlenir → "" geri yazar (doğru), ardından
 *     EBEVEYN "hidden" geri yazar → KİLİT TAKILI KALIR.
 * Yenilemek düzeltiyordu çünkü yeni belge temiz `body.style` ile geliyor.
 *
 * Çözüm: sayaçlı kilit — ilk giren kurar, SON çıkan geri yükler.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useLockBodyScroll, __resetScrollLock } from "@/hooks/useLockBodyScroll";

const Kilitli = ({ children }: { children?: React.ReactNode }) => {
  useLockBodyScroll();
  return <div>{children}</div>;
};

beforeEach(() => {
  __resetScrollLock();
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  document.body.style.overscrollBehavior = "";
  document.body.style.touchAction = "";
});
afterEach(() => cleanup());

describe("useLockBodyScroll", () => {
  it("tek kullanımda kilitler ve çıkışta serbest bırakır", () => {
    const r = render(<Kilitli />);
    expect(document.body.style.overflow).toBe("hidden");
    r.unmount();
    expect(document.body.style.overflow).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
  });

  /**
   * ⚠️ ASIL HATA BUYDU: iç içe iki kullanım. Sayaç olmadan ebeveynin
   * temizliği "hidden"ı geri yazıyordu.
   */
  it("İÇ İÇE kullanımda da çıkışta kilit ÇÖZÜLÜR", () => {
    const r = render(<Kilitli><Kilitli /></Kilitli>);
    expect(document.body.style.overflow).toBe("hidden");
    r.unmount();
    expect(document.body.style.overflow, "iç içe kullanımda kilit takılı kaldı").toBe("");
    expect(document.body.style.touchAction).toBe("");
    expect(document.body.style.overscrollBehavior).toBe("");
  });

  it("üç kat iç içe (Game + oyun + alt bileşen) da çözülür", () => {
    const r = render(<Kilitli><Kilitli><Kilitli /></Kilitli></Kilitli>);
    expect(document.body.style.overflow).toBe("hidden");
    r.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  /**
   * ⚠️ GERÇEK KIRILMA SIRASI BU (deneyle bulundu — ilk açıklamam yanlıştı).
   * Sayaçsız sürümde:
   *   1. İÇTEKİ önce takılır, prev="" saklar, kilidi kurar.
   *   2. DIŞTAKİ takılır, prev="hidden" saklar (içteki zaten kurmuştu).
   *   3. İçteki TEK BAŞINA kapanır (oyun bileşeni değişir/yeniden kurulur)
   *      → "" geri yazar: OYUN SÜRERKEN kilit çözülür.
   *   4. Dıştaki kapanır → sakladığı "hidden"ı geri yazar: OYUNDAN ÇIKINCA
   *      kilit TAKILI KALIR. Kullanıcının gördüğü tam olarak buydu.
   */
  it("içteki kapanınca dıştaki kilidi SÜRDÜRÜR", () => {
    const { rerender, unmount } = render(<Kilitli><Kilitli /></Kilitli>);
    rerender(<Kilitli />);
    expect(document.body.style.overflow, "oyun sürerken kilit çözüldü").toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  /** Kullanıcının gördüğü son hâl: her şey kapandıktan sonra kilit kalmamalı. */
  it("içteki→dıştaki sırayla kapanınca kilit TAKILI KALMAZ", () => {
    const { rerender, unmount } = render(<Kilitli><Kilitli /></Kilitli>);
    rerender(<Kilitli />);   // oyun bileşeni gitti, rota sarmalayıcısı duruyor
    unmount();               // rota da gitti → /oyunlar sayfası
    expect(document.body.style.overflow, "oyundan çıkınca sayfa kaydırılamıyor").toBe("");
    expect(document.body.style.touchAction).toBe("");
  });

  /** Önceki değer neyse ona dönmeli — körü körüne "" yazmamalı. */
  it("önceki stil değerini geri yükler", () => {
    document.body.style.overflow = "auto";
    const r = render(<Kilitli />);
    expect(document.body.style.overflow).toBe("hidden");
    r.unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
