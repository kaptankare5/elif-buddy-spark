// Kullanıcı ayarları — ses ve titreşim aç/kapa
import { useEffect, useState } from "react";

export interface AppSettings {
  sound: boolean;     // doğru/yanlış kısa ses efektleri
  vibrate: boolean;   // yanlışta telefon titreşimi
}

const KEY = "elifba-settings-v1";
const EVENT = "elifba-settings-updated";

const DEFAULTS: AppSettings = { sound: true, vibrate: true };

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function setSettings(patch: Partial<AppSettings>) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

export function useSettings(): [AppSettings, (p: Partial<AppSettings>) => void] {
  const [s, setS] = useState<AppSettings>(() => getSettings());
  useEffect(() => {
    const h = () => setS(getSettings());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [s, setSettings];
}
