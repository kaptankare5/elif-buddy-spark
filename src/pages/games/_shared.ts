import { flattenItems } from "@/data/subjects";
import { getUnlockedTopicIds, isItemInUnlockedTopic } from "@/lib/unlock";
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

// Elifbâ oyunları için havuz: yalnızca AÇILMIŞ konulardaki, emoji (Arapça
// glif) alanı dolu olan itemlar. `lang` parametresi tutuluyor ama Elifbâda
// tüm içerik Türkçe okunuş etiketiyle geliyor (item.lang === "tr").
export function gamePool(_lang?: Lang): ContentItem[] {
  const unlocked = getUnlockedTopicIds();
  return flattenItems().filter(
    (it) => !!it.emoji && isItemInUnlockedTopic(it.id, unlocked),
  );
}

export function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}
