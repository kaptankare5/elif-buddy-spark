// Cevapları Supabase'e (giriş yapan kullanıcılar için) kaydeder.
// Sessiz davranır — kullanıcı giriş yapmamışsa hiçbir şey yapmaz.
import { supabase } from "@/integrations/supabase/client";
import { getGameMode } from "@/lib/gameMode";


export interface LogAnswerParams {
  topicId: string;
  letterId: string;
  correct: boolean;
  gameId?: string;
  responseMs?: number;
  // SRS hesabından gelen güncel durum
  knewBefore?: boolean;
  learnedAtMs?: number;     // epoch ms — seviye 3'e ilk ulaştığı an
  timeToLearnMs?: number;   // öğrenmeye kadar harcanan toplam cevap süresi
  totalResponseMs?: number; // tüm karşılaşmaların toplam süresi
  level?: number;
}

export async function logAnswer(params: LogAnswerParams) {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return null;

  const { data, error } = await supabase.rpc("record_letter_answer", {
    _topic_id: params.topicId,
    _letter_id: params.letterId,
    _correct: params.correct,
    _game_id: params.gameId,
    _response_ms: params.responseMs,
    _mode: getGameMode(),
  });
  if (error) throw error;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("elifba-progress-updated"));
    window.dispatchEvent(new Event("elifba-srs-quiz-updated"));
    window.dispatchEvent(new Event("elifba-srs-games-updated"));
  }

  return data;
}

export async function markKnewBefore(topicId: string, letterId: string, knewBefore: boolean) {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return;
  const { data: existing } = await supabase
    .from("letter_stats").select("id")
    .eq("user_id", user.id).eq("topic_id", topicId).eq("letter_id", letterId).maybeSingle();
  if (existing) {
    await supabase.from("letter_stats").update({ knew_before: knewBefore }).eq("id", existing.id);
  } else {
    await supabase.from("letter_stats").insert({
      user_id: user.id, topic_id: topicId, letter_id: letterId, knew_before: knewBefore,
    });
  }
}
