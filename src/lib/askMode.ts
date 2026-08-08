// OYUNLARDA SORU SORMA YÖNTEMİ — deneysel modlar (kullanıcı fikri).
//
// Klasik yöntem TERS YÖNDE ölçüyor: sesi duy → şekli seç. Oysa hedef beceri
// üretimdir: harfi GÖR → adını söyle (Elifbâ kitabının ve Kur'an okumanın
// istediği yön). Yeni modlar soruyu bu yöne çeviriyor: GLİF gösterilir,
// şıklar harfin ADIDIR (yazılı).
//
// ⚠️ ESKİ MOD SİLİNMEDİ. Ayarlar'dan geçiş yapılır, beğenilmezse geri dönülür.
//
// ⚠️ OKUMA ŞARTI: yazılı şıklar çocuğun LATİN harflerini okuyabilmesini
// gerektirir. 5-6 yaşındaki bir çocuk Türkçe okuyamıyorsa bu modlar onun için
// çalışmaz — bu yüzden varsayılan hâlâ "klasik". Deneyip karar vermek için var.
import { useEffect, useState } from "react";
import type { ContentItem } from "@/data/types";

export type AskMode =
  /** Ses çalar → glif şıklarından seç. (Eski/varsayılan) */
  | "klasik"
  /** Glif 1 sn yarı saydam parlar sönür → yazılı ad şıklarından seç. */
  | "flash"
  /** Glif kapının üstünde ASILI durur → yazılı ad şıklarından seç. */
  | "ustte";

const KEY = "elifba-ask-mode-v1";
export const ASK_MODE_EVENT = "elifba-ask-mode-updated";

export const ASK_MODES: Array<{ id: AskMode; ad: string; aciklama: string }> = [
  { id: "klasik", ad: "Klasik", aciklama: "Sesi duy → harfi seç (mevcut)" },
  { id: "flash", ad: "Şimşek", aciklama: "Harf 1 sn parlar → adını seç" },
  { id: "ustte", ad: "Tabela", aciklama: "Harf kapıda asılı → adını seç" },
];

/** Şimşek modunda şık sayısı. */
export const FLASH_SIK = 2;
/** Tabela modunda şık sayısı (glif ekranda durduğu için okumaya vakit var). */
export const USTTE_SIK = 3;
/** Glifin ekranda parladığı süre (ms). */
export const FLASH_MS = 1100;

export function getAskMode(): AskMode {
  if (typeof window === "undefined") return "klasik";
  try {
    const v = localStorage.getItem(KEY);
    return v === "flash" || v === "ustte" ? v : "klasik";
  } catch { return "klasik"; }
}

export function setAskMode(m: AskMode) {
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(ASK_MODE_EVENT)); } catch { /* ignore */ }
}

export function useAskMode(): [AskMode, (m: AskMode) => void] {
  const [m, setM] = useState<AskMode>(() => getAskMode());
  useEffect(() => {
    const h = () => setM(getAskMode());
    window.addEventListener(ASK_MODE_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(ASK_MODE_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [m, (v: AskMode) => { setAskMode(v); setM(v); }];
}

/** Şıkta yazacak ad. Yoksa null → o öğe yeni modda sorulamaz. */
export function okunurAd(it: ContentItem): string | null {
  const s = (it.translit || "").trim();
  return s.length > 0 ? s : null;
}

/** Levenshtein — ad benzerliği için. */
function mesafe(a: string, b: string): number {
  const x = a.toLocaleLowerCase("tr"), y = b.toLocaleLowerCase("tr");
  const dp = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[x.length][y.length];
}

/**
 * YAZILI ŞIK ÇELDİRİCİLERİ — adı hedefe EN BENZEYEN öğelerden seçilir.
 *
 * ⚠️ Kullanıcının yakaladığı açık: şıklar "Be" ve "Zanahoria" gibi çok farklıysa
 * çocuk kelimeyi OKUMADAN, ilk harfe bakıp seçer — kısayol öğrenir, harfi
 * öğrenmez. Çözüm, adı hedefe benzeyen çeldirici koymak: "Sin" ↔ "Şin",
 * "Sad" ↔ "Dad", "Te" ↔ "Tı", "Ha" ↔ "Hı", "Kef" ↔ "Kaf". O zaman çocuk
 * kelimenin TAMAMINI okumak zorunda kalır.
 *
 * ⚠️ UYDURMA AD KULLANILMAZ. Kullanıcının örneğinde ("bear" için sahte "beal")
 * mantık aynı, ama harf adlarında sahte bir ad göstermek çocuğa YANLIŞ AD
 * öğretme riski taşır. Gerçek harf adları arasında zaten yeterince benzer
 * çiftler var — uydurmaya gerek yok.
 */
export function pickNameWrongs(pool: ContentItem[], target: ContentItem, n: number): ContentItem[] {
  const hedefAd = okunurAd(target);
  if (!hedefAd) return [];
  const adaylar = pool
    .filter((i) => i.id !== target.id)
    .map((i) => ({ it: i, ad: okunurAd(i) }))
    .filter((x): x is { it: ContentItem; ad: string } => !!x.ad && x.ad !== hedefAd);
  // Aynı adı taşıyan başka öğe olmasın (Fe'nin başta/ortada hâlleri gibi) —
  // yoksa sorunun iki doğru cevabı olur.
  const gorulen = new Set<string>([hedefAd]);
  const benzersiz = adaylar.filter((x) => {
    if (gorulen.has(x.ad)) return false;
    gorulen.add(x.ad);
    return true;
  });
  benzersiz.sort((a, b) => mesafe(a.ad, hedefAd) - mesafe(b.ad, hedefAd));
  // En benzer 6 aday arasından rastgele n tane — hep aynı çift çıkmasın.
  const havuz = benzersiz.slice(0, Math.max(n, 6));
  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [havuz[i], havuz[j]] = [havuz[j], havuz[i]];
  }
  return havuz.slice(0, n).map((x) => x.it);
}
