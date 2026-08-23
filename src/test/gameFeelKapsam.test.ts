/**
 * GÖRSEL OYUN HİSSİ KAPSAMI — "her oyunda GÖZLE görülen geri bildirim var".
 *
 * ⚠️ NEDEN TEST: ses katmanı (`juiceKapsam.test.ts`) 15 oyunun hepsine
 * yayılmıştı ama görsel taraf boştu. `SARSINTI_SINIFI` dışa aktarılmıştı ve
 * HİÇBİR oyun onu kullanmıyordu — ölü kod. Oyunlar doğru çalışıyor ama
 * "tokat" atmıyordu: çarpma, patlama, eşleşme, iniş… hepsi sessiz birer
 * durum değişikliğiydi.
 *
 * Kabul edilen mekanizmalar (tür oyuna göre değişir, biri yeterli):
 *  · `useSarsinti` / `createSarsinti`  — ekran sarsıntısı (travma modeli)
 *  · `createHitstop`                   — donma karesi
 *  · `ezilmeUzama`                     — ezilme-uzama
 *  · `animate-juice-pop` / `animate-juice-shake` — CSS darbeleri
 *  · `camera.fov`                      — hıza bağlı görüş açısı (3B)
 *  · kendi tanımlı `@keyframes`         — oyuna özel darbe animasyonu
 *
 * ⚠️ Test ÇAĞRIYI arar, import'u değil: kalıcılık paketinde tam olarak bu
 * hata olmuştu (Kutu Boşalt'ta `useOyunSonu` import edilmiş ama hiç
 * çağrılmamıştı; eslint ölü import'u yakalamıyor).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createSarsinti, createHitstop, ezilmeUzama, createZiplamaYardimi,
  createParcaciklar, damp, easeOutBack, HIS, INIS_SURE,
} from "@/lib/gameFeel";

const DIZIN = join(process.cwd(), "src/pages/games");
const YARDIMCI = new Set(["_shared.ts", "_askUI.tsx", "_letterTexture.ts", "_perf.ts"]);

/** Görsel geri bildirim sayılan kalıplar — biri bile yeterli. */
const KALIPLAR: Array<[string, RegExp]> = [
  ["ekran sarsıntısı", /\b(useSarsinti|createSarsinti)\s*\(/],
  ["donma karesi", /\bcreateHitstop\s*\(/],
  ["ezilme-uzama", /\bezilmeUzama\s*\(/],
  ["CSS darbesi", /animate-juice-(pop|shake)/],
  ["görüş açısı (FOV)", /camera\.fov/],
  ["kendi animasyonu", /@keyframes/],
];

describe("görsel oyun hissi kapsamı", () => {
  const dosyalar = readdirSync(DIZIN).filter((f) => f.endsWith(".tsx") && !YARDIMCI.has(f));

  it("taranacak oyun var", () => {
    expect(dosyalar.length).toBeGreaterThanOrEqual(15);
  });

  it.each(dosyalar)("%s görsel geri bildirim veriyor", (dosya) => {
    const kaynak = readFileSync(join(DIZIN, dosya), "utf8");
    const bulunan = KALIPLAR.filter(([, re]) => re.test(kaynak)).map(([ad]) => ad);
    expect(
      bulunan.length,
      `${dosya} hiçbir görsel geri bildirim kullanmıyor — sarsıntı, donma, ` +
      `ezilme, CSS darbesi, FOV ya da kendi animasyonundan biri olmalı`,
    ).toBeGreaterThan(0);
  });

  /**
   * ⚠️ `SARSINTI_SINIFI` bir dönem dışa aktarılmış ama HİÇ kullanılmamıştı.
   * Ortak katmanın yeniden ölü koda dönüşmemesi için en az birkaç oyunun
   * gerçekten sarsıldığını doğruluyoruz.
   */
  it("sarsıntı ölü kod değil — birden çok oyun kullanıyor", () => {
    const kullanan = dosyalar.filter((f) =>
      /\b(useSarsinti|createSarsinti)\s*\(/.test(readFileSync(join(DIZIN, f), "utf8")));
    expect(kullanan.length, "sarsıntıyı kullanan oyun sayısı").toBeGreaterThanOrEqual(8);
  });
});

describe("gameFeel — sarsıntı (travma modeli)", () => {
  it("travma yokken kayma da yok", () => {
    const s = createSarsinti(10);
    expect(s.ofset()).toEqual({ x: 0, y: 0, rot: 0 });
  });

  it("travma eklenince sarsılır ve zamanla söner", () => {
    const s = createSarsinti(10);
    s.ekle(1);
    s.guncelle(0.016);
    const o = s.ofset();
    expect(Math.abs(o.x) + Math.abs(o.y)).toBeGreaterThan(0);
    s.guncelle(HIS.SARSINTI_SURE);           // tamamen sönmeli
    expect(s.travma).toBe(0);
    expect(s.ofset()).toEqual({ x: 0, y: 0, rot: 0 });
  });

  /**
   * ⚠️ MODELİN ÖZÜ: sarsıntı travmanın KARESİYLE ölçeklenir. Doğrusal olsaydı
   * küçük olaylar (iniş) gözü tırmalar, büyük olaylar (çarpma) yeterince
   * ayrışmazdı. Yarım travma, dörtte bir genlik vermeli.
   */
  it("genlik travmanın KARESİYLE ölçeklenir", () => {
    const tam = createSarsinti(10); tam.ekle(1);
    const yari = createSarsinti(10); yari.ekle(0.5);
    // Aynı iç zamanda ölçmek için ikisini de aynı adımla ilerlet.
    tam.guncelle(0.0001); yari.guncelle(0.0001);
    const a = Math.abs(tam.ofset().x), b = Math.abs(yari.ofset().x);
    expect(b).toBeGreaterThan(0);
    expect(a / b).toBeCloseTo(4, 0);        // (1/0.5)² = 4
  });

  it("travma 1'i aşmaz (üst üste olaylar patlamaz)", () => {
    const s = createSarsinti(10);
    for (let i = 0; i < 20; i++) s.ekle(0.5);
    expect(s.travma).toBe(1);
  });
});

describe("gameFeel — donma karesi", () => {
  it("vurulmadan dt aynen geçer", () => {
    const h = createHitstop();
    expect(h.suz(0.016)).toBe(0.016);
    expect(h.donuk).toBe(false);
  });

  /**
   * ⚠️ DONMA OYUNU DURDURUR: `suz` 0 döndürdüğü sürece oyun adımı hiç
   * ilerlemez. Süre dolunca kendiliğinden çözülmeli — yoksa oyun kilitlenir.
   */
  it("vuruş oyunu durdurur ve süre dolunca kendiliğinden çözülür", () => {
    const h = createHitstop();
    h.vur(0.07);
    expect(h.suz(0.02)).toBe(0);
    expect(h.donuk).toBe(true);
    h.suz(0.05);                       // toplam 0.07 tüketildi
    expect(h.donuk).toBe(false);
    expect(h.suz(0.016)).toBe(0.016);  // oyun geri döndü
  });

  it("üst üste vuruş süreyi kısaltmaz (en uzunu kalır)", () => {
    const h = createHitstop();
    h.vur(0.1);
    h.vur(0.02);
    h.suz(0.05);
    expect(h.donuk, "kısa vuruş uzun donmayı iptal etmemeli").toBe(true);
  });
});

describe("gameFeel — ezilme-uzama", () => {
  it("hacim korunur (sx * sy ≈ 1)", () => {
    for (const vy of [-800, -200, 0, 300, 900]) {
      const { sx, sy } = ezilmeUzama(vy, 1000);
      expect(sx * sy).toBeGreaterThan(0.9);
      expect(sx * sy).toBeLessThan(1.12);
    }
  });

  it("inişte EZİLİR (geniş + basık), sonra yerine döner", () => {
    const an = ezilmeUzama(0, 1000, 0);
    expect(an.sx, "iniş anında yatayda genişlemeli").toBeGreaterThan(1);
    expect(an.sy, "iniş anında dikeyde basılmalı").toBeLessThan(1);
    const sonra = ezilmeUzama(0, 1000, INIS_SURE + 0.01);
    expect(sonra.sx).toBeCloseTo(1, 1);
    expect(sonra.sy).toBeCloseTo(1, 1);
  });
});

describe("gameFeel — zıplama yardımı", () => {
  /**
   * ⚠️ ÜÇ HİLE DE "ADALETSİZ" AMA DOĞRU HİSSETTİRİR. Sekmeli zaman insanın
   * tepki gecikmesiyle örtüşüyor (~100 ms); tamponsuz oyunda çocuk her
   * inişte bir zıplama kaybediyor.
   */
  it("sekmeli zaman: zeminden ayrıldıktan SONRA da zıplatır", () => {
    const z = createZiplamaYardimi();
    z.guncelle(0.016, true, false);            // zeminde, basmadı
    expect(z.guncelle(0.05, false, true), "havada ama coyote içinde").toBe(true);
  });

  it("sekmeli zaman dolunca artık zıplatmaz", () => {
    const z = createZiplamaYardimi();
    z.guncelle(0.016, true, false);
    z.guncelle(HIS.COYOTE + 0.02, false, false);
    expect(z.guncelle(0.016, false, true)).toBe(false);
  });

  it("tampon: havada basılan zıplama inişte tetiklenir", () => {
    const z = createZiplamaYardimi();
    z.guncelle(0.016, false, true);            // havada bastı — henüz zıplamaz
    expect(z.guncelle(0.05, true, false), "yere değince hatırlanmalı").toBe(true);
  });

  it("tampon süresi dolunca unutulur", () => {
    const z = createZiplamaYardimi();
    z.guncelle(0.016, false, true);
    z.guncelle(HIS.TAMPON + 0.05, false, false);
    expect(z.guncelle(0.016, true, false)).toBe(false);
  });

  /** İniş çıkıştan hızlı; tepede ise yerçekimi AZALIR (asılı kalma). */
  it("yerçekimi asimetrik: iniş > çıkış, tepe en hafif", () => {
    const z = createZiplamaYardimi();
    const cikis = z.yercekimiCarpani(-600);
    const tepe = z.yercekimiCarpani(0);
    const inis = z.yercekimiCarpani(600);
    expect(inis).toBeGreaterThan(cikis);
    expect(tepe).toBeLessThan(cikis);
  });
});

describe("gameFeel — yardımcılar", () => {
  it("damp kare hızından bağımsız: küçük adımlar büyük adımla aynı yere varır", () => {
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 100, 5, 1 / 60);
    for (let i = 0; i < 10; i++) b = damp(b, 100, 5, 1 / 10);
    expect(Math.abs(a - b), "30 fps ile 60 fps aynı takibi vermeli").toBeLessThan(0.5);
  });

  it("easeOutBack hedefi aşıp geri döner (pop hissi)", () => {
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
    const enBuyuk = Math.max(...Array.from({ length: 50 }, (_, i) => easeOutBack(0.5 + i / 100)));
    expect(enBuyuk, "yolda 1'i aşmalı").toBeGreaterThan(1);
  });

  it("parçacıklar üst sınırı aşmaz ve ömrü dolunca silinir", () => {
    const p = createParcaciklar(20);
    p.patlat(0, 0, 100, "#fff", { omur: 0.1 });
    expect(p.liste.length).toBeLessThanOrEqual(20);
    p.guncelle(1);
    expect(p.liste.length, "ömrü dolan parçacık kalmamalı").toBe(0);
  });
});

/**
 * KAMERA KONFORU — ufuk düz kalmalı, kamera oyuncuyu YANAL takip etmemeli.
 *
 * ⚠️ NEDEN TEST: Koşusu'nda kamera bir dönem oyuncunun x'ini %22 takip
 * ediyor ve şerit değişiminde yatıyordu. Kullanıcı bildirdi: "sağa sola
 * giderken kameranın oynaması gözü çok yoruyor". İki ayrı hata vardı:
 *  · Göz sahnedeki SABİT referansa tutunuyor; kamera sürekli kayınca o
 *    referans kayboluyor ve her şerit değişiminde yeniden odaklanmak
 *    gerekiyor.
 *  · UFUK EĞİLMESİ (roll) en güçlü vestibüler çakışma ekseni; sensör
 *    çakışması simüle edilen hareketin karmaşıklığıyla artıyor.
 * Şerit hissi artık KARAKTERİN yatışı/esnemesi ve sesiyle, hız hissi de
 * görüş açısı + kenar hız çizgileriyle veriliyor. Çarpma sarsıntısı KALDI
 * (kullanıcı onu beğendi) ama onun da dönme bileşeni sıfır.
 */
describe("kamera konforu", () => {
  const subway = readFileSync(join(DIZIN, "SubwayGame.tsx"), "utf8");

  it("Koşusu'nda ufuk DÜZ — kamera yatışı yok", () => {
    expect(/camera\.rotation\.z\s*=\s*0\s*;/.test(subway),
      "camera.rotation.z açıkça 0 olmalı (ufuk eğilmemeli)").toBe(true);
    // Şerit konumuna bağlı bir yatış geri gelmemeli: BÜTÜN atamaların sağ
    // tarafı tam olarak "0" olmalı (`\s*` boş eşleşebildiği için "sıfır
    // olmayan karakter" araması yanlış pozitif veriyordu).
    const atamalar = [...subway.matchAll(/camera\.rotation\.z\s*\+?=\s*([^;]+);/g)]
      .map((m) => m[1].trim());
    expect(atamalar, "kamera yatışı yeniden eklenmiş").toEqual(["0"]);
  });

  it("Koşusu'nda kamera oyuncuyu YANAL takip etmiyor", () => {
    const kurulum = subway.match(/camera\.position\.set\(([^)]*)\)/);
    expect(kurulum, "camera.position.set bulunamadı").not.toBeNull();
    const xArg = kurulum![1].split(",")[0];
    expect(/s\.x/.test(xArg), `kamera x'i oyuncuya bağlanmış: ${xArg}`).toBe(false);
    const bakis = subway.match(/camera\.lookAt\(([^)]*)\)/);
    expect(/s\.x/.test(bakis?.[1] ?? ""), "kamera bakışı oyuncuya bağlanmış").toBe(false);
  });

  /** Şerit hissi kaybolmasın: karakterin kendi yatışı ve esnemesi ŞART. */
  it("şerit değişimi karakterde okunuyor (yatış + esneme)", () => {
    expect(/g\.current\.rotation\.z\s*=/.test(subway), "karakter yatışı yok").toBe(true);
    expect(/g\.current\.scale\.set/.test(subway), "karakter esnemesi yok").toBe(true);
  });

  /** 3B oyunlarda sarsıntının DÖNME bileşeni kapalı olmalı. */
  it.each(["PartyGame.tsx", "KartGame.tsx"])("%s sarsıntısında dönme yok", (dosya) => {
    const kaynak = readFileSync(join(DIZIN, dosya), "utf8");
    const m = kaynak.match(/createSarsinti\(([^)]*)\)/);
    expect(m, "createSarsinti bulunamadı").not.toBeNull();
    const rot = (m![1].split(",")[1] ?? "0").trim();
    expect(rot, `${dosya}: sarsıntının dönme bileşeni 0 olmalı`).toBe("0");
  });
});

/**
 * ÇAMUR GERİ BİLDİRİMİ — "çamura bastığı belli olsun" (kullanıcı isteği).
 *
 * ⚠️ HAZIR SES DOSYASI KULLANILMADI: bu ortamdan freesound/pixabay/
 * opengameart'ın hiçbirine erişilemiyor (hepsi egress'te kapalı) VE
 * uygulamanın bütün oyun sesleri WebAudio ile üretiliyor — tek bir mp3 hem
 * paket boyutu hem lisans/atıf yükü getirirdi. Çamur sesi zaten sentezle
 * iyi çıkıyor: ıslaklık, kesme frekansı süpürülen yüksek-Q gürültüden gelir
 * (periyodik bir ton DEĞİL — `tone` tek başına yetmezdi, `gurultu` eklendi).
 */
describe("çamur geri bildirimi (Parti)", () => {
  const party = readFileSync(join(DIZIN, "PartyGame.tsx"), "utf8");

  it("çamurda ses çalıyor", () => {
    expect(/sfx\("camur"\)/.test(party), "çamur sesi hiç çalınmıyor").toBe(true);
  });

  it("ayak izi ve sıçrama HAVUZDAN geliyor (her adımda mesh yaratılmıyor)", () => {
    expect(/IZ_SAYISI/.test(party) && /SICRAMA_SAYISI/.test(party),
      "havuz yok — her adımda nesne yaratmak WebView'de çöp toplayıcıyı tetikler").toBe(true);
    expect(/camurAdimi\s*\(/.test(party), "iz basma çağrısı yok").toBe(true);
    expect(/camurGuncelle\s*\(/.test(party), "izleri yaşlandıran çağrı yok").toBe(true);
  });

  /** Çamurdan ÇIKTIKTAN sonra da birkaç adım iz kalmalı — asıl anlatan bu. */
  it("çamurdan çıkınca birkaç adım daha iz bırakılıyor", () => {
    const m = party.match(/const IZ_ADIM = (\d+)/);
    expect(m, "IZ_ADIM tanımlı değil").not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(3);
  });

  /**
   * ⚠️ KULLANICI ŞARTI: "ayakları çamura bulansın, ilk adım koyu iken adım
   * attıkça rengi açılsın". İki ayrı kanal — ayağın RENGİ ve izin KOYULUĞU,
   * ikisi de kalan çamur miktarına (`yogunluk`) bağlı olmalı.
   */
  it("ayak çamura bulanıyor (gövde değil)", () => {
    expect(/ayakMat\.color[\s\S]{0,60}lerp\(/.test(party), "ayak rengi çamura çevrilmiyor").toBe(true);
    expect(/ayakDeriMat/.test(party), "bacak derisi ayrı malzeme almamış").toBe(true);
    // Gövde malzemesi çamurla boyanmamalı — yalnız ayak kirlenir.
    expect(/bodyMat\.color[\s\S]{0,40}CAMUR/.test(party), "gövde de çamura boyanmış").toBe(false);
  });

  it("izin koyuluğu adım adım AZALIYOR", () => {
    expect(/yogunluk/.test(party), "yoğunluk hesabı yok").toBe(true);
    expect(/güç\s*=\s*IZ_OPAK\s*\*\s*yogunluk/.test(party),
      "izin başlangıç koyuluğu yoğunluğa bağlı değil").toBe(true);
  });

  /**
   * ⚠️ ZAMAN SOLMASI ADIM GRADYANINI BASTIRMAMALI: doğrusal solmada ilk iz
   * hem EN KOYU hem EN ESKİ olduğu için en çok soluyor ve bütün izler
   * birbirine benziyor. İz önce olduğu gibi durmalı, sonra kaybolmalı.
   */
  it("iz önce tam koyulukta duruyor, sonra soluyor", () => {
    expect(/y0\s*<\s*0?\.\d+\s*\?\s*1\s*:/.test(party),
      "iz doğrusal soluyor — adım gradyanı bastırılıyor").toBe(true);
  });
});

describe("gurultu — süzülmüş gürültü ilkesi", () => {
  it("WebAudio yokken bile istisna atmıyor", async () => {
    const { gurultu } = await import("@/lib/audio");
    expect(() => gurultu({ dur: 0.17, bas: 240, tepe: 900, son: 170 })).not.toThrow();
  });
});
