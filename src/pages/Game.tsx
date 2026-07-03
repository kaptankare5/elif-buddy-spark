import { useParams, Navigate } from "react-router-dom";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useGameSession } from "@/hooks/useGameSession";
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

const GAMES = ["memory", "balloon", "sorter", "match3", "triple", "quiz", "snake", "flappy", "puzzle", "runner"] as const;

const Game = () => {
  useLockBodyScroll();
  const { gameId } = useParams<{ gameId: string }>();
  if (!GAMES.includes(gameId as typeof GAMES[number])) return <Navigate to="/oyunlar" replace />;
  // Oyun süresi/oturum kaydı (anonim, sadece onay verilmişse)
  return <TrackedGame gameId={gameId!} />;
};

const TrackedGame = ({ gameId }: { gameId: string }) => {
  useGameSession(gameId);
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
    default: return <Navigate to="/oyunlar" replace />;
  }
};

export default Game;
