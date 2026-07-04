// Test amaçlı kilit açma: Ayarlar'da 1234 şifresi girilirse kilitli tüm
// konular bu cihazda açılır (SRS ilerleme şartı atlanır).
import { useEffect, useState } from "react";

const KEY = "elifba-test-unlock-v1";
const EVENT = "elifba-test-unlock-changed";
const CODE = "1234";

export function isTestUnlockActive(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setTestUnlockActive(active: boolean) {
  if (active) localStorage.setItem(KEY, "1");
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
  window.dispatchEvent(new Event("elifba-progress-updated"));
}

// Girilen kod doğruysa test kilidini açar ve true döner.
export function tryUnlockWithCode(code: string): boolean {
  if (code.trim() !== CODE) return false;
  setTestUnlockActive(true);
  return true;
}

export function useTestUnlock(): [boolean, (active: boolean) => void] {
  const [active, setActive] = useState(() => isTestUnlockActive());
  useEffect(() => {
    const h = () => setActive(isTestUnlockActive());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [active, setTestUnlockActive];
}
