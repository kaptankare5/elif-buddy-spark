// Oyunlardaki test-soru cevaplarını ilerleme (SRS) sistemine kaydeder.
//
// MOD MANTIĞI (tek merkez):
// - Süper Öğrenme modu: her oyun cevabı ilerlemeye (SRS) etki eder — tam
//   öğrenme deneyimi.
// - Normal oyun modu: eğlence önceliklidir; her cevap SRS'i grind'lemez.
//   Yalnızca her N (NORMAL_TEST_EVERY) cevapta 1'i "arada test" olarak
//   sayılır (sık değil). Böylece çocuk oynarken az da olsa ilerler.
// - Gerçek Test/Quiz oyunu (gameId "quiz") her zaman sayılır — o bir testtir.
// Not: Topic Test ve Flashcard bu fonksiyondan geçmez; onlar recordSrsAnswer'ı
// doğrudan çağırır ve her zaman ilerlemeye etki eder.
import { getTopicSrs, pickNextLetterFromTopic, recordSrsAnswer, type Level, type TopicSrs } from "@/data/srs";
import { findTopicOfItem } from "@/data/subjects";
import { getGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";

const NS = "quiz" as const;
const NORMAL_TEST_EVERY = 3; // normal modda her 3 cevapta 1'i SRS'e sayılır
let _normalAnswerCount = 0;
const GAME_TEST_EVENT = "elifba-game-test-counted";

export function recordGameAnswer(
  item: ContentItem | undefined | null,
  correct: boolean,
  meta?: { responseMs?: number; gameId?: string },
) {
  if (!item) return;
  const t = findTopicOfItem(item.id);
  if (!t) return;

  // Süper mod veya gerçek Quiz oyunu → her zaman say. Normal mod → her 3'te 1.
  const alwaysCount = getGameMode() === "super" || meta?.gameId === "quiz";
  if (!alwaysCount) {
    _normalAnswerCount += 1;
    if (_normalAnswerCount % NORMAL_TEST_EVERY !== 0) return; // bu cevap eğlence, sayılmaz
    // Bu cevap "arada test" olarak sayılıyor — küçük görsel sinyal için olay yay.
    try { window.dispatchEvent(new CustomEvent(GAME_TEST_EVENT, { detail: { correct } })); } catch { /* ignore */ }
  }

  try {
    recordSrsAnswer(NS, t.topicId, item.id, correct, meta);
  } catch { /* ignore */ }
}

// Oyun-içi GERÇEK mini test (çoktan seçmeli soru). Moddan bağımsız her zaman
// ilerlemeye yazılır — çünkü bu bir testtir (normal modda oyunlar arasında çıkar).
export function recordInGameTest(item: ContentItem | undefined | null, correct: boolean) {
  if (!item) return;
  const t = findTopicOfItem(item.id);
  if (!t) return;
  try { recordSrsAnswer(NS, t.topicId, item.id, correct); } catch { /* ignore */ }
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
