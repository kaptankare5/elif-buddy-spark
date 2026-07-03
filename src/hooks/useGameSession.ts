// Oyun süresi/skoru için: mount→başlat, unmount→bitir. Sayaçları ref'le güncelle.
import { useEffect, useRef } from "react";
import { startGameSession, endGameSession } from "@/lib/analytics";

export function useGameSession(gameId: string, topicId?: string | null) {
  const sessionId = useRef<string | null>(null);
  const startedAt = useRef<number>(Date.now());
  const stats = useRef({ correct: 0, wrong: 0, score: 0, completed: false });

  useEffect(() => {
    startedAt.current = Date.now();
    let cancelled = false;
    void (async () => {
      const id = await startGameSession(gameId, topicId);
      if (!cancelled) sessionId.current = id;
    })();
    return () => {
      cancelled = true;
      void endGameSession(sessionId.current, {
        correct: stats.current.correct,
        wrong: stats.current.wrong,
        score: stats.current.score,
        completed: stats.current.completed,
        startedAt: startedAt.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, topicId]);

  return {
    recordCorrect: (n = 1) => { stats.current.correct += n; },
    recordWrong:   (n = 1) => { stats.current.wrong += n; },
    addScore:      (n = 1) => { stats.current.score += n; },
    setCompleted:  (v = true) => { stats.current.completed = v; },
  };
}
