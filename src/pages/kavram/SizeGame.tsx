import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { HowToPlay } from "@/components/HowToPlay";
import { playSpeech, playFeedback } from "@/lib/audio";

/**
 * Büyük & Küçük — Gerçek görsel farkı olan eşleştirmeler.
 * Her tür için "büyük" ve "küçük" varyantları farklı emojilerle gösterilir.
 */

type Ask = "big" | "small";

interface KindPair {
  name: string;
  big: string;
  small: string;
  bigScale: number;
  smallScale: number;
}

const PAIRS: KindPair[] = [
  { name: "fil/fare",     big: "🐘", small: "🐭", bigScale: 1.0,  smallScale: 0.45 },
  { name: "balina/balık", big: "🐳", small: "🐟", bigScale: 1.0,  smallScale: 0.5 },
  { name: "ağaç",         big: "🌳", small: "🌱", bigScale: 1.0,  smallScale: 0.45 },
  { name: "bina/ev",      big: "🏢", small: "🏠", bigScale: 1.0,  smallScale: 0.55 },
  { name: "araba/oyuncak",big: "🚙", small: "🚗", bigScale: 1.0,  smallScale: 0.5 },
  { name: "köpek",        big: "🐕", small: "🐶", bigScale: 1.0,  smallScale: 0.55 },
  { name: "ayı",          big: "🐻", small: "🧸", bigScale: 1.0,  smallScale: 0.55 },
  { name: "karpuz/üzüm",  big: "🍉", small: "🍇", bigScale: 1.0,  smallScale: 0.55 },
  { name: "balon",        big: "🎈", small: "🎈", bigScale: 1.0,  smallScale: 0.4 },
  { name: "yıldız",       big: "⭐", small: "⭐", bigScale: 1.0,  smallScale: 0.4 },
  { name: "top",          big: "⚽", small: "⚽", bigScale: 1.0,  smallScale: 0.4 },
  { name: "güneş/ay",     big: "☀️", small: "🌙", bigScale: 1.0,  smallScale: 0.5 },
];

interface Round {
  ask: Ask;
  pair: KindPair;
  bigOnLeft: boolean;
}

function makeRound(prev?: Round): Round {
  let pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  if (prev) {
    let guard = 0;
    while (pair.name === prev.pair.name && guard++ < 6) {
      pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    }
  }
  return {
    ask: Math.random() < 0.5 ? "big" : "small",
    pair,
    bigOnLeft: Math.random() < 0.5,
  };
}

const SizeGame = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [intro, setIntro] = useState(true);
  const [round, setRound] = useState<Round>(() => makeRound());
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ side: "left" | "right"; ok: boolean } | null>(null);

  useEffect(() => {
    if (intro) return;
    const t = setTimeout(() => {
      playSpeech(round.ask === "big" ? "büyük" : "küçük", "tr");
    }, 150);
    return () => clearTimeout(t);
  }, [round, intro]);

  const correctSide: "left" | "right" =
    round.ask === "big"
      ? round.bigOnLeft ? "left" : "right"
      : round.bigOnLeft ? "right" : "left";

  const handlePick = (side: "left" | "right") => {
    if (feedback) return;
    const ok = side === correctSide;
    setFeedback({ side, ok });
    playFeedback(ok);
    if (ok) setScore((s) => s + 1);
    setTimeout(() => {
      setFeedback(null);
      setRound((r) => makeRound(r));
    }, ok ? 800 : 1100);
  };

  const promptText = round.ask === "big" ? "🔼 Büyük olanı seç" : "🔽 Küçük olanı seç";

  const STAGE_H = 320;
  const leftScale  = round.bigOnLeft ? round.pair.bigScale  : round.pair.smallScale;
  const rightScale = round.bigOnLeft ? round.pair.smallScale : round.pair.bigScale;
  const leftEmoji  = round.bigOnLeft ? round.pair.big : round.pair.small;
  const rightEmoji = round.bigOnLeft ? round.pair.small : round.pair.big;

  return (
    <div className="min-h-screen bg-gradient-to-b from-warning/10 via-background to-secondary/20">
      <main className="container mx-auto max-w-xl px-4 pb-16 select-none">
        <PageHeader backTo={`/konu/${subjectId}`} />
        {intro && (
          <HowToPlay
            voice="Büyük ya da küçük olanı seç."
            hint="tap-two"
            emoji="🔵"
            onDone={() => setIntro(false)}
          />
        )}

        <div className="mt-2 mb-3 flex items-center justify-between">
          <div className="rounded-full bg-card px-3 py-1.5 text-sm font-extrabold shadow-card">
            ⭐ {score}
          </div>
          <div
            key={`${round.ask}-${round.pair.name}-${round.bigOnLeft}`}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-base font-extrabold shadow-card animate-pop"
          >
            {promptText}
          </div>
          <div className="w-12" />
        </div>

        <div
          className="relative mx-auto flex w-full max-w-md items-center justify-around gap-2 rounded-3xl bg-gradient-to-b from-sky-100 to-green-100 border-4 border-primary/20 shadow-card overflow-hidden px-2"
          style={{ height: STAGE_H + 40 }}
        >
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-6 pt-3 text-2xl opacity-80">
            <span>☁️</span><span>🌞</span><span>☁️</span>
          </div>

          <ObjectButton
            emoji={leftEmoji}
            scale={leftScale}
            stageHeight={STAGE_H}
            onClick={() => handlePick("left")}
            feedback={feedback?.side === "left" ? (feedback.ok ? "ok" : "no") : null}
            ariaLabel={round.pair.name}
          />
          <ObjectButton
            emoji={rightEmoji}
            scale={rightScale}
            stageHeight={STAGE_H}
            onClick={() => handlePick("right")}
            feedback={feedback?.side === "right" ? (feedback.ok ? "ok" : "no") : null}
            ariaLabel={round.pair.name}
          />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => navigate(`/konu/${subjectId}`)}
            className="rounded-full bg-primary/10 px-6 py-3 text-2xl"
            aria-label="Geri"
          >
            🔙
          </button>
        </div>
      </main>
    </div>
  );
};

function ObjectButton({
  emoji, scale, stageHeight, onClick, feedback, ariaLabel,
}: {
  emoji: string;
  scale: number;
  stageHeight: number;
  onClick: () => void;
  feedback: "ok" | "no" | null;
  ariaLabel: string;
}) {
  const fontSize = `min(${Math.round(stageHeight * scale * 0.85)}px, ${Math.round(scale * 32)}vw)`;
  return (
    <button
      onClick={onClick}
      className={`relative z-10 flex items-center justify-center transition-transform active:scale-95 flex-1 min-w-0 ${
        feedback === "ok" ? "animate-pop" : feedback === "no" ? "animate-[shake_0.4s]" : ""
      }`}
      style={{ height: stageHeight }}
      aria-label={ariaLabel}
    >
      <span className="leading-none drop-shadow-md" style={{ fontSize, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
      {feedback === "ok" && (
        <span className="absolute -top-2 right-0 text-3xl animate-bounce-in">✅</span>
      )}
    </button>
  );
}

export default SizeGame;
