// Oyun modu: normal | super
// - normal: mevcut davranış (4 soruda 1 test, ipuçları/halkalar her zaman)
// - super: daha sıkı öğrenme — yılan sürekli sorar; ipucu halkası sadece seviye 1'de
import { useEffect, useState } from "react";

export type GameMode = "normal" | "super";

const KEY = "elifba-game-mode-v1";
const EVENT = "elifba-game-mode-updated";

export function getGameMode(): GameMode {
  if (typeof window === "undefined") return "normal";
  try {
    const v = localStorage.getItem(KEY);
    return v === "super" ? "super" : "normal";
  } catch { return "normal"; }
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
export const SUPER_MODE_GAMES = new Set(["snake", "runner", "balloon", "sorter", "quiz", "flappy"]);
