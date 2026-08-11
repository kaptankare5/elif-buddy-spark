// AKTARIM DENEYİ — deney tasarımının bekçileri.
//
// İlk gerçek koşuda (J, 6 yaş) iki kusur ortaya çıktı; testler onların
// geri gelmesini engelliyor:
//  1) Kollar RASTGELE dağıtılıyordu → B koluna uzun kelimeler (calcetín,
//     caballo, ventana), C koluna kısa kelimeler (hoja, reloj, abeja) düştü.
//     n=6 ile rastgelelik zorluğu dengelemiyor; kollar arası fark "yöntem
//     farkı mı kelime farkı mı" ayırt edilemez hâle geliyordu.
//  2) Rapor yalnız kol ortalaması veriyordu. B kolunda çocuk 30 denemenin
//     hiçbirinde doğru üretemedi — yani orada aktarılacak bir öğrenme hiç
//     oluşmadı; %0'lık üretim puanı "aktarım yok" değil "öğrenme yok"
//     demekti. Rapor artık bu ikisini ayırıyor.
import { describe, it, expect } from "vitest";
import { createState, wordsOfArm, WORDS, ARM_REPS, buildReport, type Arm } from "@/lib/deney";

const heceSayisi = (es: string) => (es.toLocaleLowerCase("es").match(/[aeiouáéíóúü]+/g) ?? []).length;

describe("kol dağıtımı zorluğa göre dengeli", () => {
  it("her kol 6 kelime alır", () => {
    for (let n = 0; n < 30; n++) {
      const st = createState("T", "6");
      for (const arm of ["A", "B", "C"] as Arm[]) {
        expect(wordsOfArm(st, arm)).toHaveLength(WORDS.length / 3);
      }
    }
  });

  it("⚠️ kolların ORTALAMA HECE SAYISI birbirine çok yakın olmalı", () => {
    // Rastgele dağıtımda bu fark 0.8 heceye kadar çıkabiliyordu; dengeli
    // dağıtımda blok başına birer kelime gittiği için fark küçük kalmalı.
    for (let n = 0; n < 30; n++) {
      const st = createState("T", "6");
      const ort = (["A", "B", "C"] as Arm[]).map((a) => {
        const ws = wordsOfArm(st, a);
        return ws.reduce((t, w) => t + heceSayisi(w), 0) / ws.length;
      });
      const fark = Math.max(...ort) - Math.min(...ort);
      expect(fark, `kol hece ortalamaları: ${ort.map((x) => x.toFixed(2)).join(", ")}`)
        .toBeLessThanOrEqual(0.35);
    }
  });

  it("her kelime tam olarak bir kola atanır", () => {
    const st = createState("T", "6");
    const hepsi = (["A", "B", "C"] as Arm[]).flatMap((a) => wordsOfArm(st, a));
    expect(new Set(hepsi).size).toBe(WORDS.length);
  });

  it("tekrar sayıları korunur: A ve B eşit, C üç katı", () => {
    expect(ARM_REPS.A).toBe(ARM_REPS.B);
    expect(ARM_REPS.C).toBe(ARM_REPS.A * 3);
  });
});

describe("rapor: öğrenilen / öğrenilemeyen ayrımı", () => {
  it("⚠️ raporda ÖĞRENİLENLERDE AKTARIM bölümü bulunur", () => {
    const st = createState("T", "6");
    // Yapay veri: A kolunun kelimeleri eğitimde öğrenilmiş, B kolununkiler
    // hiç öğrenilememiş olsun; üretim testinde yalnız öğrenilenler bilinsin.
    const a = wordsOfArm(st, "A");
    const b = wordsOfArm(st, "B");
    for (const w of a) st.train[w] = Array.from({ length: 5 }, () => ({ score: 1, ms: 900, at: 1 }));
    for (const w of b) st.train[w] = Array.from({ length: 5 }, () => ({ score: 0, ms: 900, at: 1 }));
    st.immediate = { startedAt: 1, endedAt: 2, prod: {}, rec: {} };
    for (const w of a) st.immediate.prod[w] = { score: 1, ms: 800 };
    for (const w of b) st.immediate.prod[w] = { score: 0, ms: 800 };

    const rapor = buildReport(st);
    expect(rapor).toContain("ÖĞRENİLENLERDE AKTARIM");
    // Öğrenilenlerde %100, öğrenilemeyenlerde %0 çıkmalı.
    expect(rapor).toMatch(/ÖĞRENİLEN \(≥%60 doğru\): 6 kelime → üretimde 6\/6 \(%100\)/);
    expect(rapor).toMatch(/ÖĞRENİLEMEYEN\s+: \d+ kelime → üretimde 0\//);
  });
});
