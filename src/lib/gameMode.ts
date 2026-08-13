// Oyun modu: normal ("Serbest Oyun") | super ("Süper Öğrenme")
// - normal: SADECE EĞLENCE — ipuçları/halkalar hep açık, cevaplar SRS'e
//   yazılmaz. ⚠️ Havuzu YALNIZ daha önce görülmüş harflerdir (aşağıya bak).
// - super: ipucu halkası yalnız L1'de ve ilk karşılaşmada hiç yok; her cevap
//   seviyeye işler.
//
// ⚠️ NEDEN SERBEST OYUN İLK KARŞILAŞMAYA DOKUNAMAZ
// Bütün ölçüm ilk karşılaşmada yapılıyor: harfi ilk görüşünde doğru bilirse
// "zaten biliyormuş" sayılıp doğrudan L3'e çıkıyor (srs.ts hızlı geçiş).
// Serbest oyunda ipucu halkası HEP açık olduğu için çocuk harfi tanımadan da
// doğru basar. O harf serbest oyunda ilk kez görülürse ölçüm çöker ve
// bilinmeyen harf ustalaşmış görünür. Bu yüzden serbest oyun havuzu
// `seen > 0` olan harflerle sınırlıdır — ilk karşılaşmalar YALNIZ süper
// modda, testte ve Flashcard'da olur. Kullanıcı kararı.
import { useEffect, useState } from "react";

export type GameMode = "normal" | "super";

const KEY = "elifba-game-mode-v1";
const EVENT = "elifba-game-mode-updated";

/**
 * Serbest Oyun'un açılması için gereken en az GÖRÜLMÜŞ harf sayısı.
 * Oyunlar 4 şık gösteriyor; havuzda 4'ten az harf varsa şıklar tekrar eder
 * ya da oyun hiç soru bulamaz. 8, çeşitlilik için rahat bir taban.
 */
export const FREE_PLAY_MIN_SEEN = 8;

// Varsayılan mod Süper Öğrenme — kullanıcı Ayarlar'dan Serbest Oyun'a
// geçebilir (bu tercih localStorage'a yazılır).
export function getGameMode(): GameMode {
  if (typeof window === "undefined") return "super";
  try {
    const v = localStorage.getItem(KEY);
    return v === "normal" ? "normal" : "super";
  } catch { return "super"; }
}

export function setGameMode(m: GameMode) {
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function useGameMode(): [GameMode, (m: GameMode) => void] {
  const [m, setM] = useState<GameMode>(() => getGameMode());
  useEffect(() => {
    const h = () => setM(getGameMode());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [m, setGameMode];
}

// Süper öğrenme modunda gösterilen oyun listesi
export const SUPER_MODE_GAMES = new Set(["snake", "runner", "balloon", "sorter", "quiz", "flappy", "subway", "platform", "party", "kart", "lane"]);
