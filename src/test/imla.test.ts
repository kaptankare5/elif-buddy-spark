/**
 * İMLÂ BEKÇİSİ — çocuğun EKRANDA gördüğü her Arapça metin Türkiye (Diyanet)
 * mushafı yazımına uymalı.
 *
 * ⚠️ NEDEN TEST: kartlar bir dönem Medine imlâsıyla yazılmıştı ve kullanıcı
 * fark etti: "4 elif uzatma var, fethası yok". Sebep `آ` (U+0622) idi — tek
 * kod noktası hem elifi hem uzatmayı taşıdığı için fetha gliften kayboluyordu.
 * Aynı dosyada `أُولٰٓئِكَ` gibi kelime başı hemzeler de vardı; Türk
 * mushafında kelime başı hemze ÇİZİLMEZ.
 *
 * Kurallar (kaynak: kuran.diyanet.gov.tr metni):
 *   1. `آ` (U+0622) HİÇ kullanılmaz. Uzatma, önceki harfin harekesinden
 *      sonra gelen `ٓ` (U+0653) ile yazılır: `حَٓاجُّوكَ`. Kelime başı "â"
 *      ise elif + hançer elif: `اٰمَنَ`.
 *   2. KELİME BAŞINDA `أ` / `إ` çizilmez → `اَنْعَمْتَ` · `فَاِنَّ`.
 *      ⚠️ Kelime içinde/sonunda ÇİZİLİR (`الْمَلَأُ` · `اِقْرَأْ`) — kural
 *      "hemze hiç yok" DEĞİL, o yüzden test konuma bakıyor.
 *   3. Noktasız `ى` yalnız hançer eliften sonra (`وَتَعَالٰى`); uzatma yâsı
 *      mushafta hep noktalı (`ف۪ي` · `بِي`).
 *   4. `ٓ` bir harfin üstüne doğrudan gelmez, HAREKENİN ardından gelir.
 *   5. MED YÂSININ ÖNÜNDEKİ ESRE KÜÇÜKTÜR: `ب۪ي` (`بِي` değil) — الرَّح۪يمِ ·
 *      ف۪ي · اَلَّذ۪ي · الْعَالَم۪ينَ. İKİ İSTİSNA var, ikisi de gerçek:
 *      · Yâ KENDİ harekesini taşıyorsa med yâsı değil ÜNSÜZDÜR, normal esre
 *        doğrudur: `اِيَّاكَ` · `وَجْهِيَ`.
 *      · ⚠️ UZATMA DÜŞÜYORSA da normal esre yazılır. Med harfi sâkinle
 *        karşılaşınca okunmaz: Felak 4 mushafta `فِي الْعُقَدِ` (fil-ukad)
 *        diye NORMAL esreyle yazılı, ama Nâs 6 `ف۪ي صُدُورِ` küçük esreyle.
 *        Aynı kelime, iki ayrı yazım — sebebi sonraki kelimenin sâkin
 *        başlaması. Bu yüzden kural, yâdan sonra BOŞLUK varsa karışmaz:
 *        sonraki kelimeyi bilmeden karar verilemez.
 */
import { describe, it, expect } from "vitest";
import { getAllTopics } from "@/data/subjects";
import { SURAS } from "@/data/ezber";

const HAREKE = new Set(["ً", "ٌ", "ٍ", "َ", "ُ", "ِ", "ّ", "ْ", "ٰ"]);
const ARAPCA = /[؀-ۿ]/;

/** Bir metnin ihlal ettiği kuralları döndürür (boş dizi = temiz). */
export function imlaHatalari(t: string): string[] {
  const h: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const onceki = i > 0 ? t[i - 1] : " ";
    if (c === "آ") h.push("آ (U+0622) — uzatma ٓ ile yazılmalı");
    if ((c === "أ" || c === "إ") && (i === 0 || onceki === " "))
      h.push(`kelime başı hemze ${c} — düz elif + hareke olmalı`);
    if (c === "ى" && onceki !== "ٰ")
      h.push("noktasız ى — uzatma yâsı noktalı olmalı");
    if (c === "ٓ" && !HAREKE.has(onceki))
      h.push("ٓ harekeden sonra gelmeli");
    if (c === "ي" && onceki === "ِ") {
      const sonraki = i + 1 < t.length ? t[i + 1] : "";
      // Hareke → yâ ünsüzdür (اِيَّاكَ). Boşluk → uzatma düşmüş olabilir
      // (فِي الْعُقَدِ). İkisi de kural dışı; bkz. yukarıdaki istisnalar.
      if (!HAREKE.has(sonraki) && sonraki !== " ")
        h.push("med yâsının esresi KÜÇÜK olmalı (ب۪ي)");
    }
  }
  return h;
}

/** Ekranda görünen bütün Arapça metinler. */
function ekrandakiMetinler(): Array<[string, string]> {
  const liste: Array<[string, string]> = [];
  for (const t of getAllTopics()) {
    if (ARAPCA.test(t.emoji ?? "")) liste.push([`konu rozeti: ${t.id}`, t.emoji!]);
    for (const it of t.items) {
      for (const alan of [it.emoji, it.subLabel, it.label]) {
        if (typeof alan === "string" && ARAPCA.test(alan)) liste.push([`${t.id}/${it.id}`, alan]);
      }
    }
  }
  for (const s of SURAS) {
    for (const g of s.segments) liste.push([`ezber ${s.id}/${g.id}`, g.ar]);
  }
  return liste;
}

describe("imlâ — Türkiye (Diyanet) mushafı", () => {
  const metinler = ekrandakiMetinler();

  it("taranacak metin var (veri boş dönmüyor)", () => {
    expect(metinler.length).toBeGreaterThan(300);
  });

  /**
   * ⚠️ KODLAMA DA MUSHAFLA AYNI OLMALI (NFC). Unicode kanonik sırası hareke →
   * şedde; Diyanet metni de öyle kodlanmış (`الضَّٓالّ۪ينَ`). Şedde kartları
   * ters sırada üretiliyordu (şedde → hareke). Ekranda fark YOK (iki kodlama
   * piksel piksel aynı çiziliyor, ölçüldü) ama dizgiler eşit olmadığı için
   * karşılaştırma, arama ve tekrar-eleme sessizce tutmuyor.
   */
  it("bütün metin NFC ile kodlanmış (mushafla aynı sıra)", () => {
    const bozuk = metinler
      .filter(([, t]) => t !== t.normalize("NFC"))
      .map(([yer, t]) => `${yer}: "${t}"`);
    expect(bozuk, `NFC dışı kodlama:\n${bozuk.join("\n")}`).toEqual([]);
  });

  it("hiçbir kartta kural ihlali yok", () => {
    const kotu = metinler
      .map(([yer, t]) => [yer, t, imlaHatalari(t)] as const)
      .filter(([, , h]) => h.length > 0)
      .map(([yer, t, h]) => `${yer}: "${t}" → ${[...new Set(h)].join(", ")}`);
    expect(kotu, `İmlâ ihlali:\n${kotu.join("\n")}`).toEqual([]);
  });

  /** Kuralın kendisi de test edilir — bekçi körse hiçbir şeyi korumaz. */
  it("kural motoru gerçekten yakalıyor", () => {
    expect(imlaHatalari("آمَنَ").length, "آ yakalanmalı").toBeGreaterThan(0);
    expect(imlaHatalari("أُولٰٓئِكَ").length, "kelime başı hemze yakalanmalı").toBeGreaterThan(0);
    expect(imlaHatalari("بِى").length, "noktasız ى yakalanmalı").toBeGreaterThan(0);
    expect(imlaHatalari("بِي").length, "büyük esreli med yâsı yakalanmalı").toBeGreaterThan(0);
    // Doğru yazımlar temiz geçmeli:
    expect(imlaHatalari("اٰمَنَ")).toEqual([]);
    expect(imlaHatalari("حَٓاجُّوكَ")).toEqual([]);
    expect(imlaHatalari("الْمَلَأُ"), "kelime SONU hemze serbest").toEqual([]);
    expect(imlaHatalari("وَتَعَالٰى"), "hançer eliften sonra ى serbest").toEqual([]);
    expect(imlaHatalari("ب۪ي"), "küçük esreli med yâsı doğru").toEqual([]);
    expect(imlaHatalari("اِيَّاكَ"), "yâ ünsüzse normal esre doğru").toEqual([]);
    expect(imlaHatalari("فِي الْعُقَدِ"), "uzatma düşüyorsa normal esre doğru").toEqual([]);
  });
});
