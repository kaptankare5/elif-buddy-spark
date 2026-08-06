// 🎯 BECERİ KATMANI — "soru neyi gösterir" ile "soru neyi ölçer" ayrımı.
//
// Uygulamanın çoğu konusunda ikisi aynıdır: Elif sorulur, Elif'in seviyesi
// değişir. Ama yeni müfredatta iki konu bunu ayırıyor:
//
//   3. Harekeler          → 84 hece sorulur, ÖLÇÜLEN 3 şey: üstün/esre/ötre
//   4. Harf + Hareke      → "şe" sorulur, ÖLÇÜLEN şın'ın ORTADAKİ hâli
//
// Neden: 3. konuda yeni bilgi 84 değil 3 tanedir (28 harf 1. konuda zaten
// öğrenildi, burada eklenen sadece üç işaret). 84 öğeyi tek tek L3'e
// çıkarmak 168 doğru cevap demek — aşırı alıştırma. Çocuk harekeyi
// anladıysa konu biter. 4. konuda ise tersi: hareke bilindiği için hata
// harfin ŞEKLİNE yazılır, böylece 2. konuda alıştırmasız geçilen
// başta/ortada/sonda hâlleri burada gerçekten ölçülür.
//
// ⚠️ TEK KURAL: cevaptan sonraki HER ŞEY beceri anahtarını kullanır —
// SRS seviyesi, karışıklık ısısı, telafi. Soru üretimi ise tersine çalışır:
// seçici bir BECERİ seçer, sonra o beceriyi taşıyan öğelerden biri soru
// olur. İkisini karıştırmak sessiz hatalara yol açar (öğe id'siyle yazıp
// beceri id'siyle okumak gibi).
import type { ContentItem, ContentTopic } from "@/data/types";

/** Bu öğe cevaplandığında hangi anahtarın seviyesi değişir? */
export function skillOf(item: ContentItem): string {
  return item.skill ?? item.id;
}

/** Konuda ölçülen beceriler — müfredat sırası korunur, tekrarsız. */
export function topicSkillIds(topic: ContentTopic): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of topic.items) {
    const s = skillOf(it);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

/** Verilen öğe listesindeki beceriler (açık bölümlerle sınırlamak için). */
export function skillIdsOf(items: ContentItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const s = skillOf(it);
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

/** Bu beceriyi taşıyan öğeler (soru malzemesi). */
export function itemsForSkill(items: ContentItem[], skillId: string): ContentItem[] {
  return items.filter((it) => skillOf(it) === skillId);
}

/**
 * Beceri seçildi — soru olarak hangi öğe gösterilsin?
 *
 * Rastgele seçilir ki çocuk aynı beceriyi hep aynı harfle görmesin: üstün
 * becerisi bir soruda "be", ötekinde "ce" ile sorulur. Ses şartı burada
 * uygulanmaz — çağıran taraf (oyun havuzu) zaten sesli öğeleri süzüyor.
 */
export function pickItemForSkill(items: ContentItem[], skillId: string): ContentItem | undefined {
  const adaylar = itemsForSkill(items, skillId);
  if (adaylar.length === 0) return undefined;
  return adaylar[Math.floor(Math.random() * adaylar.length)];
}

/** Konu "beceri temelli" mi? (en az bir öğede ayrı skill var) */
export function isSkillTopic(topic: ContentTopic): boolean {
  return topic.items.some((it) => !!it.skill);
}
