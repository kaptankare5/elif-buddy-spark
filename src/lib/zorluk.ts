// ZORLUK AYARI — Kolay / Orta / Zor (varsayılan KOLAY).
//
// ⚠️ NEDEN GEREKLİ: oyunların çoğu tek düze idi. Ölçüldü: Uçan Kuş'ta harf
// hızı (11.5 birim/sn) ve dalga aralığı (4.3 sn) skordan TAMAMEN bağımsızdı —
// 1. dakika ile 20. dakika aynı. Uzay Savaşı'nda düşman hızı sabitti, yalnız
// sıklık artıyordu, o da skor 70'te tavan yapıp duruyordu. Yılan sabit
// 3.85 hamle/sn, Balon skordan bağımsız.
//
// İki ayrı kavram var, karıştırma:
//   · ZORLUK  = çocuğun/velinin seçtiği bant (bu dosya)
//   · RAMPA   = oyun İÇİNDE doğru cevap arttıkça hızlanma (`rampa()`)
// Rampa SKORA değil DOĞRU SAYISINA bağlanır — Koşusu'nda bu dersi aldık:
// skor seri bonusu ve 2X ile şişiyor, çocuk 6 doğruda tavana çıkıyordu.
//
// ⚠️ ŞIK SAYISI ÖLÇÜMÜ BOZAR — bkz. srs.ts `sansPayi`. Kolay modda şık
// azaltmak şansla tutturmayı %25'ten %50'ye çıkarır. Bu yüzden şık sayısı
// yalnız ÖĞRENME bölgesinde (L1-L2) düşürülür; ölçümün yapıldığı L3+ harfte
// her zaman en az 3 şık gösterilir (`sikSayisiIcin`).
import { useEffect, useState } from "react";

export type Zorluk = "kolay" | "orta" | "zor";

const KEY = "elifba-zorluk-v1";
const EVENT = "elifba-zorluk-updated";

export interface ZorlukAyari {
  ad: string;
  emoji: string;
  aciklama: string;
  /** Oyunun BAŞLANGIÇ hızı çarpanı. */
  baslangic: number;
  /** Oyunun ulaşabileceği EN YÜKSEK hız çarpanı. */
  tavan: number;
  /** Tavana kaç DOĞRU cevapta varılır. */
  tavanDogru: number;
  /** Can/hak sayısı (oyun destekliyorsa). */
  can: number;
  /** Öğrenme bölgesinde (L1-L2) gösterilecek şık sayısı. */
  sik: number;
  /**
   * SÜRELİ oyunlarda süre çarpanı (Hızlı Quiz, Üçlü Eşle).
   * ⚠️ Kolayda süre UZAR (1'in üstü), zorda KISALIR — hız çarpanının tersi
   * yönde çalışır; ikisini aynı alandan türetme.
   */
  sure: number;
  /**
   * TAHTA oyunlarında (Hafıza, Üçlü Eşleştir, Üçlü Eşle, Kutu Boşalt) aynı
   * anda takip edilmesi gereken FARKLI ŞEY sayısının çarpanı.
   * ⚠️ Bu oyunlarda zorluk HIZ değildir: hafıza yükü ve seçenek çeşitliliğidir.
   */
  tahta: number;
}

export const ZORLUKLAR: Record<Zorluk, ZorlukAyari> = {
  kolay: {
    ad: "Kolay", emoji: "🐢",
    aciklama: "Yavaş, bol can, uzun süre, küçük tahta. Yeni öğrenen için.",
    baslangic: 0.75, tavan: 1.3, tavanDogru: 40, can: 5, sik: 2,
    sure: 1.5, tahta: 0.75,
  },
  orta: {
    ad: "Orta", emoji: "🐇",
    aciklama: "Normal hız ve süre; oyun ilerledikçe belirgin zorlaşır.",
    baslangic: 1.0, tavan: 1.8, tavanDogru: 25, can: 3, sik: 3,
    sure: 1.0, tahta: 1.0,
  },
  zor: {
    ad: "Zor", emoji: "🐆",
    aciklama: "Hızlı, kısa süre, kalabalık tahta. Harfleri bilen için.",
    baslangic: 1.25, tavan: 2.4, tavanDogru: 15, can: 3, sik: 4,
    sure: 0.75, tahta: 1.3,
  },
};

export function getZorluk(): Zorluk {
  if (typeof window === "undefined") return "kolay";
  try {
    const v = localStorage.getItem(KEY);
    return v === "orta" || v === "zor" ? v : "kolay";
  } catch { return "kolay"; }
}

export function setZorluk(z: Zorluk) {
  try { localStorage.setItem(KEY, z); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function zorlukAyari(z: Zorluk = getZorluk()): ZorlukAyari {
  return ZORLUKLAR[z];
}

/**
 * Oyun içi hız çarpanı: `dogruSayisi` arttıkça `baslangic` → `tavan`.
 *
 * ⚠️ DOĞRUSAL DEĞİL, KÖKLÜ artıyor: doğrusal rampada ilk 5 doğruda hiçbir şey
 * değişmiyor gibi hissediliyor (çocuk "aynı oyun" diyor), sonra birden
 * zorlaşıyor. Karekök eğrisi ilk doğrularda farkı hemen hissettirir, sonuna
 * doğru yumuşar.
 */
export function rampa(dogruSayisi: number, z: Zorluk = getZorluk()): number {
  const a = zorlukAyari(z);
  const t = Math.min(1, Math.max(0, dogruSayisi / a.tavanDogru));
  return a.baslangic + (a.tavan - a.baslangic) * Math.sqrt(t);
}

/**
 * Bir öğe için gösterilecek şık sayısı.
 *
 * ⚠️ ÖLÇÜM BÖLGESİ KORUNUR: seviye 3+ demek "biliyor sayıldı" demek; asıl
 * ölçüm (L3→L4→L5) orada yapılıyor. Orada şık azaltmak yalan ustalık üretir.
 * Bu yüzden az şık YALNIZ L1-L2'de verilir.
 */
export function sikSayisiIcin(seviye: number, tavanSik: number, z: Zorluk = getZorluk()): number {
  const a = zorlukAyari(z);
  const taban = seviye >= 3 ? Math.max(3, a.sik) : a.sik;
  return Math.max(2, Math.min(tavanSik, taban));
}

export function useZorluk(): [Zorluk, (z: Zorluk) => void] {
  const [z, setZ] = useState<Zorluk>(() => getZorluk());
  useEffect(() => {
    const h = () => setZ(getZorluk());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [z, (n: Zorluk) => { setZorluk(n); setZ(n); }];
}

/**
 * Süreli oyunlarda saniye. Kolayda uzar, zorda kısalır.
 *
 * ⚠️ Aşağı yuvarlama YOK, 5'e yuvarlanır: "90 sn" ile "88 sn" çocuk için aynı
 * ama ekranda ikincisi rastgele görünüyor.
 */
export function sureIcin(tabanSn: number, z: Zorluk = getZorluk()): number {
  return Math.max(15, Math.round((tabanSn * zorlukAyari(z).sure) / 5) * 5);
}

/**
 * Tahta oyunlarında "aynı anda kaç farklı şey" sayısı.
 *
 * ⚠️ ALT SINIR ŞART: `tahta` çarpanı küçük tabanlarda (3-4) aşağı yuvarlanınca
 * oyunu BOZUYOR — 4 çeşitli bir eşleştirme oyunu 2 çeşide inince eşleşmeler
 * kendiliğinden oluyor ve oyun bitiyor. Her çağrı kendi tabanını verir.
 */
export function tahtaBoyu(taban: number, alt: number, ust: number, z: Zorluk = getZorluk()): number {
  return Math.max(alt, Math.min(ust, Math.round(taban * zorlukAyari(z).tahta)));
}
