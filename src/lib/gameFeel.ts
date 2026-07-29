// 🎮 OYUN HİSSİ — bütün oyunların paylaştığı "eğlence" iskeleti.
//
// Oyunların çoğu ölçüm yapıyordu ama oyun gibi HİSSETTİRMİYORDU: hedef yok,
// bitiş yok, seri yok, kazanma anı yok. Çocuk 30 saniyede bırakıyordu.
// Bu modül üç şeyi tek yerden verir:
//
//  1) KOMBO — üst üste doğru cevap katsayısı büyütür (2x, 3x…). Değişken
//     ödül değil, HAK EDİLEN ödül: çocuk "seriyi bozmayayım" diye devam eder.
//  2) YILDIZ — her oyun sonunda 1-3 yıldız. Somut, tekrar oynanabilir hedef
//     ("3 yıldızı kaçırdım, bir daha"). Hedef görünür olmadan tekrar oynama
//     isteği doğmuyor.
//  3) KİŞİSEL REKOR — oyun başına en iyi skor cihazda tutulur; yeni rekor
//     anı kutlanır. Kendiyle yarışma, başkasıyla değil (çocuk dostu).
//
// Not: burada SRS/ölçüm YOK. Ölçüm gameProgress.ts'in işi; bu katman yalnız
// oyunun tadını verir ve ikisi birbirine karışmaz.

/** Kombo katsayısı: 0-2 doğru → 1x, 3-5 → 2x, 6-9 → 3x, 10+ → 4x */
export function comboMult(streak: number): number {
  if (streak >= 10) return 4;
  if (streak >= 6) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/** Kombo yükselince gösterilecek kutlama (yoksa null) */
export function comboBanner(streak: number): string | null {
  if (streak === 3) return "🔥 2× KOMBO!";
  if (streak === 6) return "⚡ 3× KOMBO!";
  if (streak === 10) return "🌟 4× KOMBO! Muhteşemsin!";
  if (streak > 0 && streak % 15 === 0) return `🏆 ${streak} doğru üst üste!`;
  return null;
}

/** Skoru yıldıza çevir (eşikler oyuna göre verilir). */
export function starsFor(score: number, thresholds: [number, number, number]): 0 | 1 | 2 | 3 {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

const BEST_KEY = (gameId: string) => `elifba-best-${gameId}-v1`;

export function getBest(gameId: string): number {
  try {
    const v = parseInt(localStorage.getItem(BEST_KEY(gameId)) || "0", 10);
    return isNaN(v) ? 0 : v;
  } catch { return 0; }
}

/** Skoru kaydet; yeni rekorsa true döner (kutlama için). */
export function submitBest(gameId: string, score: number): boolean {
  const prev = getBest(gameId);
  if (score <= prev) return false;
  try { localStorage.setItem(BEST_KEY(gameId), String(score)); } catch { /* kota */ }
  return true;
}

/** Oyun ilerledikçe zorluk (0 → 1). Çocuk ustalaştıkça tempo artar. */
export function difficultyRamp(answered: number, full = 20): number {
  return Math.max(0, Math.min(1, answered / full));
}
