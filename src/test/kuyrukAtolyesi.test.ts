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
import { HARF_RENGI, harfRengi, kuyrukRengi } from "@/data/harfRenkleri";

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

describe("atölyenin ders akışı", () => {
  /**
   * ⚠️ ÖNCE KUTLAMA, SONRA HARFİN SESİ (kullanıcı: "bir harfi silince o
   * harfin de sesi çıksın, tebrikler sesinden sonra"). İkisi aynı anda
   * çalarsa çan hocanın sesini örter — asıl öğretilecek şey duyulmaz.
   */
  it("silme bitince harfin sesi GECİKMELİ çalar", () => {
    const src = kodu("src/components/mnemonics/KuyrukAtolyesi.tsx");
    expect(/sfx\("kutlama"\)/.test(src), "kutlama sesi yok").toBe(true);
    expect(/HARF_SESI_GECIKME/.test(src), "harf sesi gecikmesi yok").toBe(true);
    expect(/playItem\(/.test(src), "harfin sesi hiç çalınmıyor").toBe(true);
    // gecikme kutlama çanından (~1 sn) kısa olmamalı
    const m = src.match(/HARF_SESI_GECIKME\s*=\s*(\d+)/);
    expect(m, "gecikme sabiti okunamadı").not.toBeNull();
    expect(Number(m![1]), "gecikme çok kısa: çan harfin sesini örter").toBeGreaterThanOrEqual(700);
  });

  /**
   * ⚠️ HARF DEĞİŞİRSE BEKLEYEN SES İPTAL: yoksa önceki harfin sesi yeni
   * harfin üstüne çalar ve çocuk yanlış eşleştirme öğrenir.
   */
  it("harf değişince bekleyen ses iptal edilir", () => {
    const src = kodu("src/components/mnemonics/KuyrukAtolyesi.tsx");
    expect(/clearTimeout\(sesT\.current\)/.test(src), "bekleyen ses iptal edilmiyor").toBe(true);
  });

  /**
   * ⚠️ SAYFADA YALNIZ KUYRUK SİLME OYUNU (kullanıcı kararı: "yazılış hafıza
   * yönteminde sadece kuyruk silme oyunu bulunsun"). Nokta yöntemi, çizgi
   * karşılaştırması, hareke hafızası ve "değişmeyen 6 harf" bölümleri
   * kaldırıldı; pasif izleme animasyonu da atölyeyle aynı şeyi gösterdiği
   * için çıkarıldı.
   */
  it("ders sayfasında başka bölüm kalmadı", () => {
    const src = kodu("src/pages/YazilisHafiza.tsx");
    for (const y of ["DotCompare", "StrokeCompare", "HarekeMnemo", "TailErase", "STABLE_GROUP"]) {
      expect(src.includes(y), `${y} hâlâ sayfada`).toBe(false);
    }
    expect(src.includes("KuyrukAtolyesi"), "kuyruk silme oyunu yok").toBe(true);
  });

  /** Sonraki harfe geçiş hem kendiliğinden hem düğmeyle olmalı. */
  it("sonraki harfe geçiş otomatik VE düğmeli", () => {
    const src = kodu("src/pages/YazilisHafiza.tsx");
    expect(/OTOMATIK_GECIS/.test(src), "otomatik geçiş yok").toBe(true);
    expect(/Sonraki harfe geç/.test(src), "geçiş düğmesi yok").toBe(true);
    // düğme SIRADAKİ HARFİ göstermeli — okuma bilmeyen çocuk gliften anlar
    expect(/TAIL_RULES\[hedefIdx\]\.iso/.test(src), "düğme sıradaki harfi göstermiyor").toBe(true);
  });

  /**
   * ⚠️ KUYRUK RENGİ HARFİN ZITTI OLMALI: sabit kırmızı, kendi rengi kırmızıya
   * yakın harflerde (Cim, Nun, Ğayn, Ra, Ta) kuyruğu görünmez yapıyordu.
   */
  it("her harfte kuyruk rengi gövdeden belirgin farklı", () => {
    const ton = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (d === 0) return 0;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    for (const [n, hex] of Object.entries(HARF_RENGI)) {
      const [r, g, b] = kuyrukRengi(hex);
      const kt = ton(`#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`);
      let fark = Math.abs(ton(hex) - kt);
      fark = Math.min(fark, 360 - fark);
      expect(fark, `harf ${n}: kuyruk gövdeye çok yakın`).toBeGreaterThan(120);
    }
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
