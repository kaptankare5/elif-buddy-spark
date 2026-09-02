// 🎨 HARF RENKLERİ — her harfin kendi rengi (kullanıcı isteği: "harfler
// rengarenk olsun, elif sarı be pembe vs.").
//
// ⚠️ YALNIZ "Yazılış Hafıza Yöntemi" DERSİNDE kullanılır. Konu sayfaları,
// testler ve oyunlar harfleri kendi tema renkleriyle çiziyor; orada harf başına
// renk vermek karışıklık ölçümünü bozardı — çocuk şekli değil RENGİ ezberler
// ve sonra renksiz bir kartta harfi tanıyamaz. Derste tersi geçerli: amaç
// şekli ezberletmek değil, KURALI (kuyruğu sil) göstermek; renk burada yalnız
// "hangi harfle oynuyorum" ayrımını canlı tutar.
//
// Renkler çocuk gözüne göre seçildi: doygun, birbirinden ayrık ve koyu zeminde
// de açık zeminde de okunur (hepsi orta koyulukta — pastel tonlar beyaz kartta
// kayboluyordu).
export const HARF_RENGI: Record<number, string> = {
  1: "#f5a623",   // Elif  — sarı (kullanıcı örneği)
  2: "#ec4899",   // Be    — pembe (kullanıcı örneği)
  3: "#8b5cf6",   // Te    — mor
  4: "#0ea5e9",   // Se    — gök mavisi
  5: "#ef4444",   // Cim   — kırmızı
  6: "#14b8a6",   // Ha    — turkuaz
  7: "#f97316",   // Hı    — turuncu
  8: "#22c55e",   // Dal   — yeşil
  9: "#a855f7",   // Zel   — leylak
  10: "#e11d48",  // Ra    — vişne
  11: "#06b6d4",  // Ze    — camgöbeği
  12: "#eab308",  // Sin   — hardal
  13: "#d946ef",  // Şın   — fuşya
  14: "#3b82f6",  // Sad   — mavi
  15: "#10b981",  // Dad   — zümrüt
  16: "#f43f5e",  // Ta    — gül
  17: "#6366f1",  // Za    — çivit
  18: "#84cc16",  // Ayn   — fıstık
  19: "#fb7185",  // Ğayn  — mercan
  20: "#0891b2",  // Fe    — petrol
  21: "#c026d3",  // Gaf   — orkide
  22: "#f59e0b",  // Kef   — amber
  23: "#7c3aed",  // Lem   — menekşe
  24: "#059669",  // Mim   — çam
  25: "#dc2626",  // Nun   — kiremit
  26: "#2563eb",  // He    — lacivert
  27: "#65a30d",  // Vev   — zeytin
  28: "#db2777",  // Ye    — magenta
};

/** Harfin ders rengi; tanımsızsa uygulamanın ana yeşili. */
export const harfRengi = (n: number): string => HARF_RENGI[n] ?? "#0f766e";

/** Aynı rengin açık tonu (gölge/vurgu için). */
export function acikTon(hex: string, oran = 0.35): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const k = (v: number) => Math.round(v + (255 - v) * oran);
  return `#${((k(r) << 16) | (k(g) << 8) | k(b)).toString(16).padStart(6, "0")}`;
}
