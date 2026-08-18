// SES ŞIKLARI ve ŞEKİL EŞLEME — okuma bilmeyen çocuk için soru yöntemleri.
//
// ⚠️ Bu iki mod, yazılı modların (Şimşek/Tabela) kapalı olduğu çocuk için var:
// beş yaşındaki çocuk Latin harfini okuyamıyor. Aşağıdaki kilitler:
//   · yeni modlar OKUMA GEREKTİRMEZ (yaziliSik false)
//   · şık sayıları: Ses Şıkları 3'ü aşamaz (dinleme süresi)
//   · Şekil Eşleme sorusu hedefin KENDİ glifi olamaz (tautoloji)
import { describe, it, expect } from "vitest";
import { ASK_MODES, yaziliSik, asiliGlif, sesliSik, sikSayisi, SESLI_SIK } from "@/lib/askMode";
import { baskaSekil, sekilSayisi } from "@/lib/sekilSoru";
import { getAllTopics } from "@/data/subjects";

describe("yeni soru yöntemleri", () => {
  it("Ayarlar'da beş yöntem var", () => {
    expect(ASK_MODES.map((m) => m.id)).toEqual(
      ["klasik", "flash", "ustte", "sesli", "sekil"],
    );
  });

  it("⚠️ yeni modlar OKUMA gerektirmez", () => {
    expect(yaziliSik("sesli")).toBe(false);
    expect(yaziliSik("sekil")).toBe(false);
    expect(yaziliSik("flash")).toBe(true);
    expect(yaziliSik("ustte")).toBe(true);
  });

  it("ikisinde de glif ASILI durur (ses çalınmaz)", () => {
    expect(asiliGlif("sesli")).toBe(true);
    expect(asiliGlif("sekil")).toBe(true);
    expect(asiliGlif("ustte")).toBe(true);
    expect(asiliGlif("klasik")).toBe(false);
    expect(asiliGlif("flash")).toBe(false);
  });

  it("şık hoparlör YALNIZ Ses Şıklarında", () => {
    expect(sesliSik("sesli")).toBe(true);
    for (const m of ["klasik", "flash", "ustte", "sekil"] as const) {
      expect(sesliSik(m)).toBe(false);
    }
  });

  it("⚠️ Ses Şıklarında şık 3'ü aşmaz — 4 şık ~6 sn dinleme demek", () => {
    expect(sikSayisi("sesli", 6)).toBe(SESLI_SIK);
    expect(SESLI_SIK).toBeLessThanOrEqual(3);
  });

  it("Şekil Eşleme: 28 harfin şekilleri yüklü", () => {
    const { harf, sekil } = sekilSayisi();
    expect(harf).toBe(28);
    expect(sekil).toBe(84);
  });

  it("⚠️ asılan şekil hedefin KENDİ glifi olamaz (soru tautoloji olmasın)", () => {
    const harfler = getAllTopics().find((t) => t.id === "harfler")!;
    for (const it of harfler.items) {
      const s = baskaSekil(it);
      if (s) expect(s.glif, `${it.id} kendi glifini sordu`).not.toBe(it.emoji);
    }
  });

  it("şekli olmayan öğede null döner (çağıran klasiğe düşer)", () => {
    const cezm = getAllTopics().find((t) => t.id === "cezm")!;
    const ekstra = cezm.items.find((i) => i.section === "Ekstralar")!;
    expect(baskaSekil(ekstra)).toBeNull();
  });
});
