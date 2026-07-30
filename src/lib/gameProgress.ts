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
  recordConfusionSignal(item.id, correct, meta?.chosenId, meta?.shownIds);

  // Süper mod veya gerçek Quiz oyunu → SRS'e yazılır. Normal mod → yazılmaz
  // (yalnız yukarıdaki karışıklık ölçümü çalışır; o bir seviye değişikliği
  // değil, çocuğun neyi neyle karıştırdığının kaydıdır).
  if (getGameMode() !== "super" && meta?.gameId !== "quiz") return;

  try {
    recordSrsAnswer(NS, t.topicId, item.id, correct, meta);
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
  recordConfusionSignal(item.id, correct, meta?.chosenId, meta?.shownIds);
  try { recordSrsAnswer(NS, t.topicId, item.id, correct); } catch { /* ignore */ }
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
  return (getTopicSrs(NS, t.topicId)[item.id]?.level ?? 1) as Level;
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

export function pickNextGameItem(pool: ContentItem[]): ContentItem | undefined {
  if (pool.length === 0) return undefined;
  // Önce retry kuyruğunu kontrol et
  while (_retryQueue.length > 0) {
    const id = _retryQueue.shift()!;
    const found = pool.find((p) => p.id === id);
    if (found) return found;
  }
  const synthetic: TopicSrs = {};
  for (const item of pool) {
    const t = findTopicOfItem(item.id);
    const entry = t ? getTopicSrs(NS, t.topicId)[item.id] : undefined;
    synthetic[item.id] = entry ?? { level: 1, correct: 0, total: 0, seen: 0, lastSeen: 0, totalMs: 0 };
  }
  const id = pickNextLetterFromTopic(synthetic, pool.map((p) => p.id));
  return pool.find((p) => p.id === id) ?? pool[0];
}
