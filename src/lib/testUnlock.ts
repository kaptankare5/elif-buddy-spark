/**
 * TEST PANELİ — Ayarlar'da 1234 kodu girilince açılır.
 *
 * ⚠️ İKİ AYRI ŞEY, TEK DÜĞME DEĞİL (kullanıcı şartı): "tüm konuları açmak"
 * ile "debug göstergelerini açmak" bir aradaydı ve kod girilince ikisi
 * birden geliyordu. Sonuç: geliştirici HUD'ını açmak isteyen veli bütün
 * konuları da açmış oluyordu ve uygulamayı NORMAL OYUNCU gibi test
 * edemiyordu — kilitler, bölüm açılışları, ilerleme hissi kayboluyor.
 *
 * Artık kod paneli AÇAR, panelde iki bağımsız anahtar var:
 *   · kilit  → kilitli konular/bölümler/oyun bölümleri açılır (unlock.ts,
 *              Macera/Parti/Yarış bölüm sayıları)
 *   · debug  → seviye rozetleri (LevelBadge), 🐞 Debug HUD, Macera'daki
 *              blok seviyesi yazısı
 * İkisi de kapalıyken panel açık olsa bile uygulama normal görünür.
 *
 * ⚠️ Getter'lar PANELE de bakar: paneli kapatmak (kodu geri almak) her iki
 * anahtarı da etkisiz kılar, localStorage'da artık kalsa bile.
 */
import { useEffect, useState } from "react";

const PANEL = "elifba-test-panel-v1";    // kod doğrulandı mı
const UNLOCK = "elifba-test-unlock-v1";  // ESKİ ANAHTAR — anlamı "tüm konuları aç"
const DEBUG = "elifba-test-debug-v1";    // debug göstergeleri
const EVENT = "elifba-test-unlock-changed";
const CODE = "1234";

/**
 * ESKİ CİHAZ GÖÇÜ: bölünmeden önce tek anahtar vardı ve "1" ikisini birden
 * demekti. Panel anahtarı yoksa ama eski anahtar açıksa, kullanıcı hiçbir şey
 * kaybetmesin diye panel + iki anahtar açık kabul edilir.
 */
function gocEt() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(PANEL) === null && localStorage.getItem(UNLOCK) === "1") {
    localStorage.setItem(PANEL, "1");
    localStorage.setItem(DEBUG, "1");
  }
}

function oku(key: string): boolean {
  if (typeof window === "undefined") return false;
  gocEt();
  return localStorage.getItem(PANEL) === "1" && localStorage.getItem(key) === "1";
}

function yaz(key: string, active: boolean) {
  if (active) {
    localStorage.setItem(PANEL, "1"); // anahtar açılıyorsa panel de açıktır
    localStorage.setItem(key, "1");
  } else {
    localStorage.removeItem(key);
  }
  duyur();
}

function duyur() {
  window.dispatchEvent(new Event(EVENT));
  window.dispatchEvent(new Event("elifba-progress-updated"));
}

/** Kod girildi mi — paneldeki anahtarlar yalnız bu açıkken görünür. */
export function isTestPanelOpen(): boolean {
  if (typeof window === "undefined") return false;
  gocEt();
  return localStorage.getItem(PANEL) === "1";
}

/** Kilitli konular/bölümler açık mı? (unlock.ts ve oyun bölüm sayıları) */
export function isTestUnlockActive(): boolean {
  return oku(UNLOCK);
}

/** Debug göstergeleri açık mı? (seviye rozetleri, 🐞 HUD) */
export function isDebugActive(): boolean {
  return oku(DEBUG);
}

export function setTestUnlockActive(active: boolean) {
  yaz(UNLOCK, active);
}

export function setDebugActive(active: boolean) {
  yaz(DEBUG, active);
}

/** Paneli ve iki anahtarı birden kapatır (Ayarlar'daki "Test modunu kapat"). */
export function closeTestPanel() {
  localStorage.removeItem(PANEL);
  localStorage.removeItem(UNLOCK);
  localStorage.removeItem(DEBUG);
  duyur();
}

/**
 * Kod doğruysa paneli açar. ⚠️ İki anahtar KAPALI başlar: kodu girmek
 * "test etmek istiyorum" demek, "her şeyi aç" demek değil — hangisini
 * istediğini kullanıcı panelden seçer.
 */
export function tryUnlockWithCode(code: string): boolean {
  if (code.trim() !== CODE) return false;
  localStorage.setItem(PANEL, "1");
  duyur();
  return true;
}

/** Ortak abonelik: anahtar değişince (bu sekmede ya da ötekinde) yenilenir. */
function useFlag(read: () => boolean): boolean {
  const [v, setV] = useState(read);
  useEffect(() => {
    const h = () => setV(read());
    h();
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
    // read her render'da yeni bir kapanış; bağımlılığa koymak sonsuz döngü olur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** [tüm konular açık mı, değiştir] */
export function useTestUnlock(): [boolean, (active: boolean) => void] {
  return [useFlag(isTestUnlockActive), setTestUnlockActive];
}

/** [debug göstergeleri açık mı, değiştir] */
export function useDebugMode(): [boolean, (active: boolean) => void] {
  return [useFlag(isDebugActive), setDebugActive];
}

/** Panel açık mı (kod girildi mi) */
export function useTestPanel(): boolean {
  return useFlag(isTestPanelOpen);
}
