// GÜNLÜK GÖREVLER — sonsuz koşuya yön veren şey.
//
// ⚠️ NEDEN: Subway Surfers'ın sonsuz koşuyu ayakta tutan mekaniği görev
// sistemi — "şu kadar topla", "şuraya ulaş". Görevler sonsuzluğa düzen verir;
// oyunun kendisi değişmeden oturuma bir amaç gelir.
//
// ⚠️ ÇOCUK İÇİN ÜÇ KURAL:
//   · Görevler GÜNLÜK ama KAÇIRMA CEZASI YOK — dün yapılmayan görev bugün
//     yenilenir, hiçbir şey kaybedilmez. Seri kodundaki aynı ilke.
//   · Hedefler KÜÇÜK: 6 yaşındaki için "300 altın" bir iş, "20 altın" bir oyun.
//   · Bildirim, geri sayım, "acele et" baskısı YOK.
import { useEffect, useState } from "react";

export type GorevTuru = "altin" | "dogru" | "mesafe";

export interface Gorev {
  tur: GorevTuru;
  hedef: number;
  ilerleme: number;
  bitti: boolean;
}

const KEY = "elifba-gorev-v1";
const EVENT = "elifba-gorev-updated";

const TANIM: Record<GorevTuru, { ad: string; emoji: string; secenek: number[] }> = {
  altin:   { ad: "altın topla",     emoji: "🪙", secenek: [15, 20, 30] },
  dogru:   { ad: "kapıyı doğru geç", emoji: "🚪", secenek: [3, 5, 8] },
  mesafe:  { ad: "metre koş",       emoji: "🏁", secenek: [200, 300, 500] },
};

export function gorevMetni(g: Gorev): string {
  return `${TANIM[g.tur].emoji} ${g.hedef} ${TANIM[g.tur].ad}`;
}

function bugun(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

interface Durum { gun: string; gorevler: Gorev[] }

function uret(): Gorev[] {
  return (Object.keys(TANIM) as GorevTuru[]).map((tur) => {
    const s = TANIM[tur].secenek;
    return { tur, hedef: s[Math.floor(Math.random() * s.length)], ilerleme: 0, bitti: false };
  });
}

function oku(): Durum {
  if (typeof window === "undefined") return { gun: bugun(), gorevler: uret() };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null") as Durum | null;
    // ⚠️ GÜN DEĞİŞTİYSE YENİLENİR, CEZA YOK: dün bitirilmemiş görev bugün
    // yerini yenisine bırakır; hiçbir şey kaybedilmiş hissi verilmez.
    if (!d || d.gun !== bugun()) {
      const yeni = { gun: bugun(), gorevler: uret() };
      localStorage.setItem(KEY, JSON.stringify(yeni));
      return yeni;
    }
    return d;
  } catch { return { gun: bugun(), gorevler: uret() }; }
}

function yaz(d: Durum) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function getGorevler(): Gorev[] {
  return oku().gorevler;
}

/** İlerleme ekle. Yeni tamamlananların listesini döndürür (kutlama için). */
export function gorevIlerlet(tur: GorevTuru, miktar: number): Gorev[] {
  if (miktar <= 0) return [];
  const d = oku();
  const yeniBitenler: Gorev[] = [];
  d.gorevler = d.gorevler.map((g) => {
    if (g.tur !== tur || g.bitti) return g;
    const ilerleme = g.ilerleme + miktar;
    const bitti = ilerleme >= g.hedef;
    const yg = { ...g, ilerleme: Math.min(ilerleme, g.hedef), bitti };
    if (bitti) yeniBitenler.push(yg);
    return yg;
  });
  yaz(d);
  return yeniBitenler;
}

export function useGorevler(): Gorev[] {
  const [g, setG] = useState<Gorev[]>(() => getGorevler());
  useEffect(() => {
    const h = () => setG(getGorevler());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return g;
}

export const GOREV_EVENT = EVENT;
