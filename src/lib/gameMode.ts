// Oyun modu: ARTIK TEK MOD — Süper Öğrenme (kullanıcı kararı).
//
// Eskiden "normal" (sadece eğlence, cevaplar SRS'e yazılmaz) ve "super" (her
// cevap seviyeye işler) diye iki mod vardı ve Ayarlar'dan seçiliyordu. Normal
// mod KALDIRILDI: çocuk hangi oyunun ilerlemesine saydığını bilemiyordu,
// oynadığı hâlde seviyesi değişmeyince uygulama "düzgün test etmiyor"
// hissi veriyordu. Artık her oyun cevabı sayılır.
//
// Tip ve fonksiyonlar İMZASIYLA duruyor (13 oyun ve testler bunları çağırıyor);
// getGameMode her zaman "super" döner. Oyunlardaki `!isSuper` dalları artık
// ulaşılamaz — ayrı bir temizlik commit'inde sökülecek, tek commit'te 13
// oyuna dokunmak gereksiz risk.
import { useEffect, useState } from "react";

export type GameMode = "super";

const EVENT = "elifba-game-mode-updated";

export function getGameMode(): GameMode { return "super"; }

/** Geriye dönük uyumluluk — mod artık değiştirilemez, çağrı sessizce yutulur. */
export function setGameMode(_m?: GameMode) {
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function useGameMode(): [GameMode, (m: GameMode) => void] {
  const [m, setM] = useState<GameMode>(() => getGameMode());
  useEffect(() => {
    const h = () => setM(getGameMode());
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return [m, setGameMode];
}

// Süper öğrenme modunda gösterilen oyun listesi
export const SUPER_MODE_GAMES = new Set(["snake", "runner", "balloon", "sorter", "quiz", "flappy", "subway", "platform", "party", "kart"]);
