// Denetim sorusunun KURULUMU (politikası lib/audit.ts'te, arayüzü
// components/AuditCard.tsx'te).
//
// ⚠️ Neden ayrı dosya: `audit.ts` srs.ts tarafından import ediliyor (üretim
// puanını güven katsayısıyla ölçeklemek için). Soru kurulumu srs/confusion/
// skills'e ihtiyaç duyduğu için audit.ts'e konulsaydı DÖNGÜSEL bağımlılık
// olurdu. Bu dosyayı srs.ts import etmez → döngü yok.
import { pickDistractors } from "@/lib/confusion";
import { getTopicSrs, type Namespace } from "@/data/srs";
import { skillOf } from "@/lib/skills";
import { SIK_SAYISI } from "@/lib/audit";
import type { ContentItem } from "@/data/types";

export interface AuditQuestion {
  target: ContentItem;
  options: ContentItem[];
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/**
 * Denetlenecek harfi ve şıklarını seç.
 *
 * HEDEF = çocuğun BİLDİĞİNİ İDDİA ETTİĞİ harf (L3+ ve görülmüş). Henüz
 * öğrenilmekte olan bir harfi denetlemek bize bir şey söylemez — biz beyanın
 * doğruluğunu ölçüyoruz, öğrenmeyi değil.
 *
 * ⚠️ ŞIKLAR SESTİR: iki şıkkın AYNI mp3'ü çalması sorunun İKİ doğru cevabı
 * olması demektir (Fe'nin yalın/başta/ortada/sonda hâlleri hep basic-20.mp3
 * çalar). Bu yüzden çeldiriciler ŞEKLE değil SES DOSYASINA göre elenir —
 * normal testteki `sameSound` kuralının bu formattaki karşılığı.
 *
 * null dönerse denetim yapılamaz → çağıran taraf normal soruya döner.
 */
export function pickAuditQuestion(
  pool: ContentItem[],
  ns: Namespace,
  topicId: string,
): AuditQuestion | null {
  const sesli = pool.filter((i) => !!i.audio);
  if (sesli.length < SIK_SAYISI) return null;
  const srs = getTopicSrs(ns, topicId);
  const adaylar = sesli.filter((i) => {
    const e = srs[skillOf(i)];
    return e && (e.seen ?? 0) > 0 && e.level >= 3;
  });
  if (adaylar.length === 0) return null;
  const target = adaylar[Math.floor(Math.random() * adaylar.length)];
  // Önce şekil karışanları (en bilgilendirici çeldiriciler), sonra aynı sesi
  // çalanları ele; yetmezse havuzdan farklı sesli öğelerle tamamla.
  const aday = pickDistractors(sesli, target, SIK_SAYISI + 1);
  const secili: ContentItem[] = [];
  const kullanilanSes = new Set<string>([target.audio!]);
  for (const d of [...aday, ...shuffle(sesli)]) {
    if (secili.length >= SIK_SAYISI - 1) break;
    if (!d.audio || kullanilanSes.has(d.audio)) continue;
    kullanilanSes.add(d.audio);
    secili.push(d);
  }
  if (secili.length < SIK_SAYISI - 1) return null;
  return { target, options: shuffle([target, ...secili]) };
}
