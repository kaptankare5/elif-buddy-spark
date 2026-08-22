import { useEffect } from "react";

/**
 * Oyun ekranlarında sayfa kaydırmayı kilitler — mobilde tam ekran hissi.
 *
 * ⚠️ **SAYAÇLI (ref-counted) OLMAK ZORUNDA.** Kanca üç yerden çağrılıyor ve
 * İÇ İÇE geçiyor: `Game.tsx` (rota sarmalayıcısı) + `PartyGame` + `KartGame`.
 * Her çağrı kendi "önceki değer"ini saklayınca kırılma sırası şöyleydi
 * (tahmin değil — `kaydirmaKilidi.test.tsx` ile deneyle bulundu):
 *   1. İÇTEKİ (oyun) önce takılır, prev="" saklar, kilidi kurar.
 *   2. DIŞTAKİ (Game.tsx) takılır, prev="hidden" saklar — içteki zaten kurdu.
 *   3. İçteki TEK BAŞINA kapanır → "" geri yazar: OYUN SÜRERKEN kilit çözülür.
 *   4. Dıştaki kapanır → sakladığı **"hidden"**ı geri yazar: OYUNDAN ÇIKINCA
 *      kilit TAKILI KALIR.
 * Kullanıcının gördüğü buydu: "oyundan geriye bastım, oyunlar ekranı yukarı
 * aşağı gitmiyordu; sayfayı yenileyince düzeldi" (yenilemek düzeltiyor çünkü
 * yeni belge temiz `body.style` ile geliyor).
 *
 * Sayaçla: ilk giren kilidi kurar ve gerçek önceki değeri saklar, SON çıkan
 * geri yükler. Rota geçişinde sayaç 1→2→1 gidip 0'a inmediği için yeni oyun
 * ekranında kilit kesintisiz kalır; oyun DIŞINA çıkınca 0'a inip çözülür.
 * StrictMode'un çift çalıştırması da (1→0→1) doğru sonuç verir.
 */
let _sayac = 0;
let _onceki: { bo: string; ho: string; ob: string; ta: string } | null = null;

export function useLockBodyScroll() {
  useEffect(() => {
    const b = document.body;
    const h = document.documentElement;
    _sayac++;
    if (_sayac === 1) {
      _onceki = {
        bo: b.style.overflow,
        ho: h.style.overflow,
        ob: b.style.overscrollBehavior,
        ta: b.style.touchAction,
      };
      b.style.overflow = "hidden";
      h.style.overflow = "hidden";
      b.style.overscrollBehavior = "none";
      // Yatay swipe (Yılan vb.) için izinli kalsın; yalnız varsayılan
      // kaydırma engellensin.
      b.style.touchAction = "none";
    }
    return () => {
      _sayac = Math.max(0, _sayac - 1);
      if (_sayac === 0 && _onceki) {
        b.style.overflow = _onceki.bo;
        h.style.overflow = _onceki.ho;
        b.style.overscrollBehavior = _onceki.ob;
        b.style.touchAction = _onceki.ta;
        _onceki = null;
      }
    };
  }, []);
}

/** Yalnız test içindir — modül düzeyindeki sayacı sıfırlar. */
export function __resetScrollLock() {
  _sayac = 0;
  _onceki = null;
}
