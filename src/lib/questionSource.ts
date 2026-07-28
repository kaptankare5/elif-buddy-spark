// SORU NEREDEN GELSİN? — Test ekranının tek karar noktası.
//
// Üç kaynak var ve aralarındaki ÖNCELİK kritik:
//   • retry    — az önce yanlış yapılan harf hemen tekrar (düzeltici tekrar)
//   • review   — eski bir AÇIK konudan bakım sorusu (serpiştirme, review.ts)
//   • frontier — bu konunun normal SRS seçimi
//
// Bu karar eskiden Topic.tsx'in içindeydi ve İKİ hatası vardı:
//
// 1) RETRY AÇLIĞI: yanlış cevapta harf tekrar soruluyordu; tekrar da yanlışsa
//    YİNE kuyruğa giriyordu. Çocuk bilmediği bir harfte kilitleniyor, her soru
//    aynı harf oluyor, bakım kanalı hiç sıraya gelmiyordu. Uyarlanır zorluk
//    "kolay soru ver" demek istiyor ama konu içinde kolay öğe yok (hepsi L1) —
//    kolay olan ÖNCEKİ konunun ustalaşılmış harfleri, oraya da hiç sıra
//    gelmiyordu. Artık bir harf üst üste EN FAZLA BİR KEZ tekrar sorulur.
//
// 2) ZORLANIRKEN KURTARMA: çocuk zorlanıyorsa (son cevapların doğruluğu düşük)
//    bakım sorusu retry'den ÖNCE gelir. Zaten bakım payı o bantta %50'ye
//    çıkıyor (review.ts); önceliği de vermezsek pay hiç kullanılamıyordu.
import { getFlowBand, type Namespace } from "@/data/srs";
import { pickReviewItem } from "@/lib/review";

export type QuestionSource =
  | { kind: "retry"; itemId: string }
  | { kind: "review"; topicId: string; itemId: string }
  | { kind: "frontier" };

export interface QuestionSourceInput {
  /** Yanlış cevaplanıp tekrar sorulmayı bekleyen harf (yoksa null) */
  retryId: string | null;
  /** Bu harf ZATEN bir kez tekrar soruldu mu? (evetse bir daha zorlanmaz) */
  retryUsed: boolean;
  /** Bu konuda şu an sorulabilir (açık bölüm) harf id'leri */
  unlockedIds: string[];
  currentTopicId: string;
  ns: Namespace;
}

export function pickQuestionSource(input: QuestionSourceInput): QuestionSource {
  const { retryId, retryUsed, unlockedIds, currentTopicId, ns } = input;
  const canRetry = !!retryId && !retryUsed && unlockedIds.includes(retryId);
  const struggling = getFlowBand() === "struggling";

  // Zorlanıyorsa önce kurtarma: eski konudan bilinen bir harf gelsin.
  if (struggling) {
    const rev = pickReviewItem(currentTopicId, ns);
    if (rev) return { kind: "review", topicId: rev.topicId, itemId: rev.itemId };
  }

  if (canRetry) return { kind: "retry", itemId: retryId! };

  if (!struggling) {
    const rev = pickReviewItem(currentTopicId, ns);
    if (rev) return { kind: "review", topicId: rev.topicId, itemId: rev.itemId };
  }

  return { kind: "frontier" };
}
