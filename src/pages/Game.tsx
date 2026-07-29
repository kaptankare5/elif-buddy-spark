import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useGameSession } from "@/hooks/useGameSession";
import { useGameMode } from "@/lib/gameMode";
import QuizGame from "./games/QuizGame";
import MemoryGame from "./games/MemoryGame";
import BalloonGame from "./games/BalloonGame";
import SorterGame from "./games/SorterGame";
import Match3Game from "./games/Match3Game";
import TripleMatchGame from "./games/TripleMatchGame";
import SnakeGame from "./games/SnakeGame";
import FlappyGame from "./games/FlappyGame";
import PuzzleGame from "./games/PuzzleGame";
import RunnerGame from "./games/RunnerGame";
import SubwayGame from "./games/SubwayGame";
import PlatformGame from "./games/PlatformGame";

const GAMES = ["memory", "balloon", "sorter", "match3", "triple", "quiz", "snake", "flappy", "puzzle", "runner", "subway", "platform"] as const;

const Game = () => {
  useLockBodyScroll();
  const { gameId } = useParams<{ gameId: string }>();
  if (!GAMES.includes(gameId as typeof GAMES[number])) return <Navigate to="/oyunlar" replace />;
  // Oyun süresi/oturum kaydı (anonim, sadece onay verilmişse)
  return <TrackedGame gameId={gameId!} />;
};

const TrackedGame = ({ gameId }: { gameId: string }) => {
  useGameSession(gameId);
  const [mode] = useGameMode();

  // Normal modda oyun cevabı "arada test" olarak sayıldığında kısa olumlu
  // sinyal — çocuğa ilerlediğini hissettirir, akışı bölmez. (Süper modda ve
  // Quiz oyununda her cevap zaten sayıldığı için bu bildirim gösterilmez.)
  useEffect(() => {
    if (mode === "super" || gameId === "quiz") return;
    const onTest = () => toast("📝 Test sorusu sayıldı! İlerliyorsun ✨", { duration: 1400 });
    window.addEventListener("elifba-game-test-counted", onTest);
    return () => window.removeEventListener("elifba-game-test-counted", onTest);
  }, [mode, gameId]);

  switch (gameId) {
    case "memory": return <MemoryGame />;
    case "balloon": return <BalloonGame />;
    case "sorter": return <SorterGame />;
    case "match3": return <Match3Game />;
    case "triple": return <TripleMatchGame />;
    case "quiz": return <QuizGame />;
    case "snake": return <SnakeGame />;
    case "flappy": return <FlappyGame />;
    case "puzzle": return <PuzzleGame />;
    case "runner": return <RunnerGame />;
    case "subway": return <SubwayGame />;
    case "platform": return <PlatformGame />;
    default: return <Navigate to="/oyunlar" replace />;
  }
};

export default Game;
