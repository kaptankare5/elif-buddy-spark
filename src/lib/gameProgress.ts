// Oyunlardaki test-soru cevaplarını ilerleme (SRS) sistemine kaydeder.
//
// MOD MANTIĞI (tek merkez):
// - Süper Öğrenme modu: her oyun cevabı ilerlemeye (SRS) etki eder — tam
//   öğrenme deneyimi. (Varsayılan mod budur.)
// - Normal oyun modu: SADECE EĞLENCE — hiçbir oyun cevabı seviyeyi
//   değiştirmez. Eskiden her 3 cevaptan 1'i "arada test" diye sayılıyordu;
//   kullanıcı şartıyla kaldırıldı: çocuk hangi cevabın sayıldığını
//   bilemediği için ilerleme rastlantısal görünüyordu ve oyun "düzgün test
//   etmiyor" hissi veriyordu. Normal modda ilerleme Test/Flashcard'dan
//   ve oyun-içi gerçek mini testten (recordInGameTest) gelir.
// - Gerçek Test/Quiz oyunu (gameId "quiz") her zaman sayılır — o bir testtir.
// Not: Topic Test ve Flashcard bu fonksiyondan geçmez; onlar recordSrsAnswer'ı
// doğrudan çağırır ve her zaman ilerlemeye etki eder.
import { getTopicSrs, pickNextLetterFromTopic, recordSrsAnswer, type Level, type TopicSrs } from "@/data/srs";
import { findTopicOfItem } from "@/data/subjects";
import { getGameMode } from "@/lib/gameMode";
import { recordConfusionPick, recordDiscrimination, recordMiss } from "@/lib/confusion";
import { considerRemedy, queueRemedy } from "@/lib/remedial";
import type { ContentItem } from "@/data/types";
import { blameTarget, pickItemForSkill, skillOf } from "@/lib/skills";
import { ogretildiMi } from "@/lib/askMode";

const NS = "quiz" as const;

export function recordGameAnswer(
  item: ContentItem | undefined | null,
  correct: boolean,
  meta?: { responseMs?: number; gameId?: string; chosenId?: string; shownIds?: string[] },
) {
  if (!item) return;
  const t = findTopicOfItem(item.id);
  if (!t) return;

  // KARIŞIKLIK ÖLÇÜMÜ moddan BAĞIMSIZ çalışır: normal modda cevapların 2/3'ü
  // SRS'e sayılmaz ama çocuk yine de karıştırmıştır — o bilgi kaybolmamalı.
  // Oyun hangi harfi seçtiğini bildirdiyse kesin sinyal, bildirmediyse
  // a-priori benzerlere hafif ısı dağıtılır.
  recordConfusionSignal(skillOf(item), correct, meta?.chosenId, meta?.shownIds);

  // Süper mod veya gerçek Quiz oyunu → SRS'e yazılır. Normal mod → yazılmaz
  // (yalnız yukarıdaki karışıklık ölçümü çalışır; o bir seviye değişikliği
  // değil, çocuğun neyi neyle karıştırdığının kaydıdır).
  if (getGameMode() !== "super" && meta?.gameId !== "quiz") return;

  try {
    // Yanlışta ön koşul kontrolü (bkz. skills.blameTarget): hareke sağlam
    // değilse hata şekle değil harekeye yazılır.
    const hedef = correct
      ? { topicId: t.topicId, skillId: skillOf(item) }
      : blameTarget(item, t.topicId);
    // ⚠️ "Öğret" modunda soru sorulmadan hemen önce cevap çocuğa gösterildi.
    // Bunu SRS'e bildirmezsek hızlı geçiş devreye girip harfi tek doğruda
    // L3 yapıyor — oysa çocuk hatırlamadı, kopyaladı. Bayrak tek kullanımlık
    // (bkz. askMode.ogretildiMi), oyunların hiçbir şey yapmasına gerek yok.
    const ogretildi = ogretildiMi(item.id);
    recordSrsAnswer(NS, hedef.topicId, hedef.skillId, correct,
      ogretildi ? { ...meta, ogretildi: true } : meta);
  } catch { /* ignore */ }
}

// Oyun-içi GERÇEK mini test (çoktan seçmeli soru). Moddan bağımsız her zaman
// ilerlemeye yazılır — çünkü bu bir testtir (normal modda oyunlar arasında çıkar).
export function recordInGameTest(
  item: ContentItem | undefined | null,
  correct: boolean,
  meta?: { chosenId?: string; shownIds?: string[] },
) {
  if (!item) return;
  const t = findTopicOfItem(item.id);
  if (!t) return;
  recordConfusionSignal(skillOf(item), correct, meta?.chosenId, meta?.shownIds);
  const hedef = correct
    ? { topicId: t.topicId, skillId: skillOf(item) }
    : blameTarget(item, t.topicId);
  try { recordSrsAnswer(NS, hedef.topicId, hedef.skillId, correct); } catch { /* ignore */ }
}

/** Oyun cevabını karışıklık motoruna aktar (tek merkez). */
function recordConfusionSignal(
  targetId: string, correct: boolean, chosenId?: string, shownIds?: string[],
) {
  try {
    if (correct) {
      if (shownIds?.length) recordDiscrimination(targetId, shownIds);
    } else if (chosenId && chosenId !== targetId) {
      recordConfusionPick(targetId, chosenId);
    } else {
      recordMiss(targetId);
    }
    // TELAFİ: oyunun ORTASINDA açılmaz — kuyruğa alınır, oyun bitince çıkar.
    if (!correct) queueRemedy(considerRemedy(targetId, chosenId));
  } catch { /* ölçüm oyunu bozmasın */ }
}

export function getGameItemLevel(item: ContentItem | undefined | null): Level {
  if (!item) return 1;
  const t = findTopicOfItem(item.id);
  if (!t) return 1;
  return (getTopicSrs(NS, t.topicId)[skillOf(item)]?.level ?? 1) as Level;
}

/**
 * Oyunda doğru şıkkın çevresinde İPUCU HALKASI yansın mı?
 *
 * Kural: seviye 1 ise yanar — AMA harfle İLK KEZ karşılaşıyorsa YANMAZ.
 * ⚠️ Bu, srs.ts'teki hızlı geçişin ayrılmaz parçası: ilk doğru cevap harfi
 * doğrudan L3'e çıkarıyor ("zaten biliyormuş" sayılıyor). İlk karşılaşmada
 * doğru cevabı parlatırsak çocuk harfi tanımadan da doğru basar ve hiç
 * bilmediği harf L3 olur — ölçüm çöker. İlk karşılaşma DÜRÜST bir yoklama
 * olmak zorunda; ipucu ikinci karşılaşmadan itibaren devreye girer.
 */
export function showHintFor(item: ContentItem | undefined | null): boolean {
  if (!item) return false;
  const t = findTopicOfItem(item.id);
  if (!t) return false;
  const e = getTopicSrs(NS, t.topicId)[skillOf(item)];
  if (!e || (e.seen ?? 0) === 0) return false;   // ilk karşılaşma → ipucu YOK
  return ((e.level ?? 1) as Level) === 1;
}

// --- Süper öğrenme: yanlış cevaplanan soruyu tekrar sorma kuyruğu ---
// Oyunlar wrong answer'da `enqueueRetryItem(item)` çağırır.
// Bir sonraki `pickNextGameItem` çağrısı kuyruktaki item'ı verir (havuzda varsa).
const _retryQueue: string[] = [];

export function enqueueRetryItem(item: ContentItem | undefined | null) {
  if (!item) return;
  // Aynı id zaten kuyruktaysa tekrar ekleme
  if (_retryQueue.includes(item.id)) return;
  _retryQueue.push(item.id);
}

export function clearRetryQueue() { _retryQueue.length = 0; }

// SON SORULANLAR — seçimin SRS'ten BAĞIMSIZ ilerlemesini sağlar.
// Normal modda oyun cevabı SRS'e yazılmadığı için seçicinin gördüğü durum
// hiç değişmiyor ve her çağrıda aynı harf (müfredatın ilk görülmemişi)
// dönüyordu: "sürekli aynı soruyu soruyor". Son sorulanları havuzdan
// çıkarmak bunu moddan bağımsız çözer; süper modda da arka arkaya tekrarı
// engelleyen ikinci bir emniyet olur.
const RECENT_ASKED_MAX = 4;
const _recentAsked: string[] = [];

export function clearRecentAsked() { _recentAsked.length = 0; }

function rememberAsked(id: string) {
  const i = _recentAsked.indexOf(id);
  if (i >= 0) _recentAsked.splice(i, 1);
  _recentAsked.push(id);
  while (_recentAsked.length > RECENT_ASKED_MAX) _recentAsked.shift();
}

export function pickNextGameItem(pool: ContentItem[]): ContentItem | undefined {
  if (pool.length === 0) return undefined;
  // Önce retry kuyruğunu kontrol et
  while (_retryQueue.length > 0) {
    const id = _retryQueue.shift()!;
    const found = pool.find((p) => p.id === id);
    if (found) { rememberAsked(skillOf(found)); return found; }
  }
  // Son sorulanları ele — ama havuz çeldirici kuracak kadar (3) kalmalı.
  // Tampon BECERİ tutar: aynı harekeyi arka arkaya sormamak için.
  let usable = pool.filter((p) => !_recentAsked.includes(skillOf(p)));
  if (usable.length < 3) usable = pool;

  // ⚠️ Seçici ÖĞE değil BECERİ seçer. "3. Harekeler"de 84 öğe tek bir
  // üstün/esre/ötre üçlüsünü ölçüyor; öğe üzerinden seçseydik aynı beceri
  // 28 kez ayrı ayrı "yeni harf" gibi görünürdü. Beceri seçildikten sonra
  // onu taşıyan öğelerden biri rastgele soru olur — böylece çocuk aynı
  // harekeyi her seferinde başka harfle görür. Skill'i olmayan konularda
  // beceri = öğe id'si, yani davranış aynen korunur.
  const synthetic: TopicSrs = {};
  const skillIds: string[] = [];
  for (const item of usable) {
    const sk = skillOf(item);
    if (synthetic[sk]) continue;
    skillIds.push(sk);
    const t = findTopicOfItem(item.id);
    const entry = t ? getTopicSrs(NS, t.topicId)[sk] : undefined;
    synthetic[sk] = entry ?? { level: 1, correct: 0, total: 0, seen: 0, lastSeen: 0, totalMs: 0 };
  }
  const sk = pickNextLetterFromTopic(synthetic, skillIds);
  const chosen = pickItemForSkill(usable, sk) ?? usable[0];
  rememberAsked(skillOf(chosen));
  return chosen;
}

/**
 * Bu harf DAHA ÖNCE görüldü mü? (SRS'te seen > 0)
 *
 * Serbest Oyun havuzu bunu kullanır: ipucu halkasının hep açık olduğu bir
 * modda harfin İLK karşılaşması yaşanmamalı, yoksa çocuk harfi tanımadan
 * doğru basar ve "zaten biliyormuş" ölçümü (srs.ts hızlı geçiş) çöker.
 */
export function isItemSeen(item: ContentItem | undefined | null): boolean {
  if (!item) return false;
  const t = findTopicOfItem(item.id);
  if (!t) return false;
  return (getTopicSrs(NS, t.topicId)[skillOf(item)]?.seen ?? 0) > 0;
}
