import { flattenItems } from "@/data/subjects";
import { getUnlockedItemIdSet } from "@/lib/unlock";
import { pickDistractors } from "@/lib/confusion";
import type { ContentItem, Lang } from "@/data/types";

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const LANG_KEY = "games-lang";

export function getGameLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "en" || v === "tr" || v === "ar") return v;
  } catch { /* ignore */ }
  return "tr";
}

export function setGameLang(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("games-lang-change")); } catch { /* ignore */ }
}

export function setGamePremium(_v: boolean) {
  // Premium ayrımı kaldırıldı — no-op (geriye uyum).
}

// Elifbâ oyunları için havuz: yalnızca AÇILMIŞ konu VE bölümlerdeki, emoji
// (Arapça glif) alanı dolu olan itemlar. Böylece oyunlar da derslerle aynı
// aşamalı müfredatı izler — çocuk oyunda henüz öğrenmediği harfle
// karşılaşmaz (bilişsel yük + başarı hissi). `lang` parametresi tutuluyor
// ama Elifbâda tüm içerik Türkçe okunuş etiketiyle geliyor.
export function gamePool(_lang?: Lang): ContentItem[] {
  const unlockedIds = getUnlockedItemIdSet();
  return flattenItems().filter((it) => !!it.emoji && unlockedIds.has(it.id));
}

export function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

/**
 * Oyunlarda hedefin YANINDA görünecek yanlış harfler.
 *
 * Rastgele seçilirse oyun ayrım öğretmez: Elif sorulduğunda ekrana Elif ile
 * hiç benzemeyen harfler gelirse çocuk şekle bakmadan da bulur. Karıştırdığı
 * harf (Lem) ekranda olursa her doğru cevap gerçek bir AYRIM olur ve karışıklık
 * çöze çöze azalır. Önce çocuğun GERÇEKTEN karıştırdıkları (ölçülmüş ısı),
 * sonra a-priori benzerler, sonra rastgele doldurma.
 *
 * `emoji` alanı aynı olanları eleme seçeneği: bazı oyunlar aynı görünen iki
 * öğeyi yan yana koyamaz (çocuk hangisi doğru ayırt edemez).
 */
export function pickWrongs(
  pool: ContentItem[],
  target: ContentItem | null | undefined,
  n: number,
  opts?: { distinctEmoji?: boolean },
): ContentItem[] {
  if (!target) return pickN(pool, n);
  const usable = opts?.distinctEmoji
    ? pool.filter((p) => p.id !== target.id && p.emoji !== target.emoji)
    : pool.filter((p) => p.id !== target.id);
  return pickDistractors(usable, target, n);
}

/**
 * Tahtaya N FARKLI harf koyan oyunlar için (Eşleştirme, Ayıklama, Üçlü, Hafıza):
 * harfler rastgele değil, bir çekirdeğin çevresindeki KARIŞANLARDAN kurulur.
 * Böylece tahtada ج ile ح yan yana bulunur ve her doğru hamle bir ayrımdır.
 */
export function pickCluster(pool: ContentItem[], n: number): ContentItem[] {
  if (pool.length <= n) return shuffle(pool);
  const anchor = pool[Math.floor(Math.random() * pool.length)];
  const near = pickWrongs(pool, anchor, n - 1);
  const out = [anchor, ...near];
  if (out.length < n) {
    const have = new Set(out.map((o) => o.id));
    out.push(...shuffle(pool.filter((p) => !have.has(p.id))).slice(0, n - out.length));
  }
  return shuffle(out);
}
