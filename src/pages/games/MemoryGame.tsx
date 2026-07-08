import { useEffect, useMemo, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { LangToggle } from "@/components/LangToggle";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { gamePool, pickN, shuffle } from "./_shared";
import { recordGameAnswer } from "@/lib/gameProgress";
import { Volume2 } from "lucide-react";
import type { ContentItem } from "@/data/types";

interface Card { uid: string; item: ContentItem; flipped: boolean; matched: boolean; variant: "a" | "b"; }
interface QuizState { target: ContentItem; options: ContentItem[]; startedAt: number; }

function buildBoard(pairs: number): Card[] {
  const items = pickN(gamePool(), pairs);
  const cards: Card[] = [];
  items.forEach((it) => {
    cards.push({ uid: `${it.id}-a`, item: it, flipped: false, matched: false, variant: "a" });
    cards.push({ uid: `${it.id}-b`, item: it, flipped: false, matched: false, variant: "b" });
  });
  return shuffle(cards);
}

const PAIRS = 6;
// Normal modda "eğlence ağırlıklı" ama arada test soralım — her 3 eşleşmede bir.
const QUIZ_EVERY = 3;

const MemoryGame = () => {
  const [cards, setCards] = useState<Card[]>(() => buildBoard(PAIRS));
  const [first, setFirst] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const [matchesSinceQuiz, setMatchesSinceQuiz] = useState(0);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [quizPicked, setQuizPicked] = useState<string | null>(null);

  const won = useMemo(() => cards.length > 0 && cards.every((c) => c.matched), [cards]);

  const reset = () => {
    setCards(buildBoard(PAIRS)); setFirst(null); setBusy(false); setMoves(0);
    setMatchesSinceQuiz(0); setQuiz(null); setQuizPicked(null);
  };

  const openQuiz = (matchedItem: ContentItem) => {
    const pool = gamePool().filter((it) => it.id !== matchedItem.id);
    const wrongs = pickN(pool, 3);
    // Bilinen harfi hedef yap (az önce eşlediği) — çocuk için doğal ödül
    const target = matchedItem;
    const options = shuffle([target, ...wrongs]);
    setQuiz({ target, options, startedAt: Date.now() });
    setQuizPicked(null);
    setTimeout(() => playItem(target), 200);
  };

  const answerQuiz = async (opt: ContentItem) => {
    if (!quiz || quizPicked) return;
    setQuizPicked(opt.id);
    const correct = opt.id === quiz.target.id;
    const responseMs = Date.now() - quiz.startedAt;
    // gameId: "quiz" → normal modda bile SRS'i günceller (bilinçli test)
    recordGameAnswer(quiz.target, correct, { responseMs, gameId: "quiz" });
    await playFeedback(correct);
    setTimeout(() => { setQuiz(null); setQuizPicked(null); }, correct ? 700 : 1500);
  };

  const flip = async (c: Card) => {
    if (busy || c.flipped || c.matched || quiz) return;
    const updated = cards.map((x) => x.uid === c.uid ? { ...x, flipped: true } : x);
    setCards(updated);

    if (!first) {
      setBusy(true);
      await playItem(c.item);
      setFirst(c);
      setBusy(false);
      return;
    }
    setMoves((m) => m + 1);
    setBusy(true);
    const isMatch = first.item.id === c.item.id;
    // Not: eşleşme başarısı SRS'i güncellemez (normal modda) — yalnız aradaki
    // mini-test etki eder. Süper mod eskisi gibi her cevabı sayar.
    recordGameAnswer(c.item, isMatch);
    if (isMatch) {
      const matchedItem = c.item;
      setCards((cs) => cs.map((x) => x.item.id === matchedItem.id ? { ...x, matched: true, flipped: true } : x));
      await playItem(matchedItem);
      setFirst(null); setBusy(false);
      setMatchesSinceQuiz((n) => {
        const next = n + 1;
        if (next >= QUIZ_EVERY) { setTimeout(() => openQuiz(matchedItem), 350); return 0; }
        return next;
      });
    } else {
      await playItem(c.item);
      setCards((cs) => cs.map((x) => (x.uid === first.uid || x.uid === c.uid) ? { ...x, flipped: false } : x));
      setFirst(null); setBusy(false);
    }
  };

  useEffect(() => {
    if (won) playFeedback(true);
  }, [won]);

  useEffect(() => {
    const h = () => reset();
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-topic-pink/30 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🃏 Hafıza Kartları" backTo="/oyunlar" centered onReset={reset} />
        <div className="flex justify-center mb-3"><LangToggle /></div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-primary/30">
            <div className="text-xs text-muted-foreground font-bold">Hamle</div>
            <div className="text-2xl font-extrabold text-primary">{moves}</div>
          </div>
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-success/30">
            <div className="text-xs text-muted-foreground font-bold">Kalan</div>
            <div className="text-2xl font-extrabold text-success">{cards.filter((c) => !c.matched).length / 2}</div>
          </div>
        </div>

        {won && (
          <div className="rounded-3xl bg-card p-6 mb-4 text-center shadow-card border-4 border-success/40 animate-bounce-in">
            <div className="text-5xl mb-2">🏆</div>
            <p className="text-lg font-extrabold">Hepsini buldun! {moves} hamle</p>
            <button onClick={reset} className="mt-3 rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Tekrar Oyna</button>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {cards.map((c) => (
            <button
              key={c.uid}
              onClick={() => flip(c)}
              className={cn(
                "aspect-square rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-card border-4 transition-bouncy",
                c.matched ? "bg-success/20 border-success/50 opacity-60" :
                  c.flipped ? "bg-card border-primary/40 animate-pop" :
                    "bg-primary border-primary text-primary-foreground hover:-translate-y-1",
              )}
            >
              {(c.flipped || c.matched)
                ? <span className="text-5xl"><EmojiView value={c.item.emoji} /></span>
                : <span>?</span>}
            </button>
          ))}
        </div>
      </main>

      {quiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-elegant border-4 border-primary/40 animate-bounce-in">
            <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-wider text-primary">Mini Test</p>
            <button
              onClick={() => playItem(quiz.target)}
              className="mx-auto mb-4 flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-extrabold text-primary-foreground shadow-soft"
            >
              <Volume2 className="h-6 w-6" /> Hangisi?
            </button>
            <div className="grid grid-cols-2 gap-3">
              {quiz.options.map((opt) => {
                const isCorrect = !!quizPicked && opt.id === quiz.target.id;
                const isWrong = quizPicked === opt.id && opt.id !== quiz.target.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => answerQuiz(opt)}
                    className={cn(
                      "aspect-square rounded-2xl flex items-center justify-center shadow-card border-4 transition-bouncy bg-card border-primary/20",
                      isCorrect && "bg-success border-success animate-pop",
                      isWrong && "bg-destructive border-destructive animate-shake",
                    )}
                  >
                    <span className={cn(
                      "font-arabic text-5xl leading-[1.5]",
                      (isCorrect || isWrong) ? "text-white" : "text-emerald-800",
                    )}>
                      {opt.emoji}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryGame;
