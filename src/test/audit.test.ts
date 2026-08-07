// DENETİM KARTI — Flashcard'ın öz-beyanını yansız ölçen kontrol sorusu.
//
// Neden var: Flashcard'da çocuk cevabı GÖRDÜKTEN sonra "Biliyorum" diyor ve
// bunu kimse doğrulamıyor. 8 yaş altı çocuklar performanslarını abartıyor.
// Çözüm polislik değil ÖRNEKLEME: 20 soruda bir gerçek soru sorulur, beyanın
// ne kadar tuttuğu ölçülür, üretim puanı o katsayıyla kırpılır.
import { describe, it, expect, beforeEach } from "vitest";
import {
  auditDue, noteQuestion, recordAudit, reliability, resetAudit,
  HER_KACTA, SIK_SAYISI,
} from "@/lib/audit";
import { pickAuditQuestion } from "@/lib/auditQuestion";
import { getTopicSrs, recordSrsAnswer, resetTopicSrs, __resetSelectorState } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";

const topics = getAllTopics();
const t1 = topics[0];

const realNow = Date.now;
const gunde = (d: number) => { Date.now = () => d * 86_400_000 + 3_600_000; };

beforeEach(() => {
  localStorage.clear();
  resetAudit();
  __resetSelectorState();
  resetTopicSrs("quiz", t1.id);
  Date.now = realNow;
});

describe("denetim sıklığı", () => {
  it(`${HER_KACTA} sorudan önce denetim gelmez, sonra gelir`, () => {
    for (let i = 0; i < HER_KACTA - 1; i++) {
      noteQuestion();
      expect(auditDue(), `${i + 1}. soruda gelmemeli`).toBe(false);
    }
    noteQuestion();
    expect(auditDue()).toBe(true);
  });

  it("denetim yapılınca sayaç sıfırlanır", () => {
    for (let i = 0; i < HER_KACTA; i++) noteQuestion();
    recordAudit(true);
    expect(auditDue()).toBe(false);
  });
});

describe("güven katsayısı", () => {
  it("hiç denetim yokken TAM GÜVEN (masumiyet karinesi)", () => {
    expect(reliability()).toBe(1);
  });

  it("hep doğru denetimde güven 1'de kalır", () => {
    for (let i = 0; i < 10; i++) recordAudit(true);
    expect(reliability()).toBe(1);
  });

  it("tek şanssız denetim çocuğu cezalandırmaz (önsel yumuşatma)", () => {
    // ⚠️ Şans düzeltmesi farkı BÜYÜTÜR: önsel 3 iken tek yanlış güveni
    // 1.00 → 0.63 yapıyordu. Dikkati dağılan çocuk yalancı değildir.
    recordAudit(false);
    expect(reliability()).toBeGreaterThan(0.8);
  });

  it("ısrarlı yanlışta güven TABANA iner ama SIFIRLANMAZ", () => {
    for (let i = 0; i < 30; i++) recordAudit(false);
    // Taban 0.5: en güvenilmez çocukta bile Flashcard bir oyun cevabı kadar
    // değer taşır — çocuk yalan söylese de harfe maruz kalıyor, o gerçek.
    expect(reliability()).toBe(0.5);
  });

  it("şans düzeltmesi uygulanır: 3 şıkta rastgele basan çocuk 1/3 tutturur", () => {
    // 3'te 1 doğru = tam şans seviyesi → düzeltilmiş bilgi ~0 → tabana iner.
    for (let i = 0; i < 30; i++) recordAudit(i % 3 === 0);
    expect(reliability()).toBe(0.5);
    // Buna karşılık 3'te 2 doğru şansın belirgin üstünde → taban üstü.
    resetAudit();
    for (let i = 0; i < 30; i++) recordAudit(i % 3 !== 0);
    expect(reliability()).toBeGreaterThan(0.5);
  });
});

describe("üretim puanı güvenle ölçeklenir", () => {
  it("güvenilmez çocukta Flashcard puanı oyun cevabı seviyesine iner", async () => {
    for (let i = 0; i < 30; i++) recordAudit(false);   // güven = 0.5
    gunde(700);
    await recordSrsAnswer("quiz", t1.id, "l1-01", true,
      { responseMs: 1200, evidence: "production" });
    const e = getTopicSrs("quiz", t1.id)["l1-01"];
    // Tam puan 1 olurdu; güven 0.5 ile yarıya iner = tanıma puanı kadar.
    expect(e.mastery).toBeCloseTo(0.5, 5);
    Date.now = realNow;
  });

  it("dürüst çocukta üretim puanı TAM kalır", async () => {
    for (let i = 0; i < 10; i++) recordAudit(true);
    gunde(710);
    await recordSrsAnswer("quiz", t1.id, "l1-02", true,
      { responseMs: 1200, evidence: "production" });
    expect(getTopicSrs("quiz", t1.id)["l1-02"].mastery).toBeCloseTo(1, 5);
    Date.now = realNow;
  });

  it("TANIMA puanı denetimden ETKİLENMEZ (orada beyan yok, şık var)", async () => {
    for (let i = 0; i < 30; i++) recordAudit(false);
    gunde(720);
    await recordSrsAnswer("quiz", t1.id, "l1-03", true, { responseMs: 900 });
    expect(getTopicSrs("quiz", t1.id)["l1-03"].mastery).toBeCloseTo(0.5, 5);
    Date.now = realNow;
  });
});

describe("denetim sorusunun kurulumu", () => {
  const havuz = t1.items.filter((i) => i.audio);

  it("hiç L3+ harf yokken denetim sorusu KURULAMAZ (beyan yoksa denetlenecek şey yok)", () => {
    expect(pickAuditQuestion(havuz, "quiz", t1.id)).toBeNull();
  });

  it("şıkların hepsi FARKLI ses çalar (aynı sesli iki şık = iki doğru cevap)", async () => {
    // Birkaç harfi L3+ yap ki aday olsun.
    for (const it of havuz.slice(0, 8)) {
      await recordSrsAnswer("quiz", t1.id, it.id, true, { responseMs: 900 });
    }
    for (let n = 0; n < 40; n++) {
      const q = pickAuditQuestion(havuz, "quiz", t1.id);
      expect(q).not.toBeNull();
      const sesler = q!.options.map((o) => o.audio);
      expect(q!.options).toHaveLength(SIK_SAYISI);
      expect(new Set(sesler).size, `şıklar: ${sesler.join(", ")}`).toBe(SIK_SAYISI);
      // Doğru cevap şıklar arasında olmalı
      expect(sesler).toContain(q!.target.audio);
    }
  });

  it("hedef yalnız BİLDİĞİNİ İDDİA ETTİĞİ (L3+) harflerden seçilir", async () => {
    const bilinen = havuz.slice(0, 3).map((i) => i.id);
    for (const id of bilinen) {
      await recordSrsAnswer("quiz", t1.id, id, true, { responseMs: 900 });
    }
    for (let n = 0; n < 25; n++) {
      const q = pickAuditQuestion(havuz, "quiz", t1.id);
      expect(bilinen).toContain(q!.target.id);
    }
  });
});
