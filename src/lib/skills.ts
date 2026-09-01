// 🎯 BECERİ KATMANI — "soru neyi gösterir" ile "soru neyi ölçer" ayrımı.
//
// Uygulamanın çoğu konusunda ikisi aynıdır: Elif sorulur, Elif'in seviyesi
// değişir. Ama müfredatta bir konu bunu ayırıyor:
//
//   3. Harekeler          → 84 hece sorulur, ÖLÇÜLEN 3 şey: üstün/esre/ötre
//
// Neden: 3. konuda yeni bilgi 84 değil 3 tanedir (28 harf 1. konuda zaten
// öğrenildi, burada eklenen sadece üç işaret). 84 öğeyi tek tek L3'e
// çıkarmak 168 doğru cevap demek — aşırı alıştırma. Çocuk harekeyi
// anladıysa konu biter.
//
// ⚠️ Bir dönem "4. Harf + Hareke Alıştırması" da bunu kullanıyordu ("şe"
// sorulur, şın'ın ORTADAKİ hâli ölçülür). Kullanıcı kararıyla silindi:
// harekeli harf alıştırması zaten oyunlarda yapılıyor. Katman genel kaldı,
// yeni bir konu aynı ayrımı isterse hazır.
//
// ⚠️ TEK KURAL: cevaptan sonraki HER ŞEY beceri anahtarını kullanır —
// SRS seviyesi, karışıklık ısısı, telafi. Soru üretimi ise tersine çalışır:
// seçici bir BECERİ seçer, sonra o beceriyi taşıyan öğelerden biri soru
// olur. İkisini karıştırmak sessiz hatalara yol açar (öğe id'siyle yazıp
// beceri id'siyle okumak gibi).
import type { ContentItem, ContentTopic } from "@/data/types";
import { SUBJECTS } from "@/data/subjects";
import { getTopicSrs, type Level } from "@/data/srs";

/**
 * ÖN KOŞUL EŞİĞİ — bir beceriyi "kesin biliyor" saymak için gereken seviye.
 * L4 = otomatiklik (kullanıcı kararı: "emin ol o konuyu bildiğine").
 * L3 "biliyor ama tereddütlü" demek; o kadarına dayanıp hatayı başka bir
 * beceriye yazmak yanlış teşhis riski taşır.
 */
export const PREREQ_LEVEL: Level = 4;

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


// --- ÖN KOŞUL (prereqSkill) ---
// Bir soru başka bir beceriyi BİLDİĞİNİ varsayıyorsa, hata nereye yazılmalı?
// Örnek: "şe" sorusu şın'ın ortadaki hâlini ölçer, AMA bu ancak çocuk fethayı
// gerçekten biliyorsa geçerli bir çıkarımdır. Fetha sağlam değilse yanlış
// cevabı harfin şekline yazmak YANLIŞ TEŞHİS olur — çocuk aslında harekeyi
// bilmiyordur ve şekil boşuna cezalandırılır.
// ⚠️ Şu an hiçbir konu `prereqSkill` kullanmıyor (bkz. yukarıdaki not);
// kural duruyor, bekçisi `skills.test.ts`.

let _skillTopic: Map<string, string> | null = null;
/** Bu beceri hangi konunun SRS kovasında tutuluyor? */
export function topicIdOfSkill(skillId: string): string | undefined {
  if (!_skillTopic) {
    _skillTopic = new Map();
    for (const s of SUBJECTS) {
      for (const t of s.topics) {
        for (const it of t.items) {
          const sk = skillOf(it);
          if (!_skillTopic.has(sk)) _skillTopic.set(sk, t.id);
        }
      }
    }
  }
  return _skillTopic.get(skillId);
}

/** Bir becerinin şu anki seviyesi (bilinmiyorsa 1). */
export function skillLevel(skillId: string, ns: "quiz" | "games" = "quiz"): Level {
  const tid = topicIdOfSkill(skillId);
  if (!tid) return 1;
  return (getTopicSrs(ns, tid)[skillId]?.level ?? 1) as Level;
}

/**
 * YANLIŞ cevap kimin hanesine yazılsın?
 *
 * Ön koşul yoksa ya da ön koşul L4'teyse → öğenin kendi becerisi (şekil).
 * Ön koşul zayıfsa → ÖN KOŞUL. Çocuk "şe"yi bilemediyse ve fethası da
 * sağlam değilse, sorun büyük ihtimalle şın'ın şekli değil fethadır.
 */
export function blameTarget(
  item: ContentItem,
  fallbackTopicId: string,
): { topicId: string; skillId: string; prereqBlamed: boolean } {
  const own = { topicId: fallbackTopicId, skillId: skillOf(item), prereqBlamed: false };
  const pre = item.prereqSkill;
  if (!pre) return own;
  if (skillLevel(pre) >= PREREQ_LEVEL) return own;
  const tid = topicIdOfSkill(pre);
  if (!tid) return own;
  return { topicId: tid, skillId: pre, prereqBlamed: true };
}
