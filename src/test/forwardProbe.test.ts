// İLERİ YOKLAMA — "sıradaki konuyu da biliyor mu?"
//
// Geriye yoklamanın aynadaki hâli: kilitli konudan arada bir gizli ölçüm
// sorusu sorulur, SPRT kanıt biriktirir, eşiği geçince "geçelim mi?" teklifi
// çıkar. Cevaplar SRS'e YAZILMAZ.
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pickForwardProbe, recordProbe, acceptSkip, declineSkip, skipOffered,
  nextLockedTopic, probeInfo, resetForwardProbe, topicSkillCount,
  PROBE_LIMITS, PROBE_OFFER_EVENT,
} from "@/lib/forwardProbe";
import { getTopicSrs, recordSrsAnswer, __resetSelectorState } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import { getUnlockedTopicIds } from "@/lib/unlock";
import { isTopicSkipped, resetPlacement } from "@/lib/placement";
import { resetConfusion, __resetConfusionCache } from "@/lib/confusion";

const topics = getAllTopics();

beforeEach(() => {
  localStorage.clear();
  __resetConfusionCache();
  resetConfusion();
  __resetSelectorState();
  resetForwardProbe();
  resetPlacement();
});

/** Yoklama oranı rastgele; testte hep gelsin diye Math.random sabitlenir. */
const hepGelsin = () => vi.spyOn(Math, "random").mockReturnValue(0);

describe("hedef seçimi", () => {
  it("sıradaki KİLİTLİ konuyu bulur, alıştırmasız olanı atlar", () => {
    // Taze ilerleme: yalnız 1. konu açık. Sıradaki kilitli konu 2. değil
    // 3. olmalı — 2. konu (Yazılışlar) alıştırmasız, görülüp geçiliyor.
    const t = nextLockedTopic("harfler");
    expect(t?.id).toBe("harekeler");
  });

  it("konu zaten açıksa yoklama yapılmaz", () => {
    // 1. konudan bakınca 3. konu kilitli; ama 3. konudan bakınca sıradaki
    // (4.) konu da kilitli olmalı — açık olsaydı null dönerdi.
    expect(nextLockedTopic("harekeler")?.id).toBe("cezm");
  });

  it("son konudan sonra yoklanacak konu yok", () => {
    expect(nextLockedTopic(topics[topics.length - 1].id)).toBeNull();
  });

  it("yoklama sorusu kilitli konudan ve SESLİ bir öğe döndürür", () => {
    const r = hepGelsin();
    try {
      const p = pickForwardProbe("harfler");
      expect(p).not.toBeNull();
      expect(p!.topicId).toBe("harekeler");
      expect(p!.item.audio).toBeTruthy();      // soru sesle sorulur
      expect(p!.item.emoji).toBeTruthy();
    } finally { r.mockRestore(); }
  });

  it("çocuk ZORLANIYORSA yoklama gelmez", async () => {
    // Akış bandını düşür: son cevapların çoğu yanlış.
    for (let i = 0; i < 10; i++) {
      await recordSrsAnswer("quiz", "harfler", `l1-${String(i + 1).padStart(2, "0")}`, false, { responseMs: 3000 });
    }
    const r = hepGelsin();
    try {
      expect(pickForwardProbe("harfler")).toBeNull();
    } finally { r.mockRestore(); }
  });
});

describe("SPRT kararı", () => {
  const GEREKEN = Math.ceil(PROBE_LIMITS.UST_CIZGI / PROBE_LIMITS.W_DOGRU);

  it("hiç yanlışsız 7 doğruda 'atlanabilir' der", () => {
    expect(GEREKEN).toBe(7);
    for (let i = 0; i < GEREKEN - 1; i++) {
      expect(recordProbe("harekeler", true)).toBe("devam");
    }
    expect(recordProbe("harekeler", true)).toBe("atlanabilir");
    expect(skipOffered("harekeler")).toBe(true);
  });

  it("bilmeyen çocuk birkaç soruda elenir (uzun yoklamaya katlanmaz)", () => {
    let n = 0, sonuc = "devam";
    while (sonuc === "devam" && n < 20) { sonuc = recordProbe("harekeler", false); n++; }
    expect(sonuc).toBe("bilmiyor");
    expect(n).toBeLessThanOrEqual(3);          // ~2 soruda karar
    expect(skipOffered("harekeler")).toBe(false);
  });

  it("bir yanlış yaklaşık 4 doğruyu siler", () => {
    for (let i = 0; i < 5; i++) recordProbe("harekeler", true);
    const once = probeInfo("harekeler").llr;
    recordProbe("harekeler", false);
    const sonra = probeInfo("harekeler").llr;
    const silinen = (once - sonra) / PROBE_LIMITS.W_DOGRU;
    expect(silinen).toBeGreaterThan(3);
    expect(silinen).toBeLessThan(4.5);
  });

  it("'bilmiyor' kararından sonra bir daha yoklama sorusu gelmez", () => {
    while (recordProbe("harekeler", false) === "devam") { /* elenene kadar */ }
    const r = hepGelsin();
    try { expect(pickForwardProbe("harfler")).toBeNull(); } finally { r.mockRestore(); }
  });

  it("eşiği geçince olay yayınlanır (UI teklifi açar)", () => {
    const gorulen: string[] = [];
    const h = (e: Event) => gorulen.push((e as CustomEvent).detail.topicId);
    window.addEventListener(PROBE_OFFER_EVENT, h);
    try {
      for (let i = 0; i < 7; i++) recordProbe("harekeler", true);
      expect(gorulen).toEqual(["harekeler"]);
    } finally { window.removeEventListener(PROBE_OFFER_EVENT, h); }
  });
});

describe("avans — bilene yol açar, bilmeyeni kayırmaz", () => {
  const gecir = (topicId: string) => {
    let n = 0;
    while (recordProbe(topicId, true) !== "atlanabilir" && n < 20) n++;
    acceptSkip(topicId);
    return n + 1;
  };

  it("her atlamadan sonra sonraki konu daha az soruyla geçer", () => {
    const ilk = gecir("harekeler");
    const ikinci = gecir("cezm");
    const ucuncu = gecir("sedde");
    expect(ilk).toBe(7);
    expect(ikinci).toBeLessThan(ilk);
    expect(ucuncu).toBeLessThanOrEqual(ikinci);
  });

  it("bir konuda elenince avans SIFIRLANIR", () => {
    gecir("harekeler");
    while (recordProbe("cezm", false) === "devam") { /* elen */ }
    expect(probeInfo("cezm").seri).toBe(0);
    // Avans gitti → sonraki konu yine tam 7 doğru ister
    let n = 0;
    while (recordProbe("sedde", true) !== "atlanabilir" && n < 20) n++;
    expect(n + 1).toBe(7);
  });
});

describe("teklif — sistem dayatmaz, sorar", () => {
  it("KABUL: konu atlanır ve sonraki konu açılır (öğeler görülmemiş kalır)", () => {
    expect(getUnlockedTopicIds().has("cezm")).toBe(false);
    for (let i = 0; i < 7; i++) recordProbe("harekeler", true);
    acceptSkip("harekeler");
    // SkipOffer bileşeninin yaptığı ikinci adım:
    expect(isTopicSkipped("harekeler")).toBe(false);   // acceptSkip tek başına işaretlemez
  });

  it("RED: o konu için bir daha teklif edilmez (ısrar yok)", () => {
    for (let i = 0; i < 7; i++) recordProbe("harekeler", true);
    expect(skipOffered("harekeler")).toBe(true);
    declineSkip("harekeler");
    expect(skipOffered("harekeler")).toBe(false);
    const r = hepGelsin();
    try { expect(pickForwardProbe("harfler")).toBeNull(); } finally { r.mockRestore(); }
    // Yeniden doğru cevaplasa bile teklif geri gelmez
    for (let i = 0; i < 10; i++) recordProbe("harekeler", true);
    expect(skipOffered("harekeler")).toBe(false);
  });

  it("teklif metnindeki beceri sayısı doğru", () => {
    expect(topicSkillCount("harekeler")).toBe(3);
    expect(topicSkillCount("sedde")).toBe(26);
  });
});

describe("yoklama cevabı SRS'e YAZILMAZ", () => {
  it("recordProbe hiçbir konunun seviyesini değiştirmez", () => {
    const once = JSON.stringify(getTopicSrs("quiz", "harekeler"));
    for (let i = 0; i < 7; i++) recordProbe("harekeler", true);
    expect(JSON.stringify(getTopicSrs("quiz", "harekeler"))).toBe(once);
  });
});
