// BÖLÜM YILDIZI / DERECESİ — bitmiş içeriğe geri dönme sebebi.
//
// ⚠️ NEDEN: Macera (10 bölüm), Parti (10 bölüm) ve Yarışı'nda (3 pist)
// ilerleme TEK BİT bilgiydi: bölüm açık mı, değil mi. Sıyrılarak bitirmekle
// kusursuz bitirmek aynı sonucu veriyordu, dolayısıyla bitmiş bölüm ÖLÜ
// İÇERİKTİ. Uygulamanın en pahalı üretilmiş içeriği (30 bölüm + 3 pist)
// bir kez oynanıp bırakılıyordu.
//
// ⚠️ YILDIZ PERFORMANSA BAKAR, TAMAMLAMAYA DEĞİL — yoksa yine tek bit olur.
import { useEffect, useState } from "react";

const KEY = "elifba-bolum-yildiz-v1";
const EVENT = "elifba-bolum-yildiz-updated";

/** `oyun` = platform | party | kart. Anahtar: `${oyun}:${bolum}`. */
type Kayit = Record<string, number>;

function oku(): Kayit {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") as Kayit; } catch { return {}; }
}

function yaz(k: Kayit) {
  try { localStorage.setItem(KEY, JSON.stringify(k)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function getYildiz(oyun: string, bolum: number): number {
  return oku()[`${oyun}:${bolum}`] ?? 0;
}

/**
 * Yıldızı kaydet — yalnız DAHA İYİYSE.
 *
 * ⚠️ Geriye gitmez: çocuk 3 yıldızlı bir bölümü tekrar oynayıp kötü bitirirse
 * kazandığı yıldızı KAYBETMEZ. Kaybetme korkusu bu yaşta tekrar oynamayı
 * engelliyor; amaç bölüme dönmeyi teşvik etmek.
 */
export function setYildiz(oyun: string, bolum: number, yildiz: number) {
  // ⚠️ GÜNLÜK SERİ BURADAN DA BESLENİR. Seriyi yalnız `oyunBitti` besliyordu;
  // Macera ve Parti bölüm bitince yalnız yıldız yazıyor, rekor katmanını hiç
  // çağırmıyor. Normal modda oyun cevabı SRS'e de yazılmadığı için bütün gün
  // Macera oynayan çocuğun serisi HİÇ ilerlemiyordu — uygulamanın tek günlük
  // geri dönüş kancası, çocuğun en çok vakit geçirdiği yerde ölüydü.
  // ⚠️ Erken dönüşten ÖNCE: bölümü daha kötü bitirmek de "bugün oynadım"dır.
  try {
    void import("@/lib/streak").then((m) => m.recordStreakActivity()).catch(() => {});
  } catch { /* ignore */ }

  const k = oku();
  const anahtar = `${oyun}:${bolum}`;
  if ((k[anahtar] ?? 0) >= yildiz) return;
  k[anahtar] = yildiz;
  yaz(k);
}

export function toplamYildiz(oyun: string): number {
  const k = oku();
  return Object.entries(k)
    .filter(([a]) => a.startsWith(`${oyun}:`))
    .reduce((t, [, v]) => t + v, 0);
}

export function useYildizlar(): Kayit {
  const [k, setK] = useState<Kayit>(() => oku());
  useEffect(() => {
    const h = () => setK(oku());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return k;
}

/** Üç yıldızlık rozet — bölüm seçme ekranlarında. */
export function yildizMetni(y: number): string {
  return "⭐".repeat(y) + "·".repeat(Math.max(0, 3 - y));
}
