/**
 * OYUN DOSYALARI — kapsam testlerinin ortak listesi.
 *
 * ⚠️ NEDEN ORTAK: bu süzgeç BEŞ ayrı kapsam testinde (zorluk, juice,
 * gameFeel, kalıcılık, mobilHis) elle kopyalanmıştı. `src/pages/games/`
 * altına yeni bir YARDIMCI modül eklemek beş testi birden kırıyordu ve her
 * seferinde beş dosyaya aynı adı yazmak gerekiyordu — listelerin birbirinden
 * ayrı düşmesi an meselesiydi.
 *
 * ⚠️ KURAL YAPISAL: alt çizgiyle başlayan dosya YARDIMCIdır, oyun değil
 * (`_shared`, `_askUI`, `_letterTexture`, `_perf`, `_bolumKutlama`). Zaten
 * uygulanan adlandırma buydu; allowlist onu yalnızca elle tekrar ediyordu.
 * Oyunlar `Game.tsx` üzerinden kaydedildiği için bir oyunu yanlışlıkla alt
 * çizgiyle adlandırmak zaten rota kaydında fark edilir.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

export const OYUN_DIZINI = join(process.cwd(), "src/pages/games");

/** Kapsam testlerine giren oyun dosyaları (yardımcılar hariç). */
export function oyunDosyalari(): string[] {
  return readdirSync(OYUN_DIZINI)
    .filter((f) => f.endsWith(".tsx") && !f.startsWith("_"))
    .sort();
}

/**
 * ⚠️ Sayı BİLEREK sabit: yeni oyun eklenip kapsama bağlanmayı unutmak ya da
 * bir oyunu silip kaydını unutmak burada yakalanır.
 * (İki Yol Koşusu kullanıcı isteğiyle kaldırıldı: 15 → 14.)
 */
export const OYUN_SAYISI = 14;
