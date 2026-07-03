import { flattenItems } from "@/data/subjects";
import { freeItemIds } from "@/lib/premium";
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
    if (v === "en" || v === "tr") return v;
  } catch { /* ignore */ }
  return "tr";
}

export function setGameLang(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event("games-lang-change")); } catch { /* ignore */ }
}

// Premium durumunu modül seviyesinde tut — gamePool çağrıldığında filtre uygular
let _isPremium = false;
export function setGamePremium(v: boolean) {
  if (_isPremium !== v) {
    _isPremium = v;
    try { window.dispatchEvent(new Event("games-lang-change")); } catch { /* ignore */ }
  }
}

// Görsel-olarak oyunda kullanılabilecek itemlar (emojili, harf/hece/alfabe değil)
// Premium değilse: sadece ücretsiz konuların itemları.
export function gamePool(lang?: Lang): ContentItem[] {
  const target = lang ?? getGameLang();
  const free = _isPremium ? null : freeItemIds();
  return flattenItems().filter(
    (it) =>
      it.lang === target &&
      !!it.emoji &&
      !it.id.startsWith("harf-") &&
      !it.id.startsWith("ilkses-") &&
      !it.id.startsWith("hece-") &&
      !it.id.startsWith("en-letter-") &&
      !it.id.startsWith("top-") &&
      !it.id.startsWith("cik-") &&
      !it.id.startsWith("karsi-") &&
      (free === null || free.has(it.id))
  );
}

export function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}
