/**
 * MOBİL OYUN HİSSİ — telefonda oyunun yarısı olan, masaüstünde HİÇ
 * görünmeyen katman. Uygulama Capacitor ile mağazaya çıkacak.
 *
 * Üç bekçi:
 *  1. Dokunma gecikmesi — `click` parmağın KALKMASINI bekler. Dokunmayla
 *     oynanan oyunlarda ya `pointerdown` ya da en azından `:active` basılma
 *     tepkisi olmalı, yoksa çocuk bastığında hiçbir şey olmuyor gibi hissediyor.
 *  2. Titreşim — `navigator.vibrate` iOS'ta YOK; Capacitor Haptics köprüsü
 *     varsa oraya gitmeli (yoksa iPhone'da bütün dokunsal katman kayıp).
 *  3. Hareket duyarlılığı — benzetim baş dönmesi insanların üçte birine kadarını
 *     etkiliyor; "hareketi azalt" diyen cihazda sarsıntı kısılmalı.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { oyunDosyalari } from "./_oyunDosyalari";
import { createSarsinti, hareketKatsayisi, __resetHareket } from "@/lib/gameFeel";
import { titre, setTitresimAcik } from "@/lib/titresim";

const DIZIN = join(process.cwd(), "src/pages/games");

describe("dokunma tepkiselliği", () => {
  const dosyalar = oyunDosyalari();

  /**
   * ⚠️ İKİ KABUL EDİLEN YOL:
   *  · `onPointerDown` — cevap SAYILMAYAN dokunuşlar için (kart çevirme,
   *    taş seçme). Basma anında iş yapar.
   *  · `active:` sınıfı — cevap SAYILAN dokunuşlar için. Commit `click`te
   *    kalır (kaydırırken kazara cevap verilmesin) ama `:active` parmak
   *    değdiği an tetiklendiği için tepki yine anında görünür.
   */
  it.each(dosyalar)("%s dokunmaya ANINDA tepki veriyor", (dosya) => {
    const kaynak = readFileSync(join(DIZIN, dosya), "utf8");
    const aninda = /onPointerDown=/.test(kaynak) || /\bactive:/.test(kaynak);
    expect(aninda, `${dosya}: ne onPointerDown ne de active: basılma tepkisi var`).toBe(true);
  });
});

describe("titreşim — Capacitor Haptics köprüsü", () => {
  const w = globalThis as unknown as {
    Capacitor?: unknown;
    navigator: Navigator & { vibrate?: unknown };
  };
  const gercekVibrate = w.navigator.vibrate;

  beforeEach(() => {
    localStorage.clear();
    setTitresimAcik(true);
  });
  afterEach(() => {
    delete w.Capacitor;
    w.navigator.vibrate = gercekVibrate;
  });

  it("Capacitor yokken navigator.vibrate kullanılır (tarayıcı yolu)", () => {
    const vib = vi.fn();
    w.navigator.vibrate = vib;
    titre("sert");
    expect(vib).toHaveBeenCalled();
  });

  /**
   * ⚠️ ASIL KANIT: iOS'ta `navigator.vibrate` HİÇ YOK. Capacitor köprüsü
   * varsa titreşim oraya gitmeli — gitmezse iPhone'da bütün dokunsal geri
   * bildirim sessizce kaybolur.
   */
  it("Capacitor varken Haptics köprüsüne gider, vibrate'e DEĞİL", () => {
    const impact = vi.fn().mockResolvedValue(undefined);
    const notification = vi.fn().mockResolvedValue(undefined);
    const vib = vi.fn();
    w.navigator.vibrate = vib;
    w.Capacitor = { isNativePlatform: () => true, Plugins: { Haptics: { impact, notification } } };

    titre("hafif");
    expect(impact).toHaveBeenCalledWith({ style: "LIGHT" });
    titre("sert");
    expect(impact).toHaveBeenCalledWith({ style: "HEAVY" });
    titre("basari");
    expect(notification).toHaveBeenCalledWith({ type: "SUCCESS" });
    titre("hata");
    expect(notification).toHaveBeenCalledWith({ type: "ERROR" });
    expect(vib, "native ortamda tarayıcı yoluna düşülmemeli").not.toHaveBeenCalled();
  });

  it("eklenti kayıtlı değilse sessizce tarayıcı yoluna düşer", () => {
    const vib = vi.fn();
    w.navigator.vibrate = vib;
    w.Capacitor = { isNativePlatform: () => true, Plugins: {} };   // Haptics yok
    expect(() => titre("orta")).not.toThrow();
    expect(vib).toHaveBeenCalled();
  });

  it("titreşim kapalıyken hiçbir yola gitmez", () => {
    const impact = vi.fn();
    const vib = vi.fn();
    w.navigator.vibrate = vib;
    w.Capacitor = { isNativePlatform: () => true, Plugins: { Haptics: { impact } } };
    setTitresimAcik(false);
    titre("sert");
    expect(impact).not.toHaveBeenCalled();
    expect(vib).not.toHaveBeenCalled();
  });
});

describe("hareket duyarlılığı (prefers-reduced-motion)", () => {
  const gercekMM = window.matchMedia;
  afterEach(() => { window.matchMedia = gercekMM; });

  const azalt = (reduce: boolean) => {
    __resetHareket();   // önbellekteki eski sorgu nesnesini at
    window.matchMedia = ((q: string) => ({
      matches: reduce && q.includes("reduce"),
      media: q, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  };

  it("varsayılanda tam genlik", () => {
    azalt(false);
    expect(hareketKatsayisi()).toBe(1);
  });

  /**
   * ⚠️ SIFIR DEĞİL, KISIK: geri bildirim tamamen kaybolursa oyun "tepki
   * vermiyor" hissi veriyor. Genlik dörtte bire iniyor.
   */
  it("hareket azaltma isteğinde sarsıntı KISILIR ama yok olmaz", () => {
    azalt(true);
    const k = hareketKatsayisi();
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);

    const s = createSarsinti(10);
    s.ekle(1);
    s.guncelle(0.0001);
    const kisik = Math.abs(s.ofset().x);

    azalt(false);
    const t = createSarsinti(10);
    t.ekle(1);
    t.guncelle(0.0001);
    const tam = Math.abs(t.ofset().x);

    expect(kisik).toBeGreaterThan(0);
    expect(kisik).toBeLessThan(tam);
  });
});
