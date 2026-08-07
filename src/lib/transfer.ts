// AKTARIM ÖLÇÜMÜ — "uygulama biliyor diyor, çocuk gerçekten biliyor mu?"
//
// Neden var: uygulama harfleri ÇOĞUNLUKLA ters yönde ölçüyor (sesi duy →
// şekli seç). Hedef beceri ise üretim: harfi gör → adını SÖYLE (Elifbâ
// kitabının ve Kur'an okumanın istediği yön). Bu ikisi ayrı öğrenilen
// becerilerdir — harf bilgisinde ölçülmüş asimetri şu: adlar seslerin
// öğrenilmesine yardım ediyor, sesler adların öğrenilmesine ETMİYOR.
//
// Gerçek gözlem (kullanıcı): eski sistemde bütün harfler L4 göründüğü hâlde
// çocuk kitaptan 28 harfin ancak 4-5'ini bildi. O ölçüm eski (yalnız yukarı
// giden) seviye sayacıyla kirlenmişti, ama sorunun kendisi gerçek. Bu modül
// aynı karşılaştırmayı DÜZGÜN yapar: Ölçüm Modu'nda veli çocuğun sesli
// cevabını işaretler, burada o sonuç uygulamanın seviyesiyle yan yana konur.
//
// ⚠️ ÖLÇÜM SRS'E YAZILMAZ (measurement.ts de yazmıyor). Yazsaydı ölçüm
// ölçtüğü şeyi değiştirir, ikinci ölçüm de kirlenirdi.
import { getAllTopics } from "@/data/subjects";
import { getTopicSrs, type Level } from "@/data/srs";
import { skillIdsOf } from "@/lib/skills";
import { practiceItems } from "@/lib/unlock";
import { loadMeasure } from "@/lib/measurement";

/** Bütün alıştırmalı konuları tarayıp beceri → seviye haritası çıkar. */
function levelMap(): Map<string, Level> {
  const m = new Map<string, Level>();
  for (const t of getAllTopics()) {
    if (t.noPractice) continue;
    const srs = getTopicSrs("quiz", t.id);
    for (const sk of skillIdsOf(practiceItems(t.items))) {
      const e = srs[sk];
      if (e && (e.seen ?? 0) > 0) m.set(sk, e.level);
    }
  }
  return m;
}

export interface TransferRow {
  id: string;
  /** Uygulamanın verdiği seviye (0 = hiç görülmemiş) */
  level: number;
  /** Ölçümde İLK denemede bildi mi? */
  bildi: boolean;
  /** Kaçıncı denemede bildi (null = hiç bilemedi) */
  denemede: number | null;
  olculdu: boolean;
}

export interface TransferReport {
  rows: TransferRow[];
  /** Seviye bandına göre: kaç tanesi ölçüldü, kaçını ilk denemede bildi */
  bands: Array<{ level: number; olculen: number; bilen: number }>;
  /** L4+ olan öğelerden ilk denemede bilinenlerin oranı (asıl sayı) */
  l4Aktarim: { olculen: number; bilen: number; oran: number | null };
  l5Aktarim: { olculen: number; bilen: number; oran: number | null };
}

/**
 * ⚠️ "BİLDİ" = YALNIZ İLK DENEMEDE bilmek.
 * Ölçüm Modu'nda bilemeyen öğe kuyruğun sonuna atılıp tekrar soruluyor;
 * ikinci turda bilmek "biliyordu" değil "arada öğrendi/hatırladı" demek.
 * Aktarım oranını şişirmemek için yalnız ilk deneme sayılır.
 */
export function buildTransferReport(itemIds: string[]): TransferReport {
  const lv = levelMap();
  const store = loadMeasure();
  const rows: TransferRow[] = itemIds.map((id) => {
    const e = store[id];
    return {
      id,
      level: lv.get(id) ?? 0,
      bildi: e?.firstCorrectAt === 1,
      denemede: e?.firstCorrectAt ?? null,
      olculdu: !!e,
    };
  });
  const bands: TransferReport["bands"] = [];
  for (let l = 0; l <= 5; l++) {
    const grup = rows.filter((r) => r.level === l && r.olculdu);
    if (grup.length === 0) continue;
    bands.push({ level: l, olculen: grup.length, bilen: grup.filter((r) => r.bildi).length });
  }
  const bandOzet = (esik: number) => {
    const g = rows.filter((r) => r.level >= esik && r.olculdu);
    const bilen = g.filter((r) => r.bildi).length;
    return { olculen: g.length, bilen, oran: g.length ? bilen / g.length : null };
  };
  return { rows, bands, l4Aktarim: bandOzet(4), l5Aktarim: bandOzet(5) };
}

/**
 * Raporu tek parça metne çevirir — veli panelden kopyalayıp paylaşabilsin.
 * (Elimizdeki tek GERÇEK veri bu; simülasyonun aktarım katsayısı buradan
 * kalibre edilecek.)
 */
export function transferSummaryText(r: TransferReport, isim = "Aktarım ölçümü"): string {
  const satir: string[] = [`${isim}`];
  const yuzde = (a: number, b: number) => (b ? `%${Math.round((100 * a) / b)}` : "—");
  for (const b of r.bands) {
    const ad = b.level === 0 ? "Hiç görülmemiş" : `L${b.level}`;
    satir.push(`  ${ad.padEnd(16)} ${String(b.olculen).padStart(3)} ölçüldü → ${b.bilen} bildi (${yuzde(b.bilen, b.olculen)})`);
  }
  satir.push(`  L4+ AKTARIM: ${r.l4Aktarim.bilen}/${r.l4Aktarim.olculen} = ${yuzde(r.l4Aktarim.bilen, r.l4Aktarim.olculen)}`);
  if (r.l5Aktarim.olculen > 0) {
    satir.push(`  L5  AKTARIM: ${r.l5Aktarim.bilen}/${r.l5Aktarim.olculen} = ${yuzde(r.l5Aktarim.bilen, r.l5Aktarim.olculen)}`);
  }
  const bilemez = r.rows.filter((x) => x.olculdu && !x.bildi && x.level >= 4).map((x) => x.id);
  if (bilemez.length) satir.push(`  L4+ olup bilemedikleri: ${bilemez.join(", ")}`);
  return satir.join("\n");
}
