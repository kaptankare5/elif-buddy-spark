/**
 * HARF ADI BEKÇİSİ — ekranda yazan ad, hocanın SÖYLEDİĞİ adla aynı olmalı.
 *
 * ⚠️ NEDEN TEST: uygulama ط'ya "Tı", ظ'ya "Zı" yazıyordu; hocanın kaydı ise
 * "ta" ve "za" diyor. Kullanıcı bunu kulakla yakaladı ("tı zı falan yazıyor,
 * hepsinin ta za yazması gerek"), `tools/ses/adlar.py` ÖLÇEREK doğruladı:
 * harf ADI kaydının ünlü çekirdeği, AYNI harfin harekeli kayıtlarıyla
 * karşılaştırıldığında ط için üstün/"a" çıkıyor (d=0.084, ikincisi 0.213),
 * ظ için yine "a" (d=0.031, ikincisi 0.167). 28 harfin 23'ü zaten tutuyordu.
 *
 * Yazı ile ses ayrı şey söylerse soru ölçmek istediğini ÖLÇMEZ: çocuk sesi
 * duyup yazılı şıktan seçiyor, "ta" duyup "Tı" yazan şıkkı eliyor.
 *
 * Literatür de bu yönde: DİA "HARF" maddesi harfleri klasik Arapça adlarıyla
 * sayıyor (bâ', tâ', s̱â', ḥâ', ḫâ', ṭâ', ẓâ', fâ', yâ'), Arap alfabesi
 * listeleri de "...sad, dad, ta, za, ayn, gayn..." diye yazıyor. "Tı/Zı"
 * yazımı elifbâ cüzü geleneğinde var ama bu uygulamanın SESİ onu demiyor.
 */
import { describe, it, expect } from "vitest";
import { getAllTopics } from "@/data/subjects";

/** `tools/ses/adlar.py` ile doğrulanmış ad tablosu. Değiştirmeden ÖNCE ölç. */
const ADLAR = [
  "Elif", "Be", "Te", "Se", "Cim", "Ha", "Hı", "Dal", "Zel", "Ra",
  "Ze", "Sin", "Şin", "Sad", "Dad", "Ta", "Za", "Ayn", "Ğayn", "Fe",
  "Gaf", "Kef", "Lem", "Mim", "Nun", "Vev", "He", "Ye",
];

/**
 * Kalın/râ kovasındaki harfin adı "a" ünlüsünü taşır — hoca da öyle söylüyor.
 * (Ölçüt SON HARF değil SON ÜNLÜ: "Sad" · "Gaf" · "Ğayn" da bu kurala uyar.)
 * ⚠️ TEK İSTİSNA خ: kaydı "ha" diyor ama ح zaten "Ha". İkisine aynı adı
 * yazmak sorunun İKİ doğru cevabı olması demek (yazılı şıkta ayırt edilemez),
 * o yüzden ekranda Diyanet Elifbâ'nın adı olan "Hı" kalıyor.
 */
const KALIN_ADLAR = ["Ha", "Ra", "Sad", "Dad", "Ta", "Za", "Ayn", "Ğayn", "Gaf"];

/** Bir adın SON ünlüsü — "Sad" → a, "Hı" → ı, "Kef" → e. */
const sonUnlu = (s: string) =>
  [...s.toLowerCase()].reverse().find((c) => "aeıioöuü".includes(c)) ?? "?";

const harfler = getAllTopics().find((t) => t.id === "harfler")!;

describe("harf adları", () => {
  it("28 harfin adı ölçülmüş tabloyla birebir aynı", () => {
    expect(harfler.items.map((i) => i.label)).toEqual(ADLAR);
  });

  /**
   * ⚠️ İKİ HARF AYNI ADI TAŞIYAMAZ: yazılı şık modlarında (Şimşek, Tabela,
   * Kutu Boşalt) şıklar harf ADIDIR. Aynı ad iki şıkta çıkarsa soru iki
   * doğru cevaplı olur ve doğru okuyan çocuk yanlış sayılır.
   */
  it("hiçbir ad tekrar etmiyor", () => {
    const adlar = harfler.items.map((i) => i.label);
    const tekrar = adlar.filter((a, i) => adlar.indexOf(a) !== i);
    expect(tekrar, `aynı adı taşıyan harfler: ${tekrar.join(", ")}`).toEqual([]);
  });

  it("kalın harflerin adı 'a' ünlüsünü taşır (خ istisnası hariç)", () => {
    const bozuk = KALIN_ADLAR.filter((a) => sonUnlu(a) !== "a");
    expect(bozuk, `kalın harf adının son ünlüsü 'a' olmalı: ${bozuk.join(", ")}`).toEqual([]);
    // İstisna gerçekten istisna kalsın: خ hâlâ "Hı", ح hâlâ "Ha" olmalı.
    expect(harfler.items[5].label).toBe("Ha");
    expect(harfler.items[6].label).toBe("Hı");
  });

  /** TTS yedeği ekranda yazandan başka bir şey söylememeli. */
  it("okunuş (speech) ile yazılı ad aynı ünlüyle biter", () => {
    const bozuk = harfler.items
      .filter((i) => i.label !== "Ğayn") // "Ğayn" ↔ TTS "gayın": aynı kelime, yazımı farklı
      .filter((i) => sonUnlu(i.label) !== sonUnlu(i.speech ?? ""))
      .map((i) => `${i.label} ↔ ${i.speech}`);
    expect(bozuk, `yazı ile TTS ayrı ünlü: ${bozuk.join(", ")}`).toEqual([]);
  });
});
