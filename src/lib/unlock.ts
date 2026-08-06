// Konu kilidi sistemi.
// Kural: Bir konudaki tüm itemların SRS seviyesi >= 3 olduğunda sonraki
// konu açılır. İlk konu her zaman açıktır. `noPractice: true` konular
// otomatik olarak "tamamlanmış" sayılır (alıştırma yok).
//
// KONU İÇİ BÖLÜM (CHUNK) KİLİDİ — bilişsel yük teorisi (Sweller):
// Çocuk çalışma belleği ~4 öğe kaldırır; 28 harfi bir anda sormak aşırı
// yüklemedir. Bölümler artık KARIŞAN HARF AİLELERİDİR (elifba.ts SECTIONS):
// birbirine benzeyen harflerin hepsi aynı bölümde olur ki ayrım yan yana
// öğrenilsin. Bir bölümdeki TÜM öğeler L3+'a ulaşınca sıradaki bölüm açılır.
//
// İKİNCİ KOŞUL — KARIŞIKLIK: seviyeler yükselmiş olsa bile çocuk hâlâ o
// bölümün İÇİNDEKİ iki harfi birbirine karıştırıyorsa bölüm geçilmez.
// "Bu bölümü biliyorum" demek, harfleri tek tek tanımak değil, BİRBİRİNDEN
// ayırt edebilmek demektir. Isı üst üste 3 doğru ayrımda düştüğü için
// (confusion.ts) kapı kilitli kalmaz — çocuk ayrımı gösterince açılır.
// Önceki bölümler ASLA yeniden kilitlenmez — açık kalırlar ki SRS seçici
// onları düşük oranda karıştırmaya devam etsin (aralıklı tekrar +
// serpiştirme; Cepeda 2006, Rohrer & Taylor 2007).
import { SUBJECTS, findTopicOfItem } from "@/data/subjects";
import { getTopicSrs, type Level, type Namespace } from "@/data/srs";
import type { ContentItem, ContentTopic } from "@/data/types";
import { isTestUnlockActive } from "@/lib/testUnlock";
import { isTopicSkipped } from "@/lib/placement";
import { heatBetween } from "@/lib/confusion";
import { skillIdsOf, skillOf } from "@/lib/skills";

const NS: Namespace = "quiz";

// Bölümü tutan karışıklık eşiği. Tek yanlış seçim ısıyı 0.34 yapar (kapı
// açık kalır); iki kez aynı ikiliyi karıştırmak 0.68'e çıkarır → kapı kapanır.
// Üç doğru ayrım ısıyı 0.5 düşürdüğü için kapı hemen tekrar açılır.
const SECTION_CONFUSION_MAX = 0.6;

/** Bu bölümün İÇİNDE hâlâ sıcak bir karışıklık var mı? (varsa hangi çift) */
export function hotPairInSection(items: ContentItem[]): [ContentItem, ContentItem] | null {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // Isı BECERİ anahtarıyla kaydediliyor (4. konuda `l2-13-med` gibi),
      // öğe id'siyle sorulursa hep 0 döner ve kapı hiç kapanmaz.
      if (heatBetween(skillOf(items[i]), skillOf(items[j])) >= SECTION_CONFUSION_MAX) {
        return [items[i], items[j]];
      }
    }
  }
  return null;
}

export function isTopicCompleted(topic: ContentTopic): boolean {
  if (topic.noPractice) return true;
  const srs = getTopicSrs(NS, topic.id);
  if (topic.items.length === 0) return true;
  // ⚠️ ÖĞE değil BECERİ sayılır. "3. Harekeler"de 84 öğe var ama ölçülen 3
  // şey: üstün/esre/ötre. Öğe başına saysaydık konu 168 doğru cevap isterdi
  // (aşırı alıştırma); beceri başına sayınca çocuk harekeyi anladığında
  // biter. Skill'i olmayan konularda skillIdsOf öğe id'lerini döndürür,
  // yani davranış aynen korunur.
  for (const sk of skillIdsOf(practiceItems(topic.items))) {
    const lvl = (srs[sk]?.level ?? 1) as Level;
    if (lvl < 3) return false;
  }
  // Bölüm kilidiyle aynı ilke: seviyeler tamam olsa da hâlâ karıştırdığı bir
  // ikili varsa konu bitmiş sayılmaz (yoksa bölümler kilitliyken konu açılıp
  // tutarsız bir durum çıkardı).
  return !hotPairInSection(topic.items);
}

export function getUnlockedTopicIds(): Set<string> {
  const out = new Set<string>();
  if (isTestUnlockActive()) {
    for (const s of SUBJECTS) for (const t of s.topics) out.add(t.id);
    return out;
  }
  for (const s of SUBJECTS) {
    let allowNext = true;
    for (const t of s.topics) {
      if (allowNext) {
        out.add(t.id);
        // Konu ya normal tamamlandıysa (tüm öğeler L3+) YA DA hızlı-geçişle
        // atlandıysa sonraki konu açılır.
        allowNext = isTopicCompleted(t) || isTopicSkipped(t.id);
      }
    }
  }
  return out;
}

export function isTopicUnlocked(topicId: string): boolean {
  return getUnlockedTopicIds().has(topicId);
}

// Bir item hangi konuya ait? → o konu açık mı?
export function isItemInUnlockedTopic(itemId: string, unlocked?: Set<string>): boolean {
  const set = unlocked ?? getUnlockedTopicIds();
  const t = findTopicOfItem(itemId);
  if (!t) return false;
  return set.has(t.topicId);
}

// ---- Konu içi bölüm (chunk) kilidi ----

// Bölümler item dizisindeki ilk görülme sırasına göre sıralanır.
export function getSectionOrder(topic: ContentTopic): string[] {
  const order: string[] = [];
  for (const it of topic.items) {
    if (it.section && !order.includes(it.section)) order.push(it.section);
  }
  return order;
}

// Açık bölümler: baştan itibaren ustalaşılan (tüm öğeler L3+) bölümler +
// ilk ustalaşılmamış bölüm (aktif çalışma bölümü). Sonrakiler kilitli.
export function getUnlockedSections(topic: ContentTopic): Set<string> {
  const order = getSectionOrder(topic);
  const out = new Set<string>();
  if (isTestUnlockActive()) {
    for (const sec of order) out.add(sec);
    return out;
  }
  // Hızlı-geçişle atlanan konu "biliniyor" varsayılır → tüm bölümleri açık
  // (geri gelip herhangi bir yeri pekiştirebilir; ara-kontrol de her yerden
  // soru çekebilsin).
  if (isTopicSkipped(topic.id)) {
    for (const sec of order) out.add(sec);
    return out;
  }
  const srs = getTopicSrs(NS, topic.id);
  for (const sec of order) {
    out.add(sec);
    const items = practiceItems(topic.items).filter((it) => it.section === sec);
    // Bölüm de BECERİ üzerinden ustalaşır. Harekeler'de her bölüm aynı 3
    // beceriyi taşıdığı için ilk bölüm bitince kalanlar kendiliğinden açılır
    // — özel bir kural gerekmiyor, genelleme doğal olarak çalışıyor.
    const leveled = skillIdsOf(items).every((sk) => ((srs[sk]?.level ?? 1) as Level) >= 3);
    // Seviye yetmez: bölüm içi karışıklık da sönmüş olmalı (ayrım şartı).
    const mastered = leveled && !hotPairInSection(items);
    if (!mastered) break; // burası aktif bölüm — sonrakiler kilitli kalır
  }
  return out;
}

// Konu içinde şu an çalışılabilir öğeler. Bölümsüz öğeler her zaman açıktır.
export function getUnlockedItemsOf(topic: ContentTopic): ContentItem[] {
  const secs = getUnlockedSections(topic);
  return practiceItems(topic.items).filter((it) => !it.section || secs.has(it.section));
}

/** Alıştırmada sorulabilir öğeler — `practice: false` olanlar yalnız görülür. */
export function practiceItems(items: ContentItem[]): ContentItem[] {
  return items.filter((it) => it.practice !== false);
}

// Tüm açık konulardaki açık öğelerin id kümesi — oyun havuzu bunu kullanır.
// ⚠️ ALIŞTIRMASIZ konular (noPractice) havuza GİRMEZ: "Harflerin Yazılışları"
// artık görülüp geçilen bir konu (yeni müfredat). Konu sayfasında alıştırma
// düğmesi yokken oyunun aynı öğeleri sorması tutarsız olurdu — üstelik o
// şekiller tek başına değil, sıradaki konuda HAREKEYLE BİRLİKTE ölçülüyor.
export function getUnlockedItemIdSet(): Set<string> {
  const topics = getUnlockedTopicIds();
  const out = new Set<string>();
  for (const s of SUBJECTS) {
    for (const t of s.topics) {
      if (!topics.has(t.id) || t.noPractice) continue;
      for (const it of getUnlockedItemsOf(t)) out.add(it.id);
    }
  }
  return out;
}
