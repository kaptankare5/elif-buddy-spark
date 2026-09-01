// Kullanıcı ayarları — ses ve titreşim aç/kapa
import { useEffect, useState } from "react";

export interface AppSettings {
  sound: boolean;     // doğru/yanlış kısa ses efektleri
  vibrate: boolean;   // yanlışta telefon titreşimi
  /**
   * FLASHCARD'DA SADE ÇALIŞMA (varsayılan kapalı).
   *
   * Normal Flashcard motive edicidir: seviye rozeti + yıldızlar, oturum
   * sayacı ve SRS'in seçtiği sıra (zorlanınca kurtarma kartı, karışan
   * partner, araya serpiştirilmiş eski konu, 20 kartta bir denetim).
   * Sade modda bunların hepsi kapanır: deste BAŞTAN SONA, sırayla ve
   * eksiksiz dönülür. "Bugün şu konuyu bir baştan geçelim" çalışması için.
   * ⚠️ Cevaplar YİNE SRS'e yazılır — motivasyon ögesi kaldırıldı, öğrenme
   * kaydı değil.
   */
  flashcardSade: boolean;
}

const KEY = "elifba-settings-v1";
const EVENT = "elifba-settings-updated";

const DEFAULTS: AppSettings = { sound: true, vibrate: true, flashcardSade: false };

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
