/**
 * KALICILIK KAPSAMI — "her oyun oturumdan oturuma iz bırakıyor" bekçisi.
 *
 * ⚠️ NEDEN TEST: kalıcılık paketi 15 oyunun hepsini kapsayacaktı ama üçü
 * dışarıda kaldı — Kutu Boşalt'ta `useOyunSonu` İMPORT EDİLMİŞ ama hiç
 * ÇAĞRILMAMIŞTI (ölü import, eslint yakalamıyor), Üçlü Eşle ve Yapboz'da
 * hiç yoktu. Sonuç yalnız "rekor yok" değildi: GÜNLÜK SERİYİ de yalnız
 * `oyunBitti` besliyor, dolayısıyla o oyunları oynayan çocuğun serisi hiç
 * ilerlemiyordu.
 *
 * ⚠️ Bölüm tabanlı oyunlar (Macera, Parti) rekor yerine YILDIZ yazıyor;
 * seriyi `setYildiz` besliyor. Bu yüzden test iki yolu da kabul eder.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { oyunBitti, getOyunKaydi } from "@/lib/oyunSonucu";
import { siparisAc, siparisIsle, SIPARIS_SABIR, SIPARIS_ADET } from "@/lib/siparis";
import { setYildiz, getYildiz } from "@/lib/bolumYildiz";
import type { ContentItem } from "@/data/types";

const DIZIN = join(process.cwd(), "src/pages/games");
const YARDIMCI = new Set(["_shared.ts", "_askUI.tsx", "_letterTexture.ts", "_perf.ts"]);

describe("kalıcılık kapsamı", () => {
  const dosyalar = readdirSync(DIZIN).filter((f) => f.endsWith(".tsx") && !YARDIMCI.has(f));

  it.each(dosyalar)("%s oturum sonunu kaydediyor", (dosya) => {
    const kaynak = readFileSync(join(DIZIN, dosya), "utf8");
    // ÇAĞRI aranıyor, import değil: ölü import tam olarak bu yüzden gözden kaçtı.
    const kayit = /\b(useOyunSonu|oyunBitti)\s*\(/.test(kaynak);
    const yildiz = /\bsetYildiz\s*\(/.test(kaynak);
    expect(kayit || yildiz, `${dosya} ne rekor ne yıldız yazıyor — seri de beslenmez`).toBe(true);
  });
});

describe("oyun rekoru", () => {
  beforeEach(() => localStorage.clear());

  it("ilk oyunda rekor YAZILMAZ", () => {
    const r = oyunBitti("t-ilk", 10);
    expect(r.rekor).toBe(false);
    expect(r.oncekiEnIyi).toBeNull();
  });

  it("yüksek yönde daha iyi skor rekor kırar", () => {
    oyunBitti("t-yuksek", 10);
    const r = oyunBitti("t-yuksek", 12);
    expect(r.rekor).toBe(true);
    expect(r.oncekiEnIyi).toBe(10);
    expect(getOyunKaydi("t-yuksek")!.enIyi).toBe(12);
  });

  it("düşük yönde AZ olan iyidir", () => {
    oyunBitti("t-dusuk", 20, { yon: "dusuk", birim: "hamle" });
    const r = oyunBitti("t-dusuk", 14, { yon: "dusuk", birim: "hamle" });
    expect(r.rekor).toBe(true);
    expect(getOyunKaydi("t-dusuk")!.enIyi).toBe(14);
    // Kötü skor rekoru bozmaz.
    oyunBitti("t-dusuk", 40, { yon: "dusuk", birim: "hamle" });
    expect(getOyunKaydi("t-dusuk")!.enIyi).toBe(14);
  });

  /**
   * ⚠️ ASIL TUZAK: Hafıza'nın rekoru "en az hamle"den "en çok tahta"ya
   * geçti. Eski kayıt aynı anahtarda kalırsa 6 HAMLElik rekor, yeni ölçekte
   * "6 tahta" diye okunup çocuktan 7 tahta ister — kırılması imkânsız bir
   * rekor. Ölçek değişince kayıt sıfırdan başlamalı.
   */
  it("ölçek (yön/birim) değişince eski rekor sayılmaz", () => {
    oyunBitti("t-olcek", 6, { yon: "dusuk", birim: "hamle" });
    const r = oyunBitti("t-olcek", 1, { yon: "yuksek", birim: "tahta" });
    expect(r.oncekiEnIyi).toBeNull();
    expect(r.rekor).toBe(false);
    expect(getOyunKaydi("t-olcek")!.enIyi).toBe(1);
    expect(getOyunKaydi("t-olcek")!.birim).toBe("tahta");
    // Aynı ölçekte devam edince normal çalışır.
    expect(oyunBitti("t-olcek", 2, { yon: "yuksek", birim: "tahta" }).rekor).toBe(true);
  });
});

describe("sipariş", () => {
  const it_ = (id: string): ContentItem =>
    ({ id, label: id, arabic: id, emoji: "🔤" } as unknown as ContentItem);
  const adaylar = [it_("a"), it_("b"), it_("c")];

  it("hedefi tutturmak siparişi tamamlar ve yenisini açar", () => {
    let s = siparisAc(adaylar)!;
    expect(s.kalan).toBe(SIPARIS_ADET);
    for (let i = 0; i < SIPARIS_ADET; i++) s = siparisIsle(s, s.hedef.id, adaylar).siparis!;
    expect(s.kalan).toBe(SIPARIS_ADET); // yeni sipariş
  });

  /**
   * ⚠️ SABIR EŞLEŞMEYLE SAYILIR, HAMLEYLE DEĞİL (alan adı `eslesme`):
   * `siparisIsle` yalnız bir eşleşme olduğunda çağrılıyor. Çocuk aradığını
   * bulamazsa sipariş kendiliğinden dönmeli — çıkmaz sokak yok.
   */
  it("tutmayan sipariş SABIR eşleşmede kendiliğinden döner", () => {
    const hedef = adaylar[0];
    let s = { hedef, kalan: SIPARIS_ADET, eslesme: 0 };
    for (let i = 0; i < SIPARIS_SABIR - 1; i++) {
      s = siparisIsle(s, "b", adaylar).siparis!;
      expect(s.hedef.id).toBe(hedef.id);
    }
    const son = siparisIsle(s, "b", adaylar);
    expect(son.siparis!.hedef.id).not.toBe(hedef.id);
    expect(son.siparis!.eslesme).toBe(0);
  });
});

describe("bölüm yıldızı", () => {
  beforeEach(() => localStorage.clear());

  it("yıldız GERİYE gitmez", () => {
    setYildiz("platform", 3, 3);
    setYildiz("platform", 3, 1);
    expect(getYildiz("platform", 3)).toBe(3);
  });

  /**
   * ⚠️ Macera ve Parti rekor katmanını hiç çağırmıyor; seriyi de yalnız
   * `oyunBitti` besliyordu. Sonuç: bütün gün Macera oynayan çocuğun günlük
   * serisi HİÇ ilerlemiyordu (normal modda oyun cevabı SRS'e de yazılmıyor).
   * Bölüm bitirmek "bugün oynadım"dır — kötü bitirse bile.
   */
  it("bölüm bitirmek günlük seriyi besler (yıldız daha kötü olsa bile)", async () => {
    setYildiz("party", 1, 3);
    localStorage.removeItem("elifba-streak-v1");
    setYildiz("party", 1, 1); // erken dönüş dalı — yine de seri işlemeli
    await new Promise((r) => setTimeout(r, 30)); // dinamik import
    const seri = JSON.parse(localStorage.getItem("elifba-streak-v1") || "null");
    expect(seri, "bölüm bitti ama seri beslenmedi").not.toBeNull();
    expect(seri.count).toBeGreaterThan(0);
  });
});

/**
 * ⚠️ OYUNU KODDAN SİLMEK ÇOCUĞUN CİHAZINDAKİ REKORU SİLMEZ. Kayıtlar tek bir
 * sözlükte oyun id'siyle duruyor; oyun listeden kalkınca o girdiyi kimse
 * okumuyor ama sonsuza kadar orada kalıyor. Kullanıcı İki Yol Koşusu'nu
 * silerken "tüm verileri" dedi — `KALDIRILAN` kümesi okuma sırasında bir kez
 * ayıklıyor, ayrı bir göç adımı gerekmiyor.
 */
describe("kaldırılan oyunun verisi", () => {
  const KEY = "elifba-oyun-sonuc-v1";

  it("kaldırılan oyunun kaydı okumada siliniyor", () => {
    localStorage.setItem(KEY, JSON.stringify({
      lane: { enIyi: 120, yon: "yuksek", oynama: 7, son: 1, birim: "puan" },
      snake: { enIyi: 9, yon: "yuksek", oynama: 2, son: 1, birim: "puan" },
    }));
    // Herhangi bir okuma ayıklamayı tetikler.
    expect(getOyunKaydi("lane"), "kaldırılan oyunun kaydı hâlâ okunuyor").toBeNull();
    const kalan = JSON.parse(localStorage.getItem(KEY) || "{}");
    expect("lane" in kalan, "kayıt localStorage'da duruyor").toBe(false);
    // ⚠️ Yalnız kaldırılanı siler — ötekiler duruyor.
    expect(kalan.snake?.enIyi, "duran oyunun kaydı da silinmiş").toBe(9);
  });

  it("İki Yol Koşusu koddan tamamen kalkmış", () => {
    const dosyalar = readdirSync(join(process.cwd(), "src/pages/games"));
    expect(dosyalar.includes("LaneRunnerGame.tsx"), "oyun dosyası duruyor").toBe(false);
    for (const yol of ["src/pages/Game.tsx", "src/pages/Games.tsx", "src/lib/gameMode.ts"]) {
      const src = readFileSync(join(process.cwd(), yol), "utf8");
      expect(/["']lane["']/.test(src), `${yol} hâlâ "lane" oyununa bakıyor`).toBe(false);
    }
  });
});
