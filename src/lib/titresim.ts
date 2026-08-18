// DOKUNSAL GERİ BİLDİRİM (titreşim).
//
// ⚠️ AYRI MODÜL — DÖNGÜSEL IMPORT OLMASIN: hem `audio.ts` (playSfx'in içinde)
// hem `juice.ts` kullanıyor; juice.ts zaten audio.ts'ten `tone` alıyor.
// Titreşimi ikisinden birinin içine koymak halka üretiyordu.
export type Titresim = "hafif" | "orta" | "sert" | "basari" | "hata";

// ⚠️ SÜRELER KISA (8-34 ms). Uzun titreşim çocuğun elinde "bozuldu" hissi
// veriyor ve pil yakıyor; oyun geri bildirimi vuruş gibi kısa olmalı.
const DESEN: Record<Titresim, number | number[]> = {
  hafif: 8,
  orta: 18,
  sert: 34,
  basari: [12, 40, 12],
  hata: [26, 50, 26],
};

const KEY = "elifba-titresim-v1";
const EVENT = "elifba-titresim-updated";

export function titresimAcik(): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}

export function setTitresimAcik(acik: boolean) {
  try { localStorage.setItem(KEY, acik ? "1" : "0"); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
  if (acik) titre("hafif");   // açarken bir kez hissettir
}

export const TITRESIM_EVENT = EVENT;

/**
 * ⚠️ SESSİZCE DÜŞER: iOS Safari'de `navigator.vibrate` YOK, masaüstü
 * tarayıcıların çoğunda da yok. Varlığı denetlenir; try/catch şart —
 * kullanıcı etkileşimi olmadan çağrılırsa bazı tarayıcılar istisna atıyor.
 */
export function titre(tur: Titresim = "hafif") {
  if (!titresimAcik()) return;
  try {
    const n = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    n.vibrate?.(DESEN[tur]);
  } catch { /* desteklenmiyorsa sessizce geç */ }
}
