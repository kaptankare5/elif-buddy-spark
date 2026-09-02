/**
 * KUYRUK ATÖLYESİ — "bu bölüm başka şeylere ETKİ ETMESİN" şartının bekçisi.
 *
 * ⚠️ KULLANICI ŞARTI (birebir): "ama bu bölüm başka şeylere etki etmesin.
 * harflerin vs, seviye tekrar sistemi vs, ye etki etmesin. konu anlatımı gibi
 * olsun etkileşimli."
 *
 * Yani Yazılış Hafıza dersi bir DERStir, ölçüm değil: çocuk orada kuyrukları
 * silerken hiçbir harfin SRS seviyesi değişmemeli, karışıklık ısısı
 * ısınmamalı, oyun rekoru/yıldızı/günlük serisi ilerlememelidir. Test bunu
 * kaynak taramasıyla kilitler — bir gün biri "burada da sayalım" derse
 * burada durur.
 *
 * Ayrıca: Türkçe ekler ELLE yazılmamalı. Ekranda "çanakı sil" yazıyordu
 * (doğrusu "çanağı"); ünsüz yumuşaması + ünlü uyumu `lib/turkce` ile üretilir.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { belirtmeHali, iyelikBelirtme } from "@/lib/turkce";
import { TAIL_RULES } from "@/data/writingMnemonics";
import { HARF_RENGI, harfRengi } from "@/data/harfRenkleri";

const oku = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/**
 * ⚠️ YORUMLARI AT, SONRA TARA. İlk sürüm KENDİ AÇIKLAMA YORUMUNU yakalayıp
 * "recordSrsAnswer çağırıyor" dedi — oysa o satır tam olarak "bunlar
 * KULLANILMAZ" diye yazılmış bir nottu. (Aynı tuzağa `arayuz.test.ts`'te de
 * düşülmüştü.) Ayraç kodun kendisine bakmalı.
 */
const kodu = (p: string) =>
  oku(p)
    .replace(/\/\*[\s\S]*?\*\//g, " ")   // blok yorumlar
    .replace(/^\s*\/\/.*$/gm, " ");        // satır yorumları

/** Derse ait, ÖLÇÜME dokunmaması gereken dosyalar. */
const DERS = [
  "src/components/mnemonics/KuyrukAtolyesi.tsx",
  "src/pages/YazilisHafiza.tsx",
];

/** Bunlardan biri geçerse ders artık "ders" değil, ölçüm olur. */
const YASAK = [
  "recordSrsAnswer", "recordGameAnswer", "recordInGameTest", "recordLocalSrsAnswer",
  "recordConfusionPick", "recordDiscrimination", "recordMiss",
  "oyunBitti", "setYildiz", "recordProbe", "recordBackCheck", "recordAudit",
];

describe("kuyruk atölyesi — ders, ölçüm değil", () => {
  it.each(DERS)("%s ilerleme/ölçüm sistemlerine YAZMIYOR", (yol) => {
    const src = kodu(yol);
    for (const y of YASAK) {
      expect(src.includes(y), `${yol} → ${y} çağırıyor: ders ölçüme karışıyor`).toBe(false);
    }
  });

  /**
   * ⚠️ TEK İSTİSNA `markTopicVisited`: alıştırmasız konunun tamamlanma ölçütü
   * "bir kez girildi"dir (kullanıcı şartı: "en azından bir kere konuya
   * girsin"). O da seviye değil ZİYARET kaydıdır ve sayfanın kendisinde,
   * atölyede değil.
   */
  it("ziyaret kaydı sayfada, atölyede değil", () => {
    expect(kodu("src/pages/YazilisHafiza.tsx").includes("markTopicVisited")).toBe(true);
    expect(kodu("src/components/mnemonics/KuyrukAtolyesi.tsx").includes("markTopicVisited")).toBe(false);
  });

  it("atölye kalıcı bir şey yazmıyor (localStorage'a bile)", () => {
    const src = kodu("src/components/mnemonics/KuyrukAtolyesi.tsx");
    expect(src.includes("localStorage"), "atölye localStorage'a yazıyor").toBe(false);
  });

  it("her kuyruklu harfin bir rengi var", () => {
    for (const r of TAIL_RULES) {
      expect(HARF_RENGI[r.n], `${r.name} renksiz`).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // Kullanıcının verdiği iki örnek kilitli
    expect(harfRengi(1)).toBe("#f5a623");   // Elif sarı
    expect(harfRengi(2)).toBe("#ec4899");   // Be pembe
  });

  it("renkler birbirinden ayrı (aynı renk iki harfe verilmemiş)", () => {
    const hepsi = Object.values(HARF_RENGI);
    expect(new Set(hepsi).size).toBe(hepsi.length);
  });
});

describe("türkçe ek üretimi", () => {
  /** ⚠️ Ekranda "çanakı sil" yazıyordu — k→ğ yumuşaması atlanmıştı. */
  it("ünsüz yumuşaması + ünlü uyumu", () => {
    const beklenen: [string, string][] = [
      ["çanak", "çanağı"], ["kuyruk", "kuyruğu"], ["alt çanak", "alt çanağı"],
      ["son çanak", "son çanağı"], ["derin çanak", "derin çanağı"],
      ["sarkan kuyruk", "sarkan kuyruğu"], ["baş", "başı"], ["diş", "dişi"],
      ["halka", "halkayı"], ["üç diş", "üç dişi"], ["uzun boy", "uzun boyu"],
    ];
    for (const [a, b] of beklenen) expect(belirtmeHali(a), a).toBe(b);
    for (const [a, b] of [["çanak", "çanağını"], ["kuyruk", "kuyruğunu"], ["halka", "halkasını"]] as const) {
      expect(iyelikBelirtme(a), a).toBe(b);
    }
  });

  /** Verideki BÜTÜN kuyruk adları düzgün ek alıyor mu? */
  it("veri içindeki her kuyruk adı 'k' ile bitiyorsa yumuşuyor", () => {
    for (const r of TAIL_RULES) {
      // ⚠️ SONA bak: "kuyruğu" kelimesi BAŞTA "ku" içeriyor, dizgide arama
      // yapmak onu "sert kalmış" sanıyordu (ilk ayracım tam bunu yaptı).
      const e = belirtmeHali(r.tailName);
      expect(/k[ıiuü]$/.test(e), `${r.tailName} → ${e} (son ünsüz yumuşamamış)`).toBe(false);
      expect(/[ğ][ıiuü]$/.test(e), `${r.tailName} → ${e} (yumuşama beklenirdi)`).toBe(true);
    }
  });

  it("arayüzde elle yazılmış ek KALMADI", () => {
    for (const yol of ["src/components/mnemonics/KuyrukAtolyesi.tsx",
                       "src/components/mnemonics/TailErase.tsx",
                       "src/components/mnemonics/EraseGame.tsx"]) {
      const src = oku(yol);
      expect(/\{rule\.(tailName|keepName)\}[a-zçğıöşü]/.test(src), `${yol}: elle ek`).toBe(false);
      expect(/\$\{rule\.(tailName|keepName)\}[a-zçğıöşü]/.test(src), `${yol}: elle ek`).toBe(false);
    }
  });
});
