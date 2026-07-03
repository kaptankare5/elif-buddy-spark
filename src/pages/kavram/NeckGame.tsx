import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { HowToPlay } from "@/components/HowToPlay";
import { playSpeech, playFeedback } from "@/lib/audio";

/**
 * Uzun & Kısa — Gerçek görsel farkı olan eşleştirmeler.
 * Her tür için "uzun" ve "kısa" varyantları farklı emojilerle gösterilir.
 * Hiçbir dikdörtgen/kutucuk yok — sadece nesnenin kendisi.
 */

type Ask = "long" | "short";

interface KindPair {
  name: string;
  tall: string;   // uzun varyant
  short: string;  // kısa varyant
  /** Uzun varyantın görsel yükseklik katsayısı */
  tallScale: number;
  /** Kısa varyantın görsel yükseklik katsayısı */
  shortScale: number;
}

/** Her tür: belirgin biçimde farklı 2 emoji (yapı/boy farkı net görünür). */
const PAIRS: KindPair[] = [
  { name: "ağaç",      tall: "🌳", short: "🌱", tallScale: 1.0, shortScale: 0.45 },
  { name: "bina",      tall: "🏢", short: "🏠", tallScale: 1.0, shortScale: 0.55 },
  { name: "zürafa",    tall: "🦒", short: "🐐", tallScale: 1.0, shortScale: 0.55 },
  { name: "insan",     tall: "🧍", short: "👶", tallScale: 1.0, shortScale: 0.55 },
  { name: "kule",      tall: "🗼", short: "⛺", tallScale: 1.0, shortScale: 0.55 },
  { name: "çiçek",     tall: "🌻", short: "🌼", tallScale: 0.95, shortScale: 0.5 },
  { name: "ağaç2",     tall: "🌲", short: "🍄", tallScale: 1.0, shortScale: 0.5 },
  { name: "kalem",     tall: "✏️", short: "✏️", tallScale: 1.0, shortScale: 0.45 },
  { name: "yılan",     tall: "🐍", short: "🐛", tallScale: 0.9, shortScale: 0.5 },
  { name: "havuç",     tall: "🥕", short: "🥕", tallScale: 1.0, shortScale: 0.5 },
  { name: "mum",       tall: "🕯️", short: "🕯️", tallScale: 1.0, shortScale: 0.45 },
];

interface Round {
  ask: Ask;
  pair: KindPair;
  /** Sol tarafta uzun mu var? */
  tallOnLeft: boolean;
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
    ask: Math.random() < 0.5 ? "long" : "short",
    pair,
    tallOnLeft: Math.random() < 0.5,
  };
}

const NeckGame = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [intro, setIntro] = useState(true);
  const [round, setRound] = useState<Round>(() => makeRound());
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ side: "left" | "right"; ok: boolean } | null>(null);

  useEffect(() => {
    if (intro) return;
    const t = setTimeout(() => {
      playSpeech(round.ask === "long" ? "uzun" : "kısa", "tr");
    }, 150);
    return () => clearTimeout(t);
  }, [round, intro]);

  const correctSide: "left" | "right" =
    round.ask === "long"
      ? round.tallOnLeft ? "left" : "right"
      : round.tallOnLeft ? "right" : "left";

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

  const promptText = round.ask === "long" ? "🔼 Uzun olanı seç" : "🔽 Kısa olanı seç";

  // Sahne yüksekliği baz alınır; emoji font-size oranla ölçeklenir.
  const STAGE_H = 360; // px
  const leftScale  = round.tallOnLeft ? round.pair.tallScale  : round.pair.shortScale;
  const rightScale = round.tallOnLeft ? round.pair.shortScale : round.pair.tallScale;
  const leftEmoji  = round.tallOnLeft ? round.pair.tall : round.pair.short;
  const rightEmoji = round.tallOnLeft ? round.pair.short : round.pair.tall;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-background to-green-100">
      <main className="container mx-auto max-w-xl px-4 pb-16 select-none">
        <PageHeader backTo={`/konu/${subjectId}`} />
        {intro && (
          <HowToPlay
            voice="Uzun ya da kısa olanı seç."
            hint="tap-two"
            emoji="📏"
            onDone={() => setIntro(false)}
          />
        )}

        <div className="mt-2 mb-3 flex items-center justify-between">
          <div className="rounded-full bg-card px-3 py-1.5 text-sm font-extrabold shadow-card">
            ⭐ {score}
          </div>
          <div
            key={`${round.ask}-${round.pair.name}-${round.tallOnLeft}`}
            className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-base font-extrabold shadow-card animate-pop"
          >
            {promptText}
          </div>
          <div className="w-12" />
        </div>

        <div
          className="relative mx-auto flex w-full max-w-md items-end justify-around gap-2 rounded-3xl bg-gradient-to-b from-sky-200/60 to-green-200/60 border-4 border-primary/20 shadow-card overflow-hidden px-2"
          style={{ height: STAGE_H + 60 }}
        >
          {/* Gökyüzü süsleri */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-6 pt-4 text-3xl opacity-80">
            <span>☁️</span>
            <span className="text-2xl">🌞</span>
            <span>☁️</span>
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

          {/* Zemin (çimen) */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-green-600/80 to-transparent" />
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
  emoji,
  scale,
  stageHeight,
  onClick,
  feedback,
  ariaLabel,
}: {
  emoji: string;
  scale: number;
  stageHeight: number;
  onClick: () => void;
  feedback: "ok" | "no" | null;
  ariaLabel: string;
}) {
  // Responsive font: sığdır — hem sahne yüksekliğine hem yarım ekran genişliğine göre ölçekle
  const fontSize = `min(${Math.round(stageHeight * scale * 0.9)}px, ${Math.round(scale * 32)}vw)`;
  return (
    <button
      onClick={onClick}
      className={`relative z-10 flex items-end justify-center transition-transform active:scale-95 flex-1 min-w-0 ${
        feedback === "ok" ? "animate-pop" : feedback === "no" ? "animate-[shake_0.4s]" : ""
      }`}
      style={{ height: stageHeight }}
      aria-label={ariaLabel}
    >
      <span
        className="leading-none drop-shadow-md"
        style={{ fontSize, lineHeight: 1 }}
        aria-hidden
      >
        {emoji}
      </span>
      {feedback === "ok" && (
        <span className="absolute -top-2 right-0 text-3xl animate-bounce-in">✅</span>
      )}
    </button>
  );
}

export default NeckGame;
