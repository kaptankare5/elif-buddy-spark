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
 * ⚠️ **iOS'TA `navigator.vibrate` HİÇ YOK** — ölçüldü: Safari ve iOS WebView
 * bu API'yi hiç uygulamıyor, yani uygulamanın bütün dokunsal geri bildirimi
 * iPhone'da SESSİZCE KAYBOLUYORDU. Android tarayıcıda çalışıyor ama oradaki
 * `vibrate` de kaba bir titreşim motoru sürücüsü: şiddet ayarı yok.
 *
 * Çözüm KATMANLI (uygulama Capacitor ile mağazaya çıkacak):
 *   1. Capacitor + Haptics eklentisi varsa → Taptic Engine / Android
 *      HapticFeedback. iOS'ta gerçek "tık" hissi, ikisinde de şiddet ayrımı.
 *   2. Yoksa (tarayıcı) → `navigator.vibrate` desenleri (bugünkü davranış).
 *   3. O da yoksa → sessizce hiçbir şey.
 *
 * ⚠️ NPM BAĞIMLILIĞI YOK: eklenti native tarafta kayıtlıysa Capacitor onu
 * `window.Capacitor.Plugins.Haptics` altında yayımlıyor. `purchases.ts` ve
 * `CapacitorBackHandler` ile aynı desen — paket kurulu değilken kod sessizce
 * 2. katmana düşüyor, derleme de bozulmuyor.
 * ⚠️ ÇAĞRI `void`: Haptics sözü (promise) döndürüyor, oyun döngüsü onu
 * BEKLEMEMELİ — beklerse kare süresine native köprü gecikmesi biniyor.
 */
type HapticsBridge = {
  impact?: (o: { style: string }) => Promise<void>;
  notification?: (o: { type: string }) => Promise<void>;
  vibrate?: (o: { duration: number }) => Promise<void>;
};

/** Titreşim türü → Capacitor Haptics çağrısı. */
const HAPTIC: Record<Titresim, (h: HapticsBridge) => void> = {
  hafif:  (h) => void h.impact?.({ style: "LIGHT" }),
  orta:   (h) => void h.impact?.({ style: "MEDIUM" }),
  sert:   (h) => void h.impact?.({ style: "HEAVY" }),
  basari: (h) => void h.notification?.({ type: "SUCCESS" }),
  hata:   (h) => void h.notification?.({ type: "ERROR" }),
};

function haptics(): HapticsBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: HapticsBridge } };
  };
  if (!w.Capacitor?.isNativePlatform?.()) return null;
  return w.Capacitor.Plugins?.Haptics ?? null;
}

export function titre(tur: Titresim = "hafif") {
  if (!titresimAcik()) return;
  try {
    const h = haptics();
    if (h) { HAPTIC[tur](h); return; }
    const n = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    n.vibrate?.(DESEN[tur]);
  } catch { /* desteklenmiyorsa sessizce geç */ }
}
