import { useState, useEffect, useRef } from "react";
import type { ContentTopic } from "@/data/types";
import { playSpeech, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface Props { topic: ContentTopic }

interface Q {
  prompt: string;
  emojis: string;
  answer: number;
  options: number[];
  speech: string;
}

const FRUITS = ["🍎","🍌","🍓","🍇","🍊","🍉","🥕","⭐","🎈","🍪"];

function shuffle<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

const NUM_NAMES = ["sıfır","bir","iki","üç","dört","beş","altı","yedi","sekiz","dokuz","on","on bir","on iki","on üç","on dört","on beş"];

function genQuestion(topicId: string): Q {
  const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  if (topicId === "toplama") {
    const a = 1 + Math.floor(Math.random() * 4);
    const b = 1 + Math.floor(Math.random() * 4);
    const ans = a + b;
    const opts = shuffle([ans, ans + 1, Math.max(1, ans - 1), ans + 2]).slice(0, 3);
    if (!opts.includes(ans)) opts[0] = ans;
    return {
      prompt: `${a} + ${b} = ?`,
      emojis: fruit.repeat(a) + " + " + fruit.repeat(b),
      answer: ans,
      options: shuffle(opts),
      speech: `${NUM_NAMES[a]} artı ${NUM_NAMES[b]} eşittir?`,
    };
  }
  if (topicId === "cikarma") {
    const a = 3 + Math.floor(Math.random() * 6);
    const b = 1 + Math.floor(Math.random() * (a - 1));
    const ans = a - b;
    const opts = shuffle([ans, ans + 1, Math.max(0, ans - 1), ans + 2]).slice(0, 3);
    if (!opts.includes(ans)) opts[0] = ans;
    return {
      prompt: `${a} - ${b} = ?`,
      emojis: fruit.repeat(a) + " − " + fruit.repeat(b),
      answer: ans,
      options: shuffle(opts),
      speech: `${NUM_NAMES[a]} eksi ${NUM_NAMES[b]} eşittir?`,
    };
  }
  // karsilastirma
  const a = 1 + Math.floor(Math.random() * 9);
  let b = 1 + Math.floor(Math.random() * 9);
  while (b === a) b = 1 + Math.floor(Math.random() * 9);
  const more = a > b ? a : b;
  const opts = [a, b];
  return {
    prompt: "Hangisi daha çok?",
    emojis: `Sol: ${fruit.repeat(a)}  •  Sağ: ${fruit.repeat(b)}`,
    answer: more,
    options: opts,
    speech: "Hangisi daha çok?",
  };
}

export function MathPractice({ topic }: Props) {
  const [q, setQ] = useState<Q>(() => genQuestion(topic.id));
  const [picked, setPicked] = useState<number | null>(null);
  const [stars, setStars] = useState(0);
  const lastTopicIdRef = useRef(topic.id);

  useEffect(() => {
    if (lastTopicIdRef.current === topic.id) return;
    lastTopicIdRef.current = topic.id;
    setQ(genQuestion(topic.id));
    setPicked(null);
  }, [topic.id]);
  useEffect(() => { playSpeech(q.speech, "tr"); }, [q.speech]);

  const choose = async (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    const correct = n === q.answer;
    if (correct) setStars((s) => s + 1);
    await playFeedback(correct);
    setTimeout(() => {
      setQ(genQuestion(topic.id));
      setPicked(null);
    }, 900);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between text-sm font-bold text-muted-foreground">
        <span>{topic.title}</span>
        <span className="text-warning">⭐ {stars}</span>
      </div>

      <div className="bg-card rounded-3xl p-6 shadow-card border-4 border-warning/30 mb-4 animate-bounce-in" key={q.prompt}>
        <h2 className="text-3xl font-extrabold text-center text-foreground mb-3">{q.prompt}</h2>
        <p className="text-center text-2xl break-words">{q.emojis}</p>
      </div>

      <div className={cn("grid gap-3", q.options.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {q.options.map((opt) => {
          const isCorrect = picked !== null && opt === q.answer;
          const isWrong = picked === opt && opt !== q.answer;
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              className={cn(
                "aspect-square rounded-3xl text-4xl font-extrabold shadow-card border-4 transition-bouncy",
                "bg-card text-primary border-primary/20 hover:-translate-y-1",
                isCorrect && "bg-success text-success-foreground border-success animate-pop",
                isWrong && "bg-destructive text-destructive-foreground border-destructive animate-shake",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </>
  );
}
