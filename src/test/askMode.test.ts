// OYUNDA SORU YÖNTEMİ — yazılı ad şıkları (deneysel modlar).
//
// Asıl korunan davranış: çeldirici adlar hedefe BENZER olmalı. Şıklar
// "Be" ve "Peltek Se" gibi çok farklıysa çocuk kelimeyi OKUMADAN ilk harfe
// bakıp seçiyor — kısayol öğreniyor, harfi öğrenmiyor (kullanıcı tespiti).
import { describe, it, expect } from "vitest";
import {
  pickNameWrongs, okunurAd, adZorlugu, sikSayisi, yaziliSik, FLASH_SIK, USTTE_SIK,
} from "@/lib/askMode";
import { getAllTopics } from "@/data/subjects";

const harfler = getAllTopics()[0];
const havuz = harfler.items.filter((i) => i.emoji && i.translit);

describe("yazılı şık çeldiricileri", () => {
  it("harflerin okunur adı var (yeni mod bu topikte çalışabilir)", () => {
    expect(havuz.length).toBeGreaterThanOrEqual(20);
    for (const it of havuz) expect(okunurAd(it)).toBeTruthy();
  });

  it("çeldirici hedefin KENDİSİ olmaz ve AYNI ADI taşımaz", () => {
    for (const hedef of havuz) {
      const w = pickNameWrongs(havuz, hedef, 2);
      const ad = okunurAd(hedef)!;
      for (const x of w) {
        expect(x.id).not.toBe(hedef.id);
        expect(okunurAd(x)).not.toBe(ad);
      }
      // Şıklar kendi aralarında da aynı adı taşımamalı
      expect(new Set(w.map((x) => okunurAd(x))).size).toBe(w.length);
    }
  });

  it("istenen sayıda çeldirici üretir (2 ve 3 şık)", () => {
    for (const hedef of havuz.slice(0, 10)) {
      expect(pickNameWrongs(havuz, hedef, FLASH_SIK - 1)).toHaveLength(FLASH_SIK - 1);
      expect(pickNameWrongs(havuz, hedef, USTTE_SIK - 1)).toHaveLength(USTTE_SIK - 1);
    }
  });

  it("⚠️ ÇELDİRİCİ ADLARI RASTGELEDEN BELİRGİN BİÇİMDE DAHA BENZER", () => {
    // Kısayol testi: seçilen çeldiricilerin ortalama düzenleme mesafesi,
    // havuzdan rastgele seçilenlerinkinden küçük olmalı. Değilse çocuk
    // kelimeyi okumadan ilk harfe bakıp seçebilir.
    const mesafe = (a: string, b: string) => {
      const x = a.toLocaleLowerCase("tr"), y = b.toLocaleLowerCase("tr");
      const dp: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
        Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
      for (let i = 1; i <= x.length; i++)
        for (let j = 1; j <= y.length; j++)
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      return dp[x.length][y.length];
    };
    let secilen = 0, secilenN = 0, rast = 0, rastN = 0;
    for (const hedef of havuz) {
      const ad = okunurAd(hedef)!;
      for (const w of pickNameWrongs(havuz, hedef, 2)) {
        secilen += mesafe(okunurAd(w)!, ad); secilenN++;
      }
      for (const o of havuz) {
        if (o.id === hedef.id) continue;
        rast += mesafe(okunurAd(o)!, ad); rastN++;
      }
    }
    const secilenOrt = secilen / secilenN;
    const rastOrt = rast / rastN;
    expect(secilenOrt, `seçilen ${secilenOrt.toFixed(2)} vs rastgele ${rastOrt.toFixed(2)}`)
      .toBeLessThan(rastOrt * 0.8);
  });

  it("adı olmayan öğede çeldirici üretilmez (klasiğe düşülecek)", () => {
    const adsiz = { id: "x", label: "?", emoji: "؟" } as never;
    expect(pickNameWrongs(havuz, adsiz, 2)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// KADEMELİ ZORLUK — kullanıcının "bear/giraffe → bear/beal" fikri.
//
// Harfi yeni gören çocuğa EN BENZER adı vermek onu boğar; zaten bileni UZAK
// adla sınamak hiçbir şey ölçmez. `zorluk` 0..1 sıralamadaki pencereyi kaydırır.
// ⚠️ Sahte ad UYDURULMAZ (kullanıcının "beal" örneği): 5-6 yaşındaki çocuğa
// olmayan bir harf adı göstermek yanlış ad öğretme riski taşır — gerçek harf
// adları arasında zaten yeterince benzer çift var.
describe("kademeli çeldirici zorluğu", () => {
  const mesafe = (a: string, b: string) => {
    const x = a.toLocaleLowerCase("tr"), y = b.toLocaleLowerCase("tr");
    const dp: number[][] = Array.from({ length: x.length + 1 }, (_, i) =>
      Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= x.length; i++)
      for (let j = 1; j <= y.length; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    return dp[x.length][y.length];
  };
  const ortMesafe = (hedef: typeof havuz[number], z: number) => {
    const ad = okunurAd(hedef)!;
    let t = 0, n = 0;
    for (let k = 0; k < 40; k++) {
      for (const w of pickNameWrongs(havuz, hedef, 1, { zorluk: z })) {
        t += mesafe(okunurAd(w)!, ad); n++;
      }
    }
    return n ? t / n : 0;
  };

  it("⚠️ zorluk 1 (öğrenilmiş harf) çeldiriciyi zorluk 0'dan DAHA BENZER seçer", () => {
    // Havuzun tamamında ortalama: tek harfte rastlantı olabilir.
    let yakin = 0, uzak = 0;
    for (const h of havuz.slice(0, 28)) { yakin += ortMesafe(h, 1); uzak += ortMesafe(h, 0); }
    expect(yakin, `zorluk1=${yakin.toFixed(1)} zorluk0=${uzak.toFixed(1)}`).toBeLessThan(uzak);
  });

  it("adZorlugu seviyeyle MONOTON artar (L1 en kolay, L4+ en zor)", () => {
    const z = [1, 2, 3, 4, 5].map(adZorlugu);
    for (let i = 1; i < z.length; i++) expect(z[i]).toBeGreaterThanOrEqual(z[i - 1]);
    expect(z[0]).toBeLessThan(z[4]);
  });

  it("zorluk ne olursa olsun çeldirici hedefin adını TAŞIMAZ", () => {
    for (const h of havuz) {
      for (const z of [0, 0.15, 0.55, 1]) {
        for (const w of pickNameWrongs(havuz, h, 2, { zorluk: z })) {
          expect(okunurAd(w)).not.toBe(okunurAd(h));
          expect(w.id).not.toBe(h.id);
        }
      }
    }
  });
});

// ŞIK SAYISI — modun sözleşmesi. Oyunlar bunu `sikSayisi` üzerinden okur;
// klasik varsayılanları oyundan oyuna değişir (Quiz 4, Balon 5, Koşu 4).
describe("mod sözleşmesi", () => {
  it("sikSayisi klasikte oyunun kendi sayısını korur", () => {
    for (const k of [2, 3, 4, 5]) {
      expect(sikSayisi("klasik", k)).toBe(k);
      // "Öğret" soruyu klasik sorar — yalnız ÖNCE tanıtır.
      expect(sikSayisi("ogret", k)).toBe(k);
    }
  });

  it("yazılı modlar sabit şık sayısı dayatır", () => {
    expect(sikSayisi("flash", 5)).toBe(FLASH_SIK);
    expect(sikSayisi("ustte", 5)).toBe(USTTE_SIK);
  });

  it("yaziliSik yalnız şimşek/tabela için doğru", () => {
    expect(yaziliSik("flash")).toBe(true);
    expect(yaziliSik("ustte")).toBe(true);
    expect(yaziliSik("klasik")).toBe(false);
    // ⚠️ "Öğret"te şıklar GLİFtir: orada eksik olan şey yön değil TANITIMdı.
    expect(yaziliSik("ogret")).toBe(false);
  });
});
