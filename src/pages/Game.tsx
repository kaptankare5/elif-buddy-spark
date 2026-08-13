import { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useGameSession } from "@/hooks/useGameSession";
import { releaseRemedy } from "@/lib/remedial";
import { RouteHead } from "@/components/RouteHead";
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
import PartyGame from "./games/PartyGame";
import KartGame from "./games/KartGame";
import LaneRunnerGame from "./games/LaneRunnerGame";

const GAMES = ["memory", "balloon", "sorter", "match3", "triple", "quiz", "snake", "flappy", "puzzle", "runner", "subway", "platform", "party", "kart", "lane"] as const;

const GAME_META: Record<string, { title: string; desc: string }> = {
  memory: { title: "Hafıza Kartları", desc: "Eşleşen Elifbâ harflerini bul." },
  balloon: { title: "Balon Patlatma", desc: "Doğru harfi patlat, sesini öğren." },
  sorter: { title: "Kutu Boşalt", desc: "Sorulan harfleri seç, kutuyu boşalt." },
  match3: { title: "Üçlü Eşleştir", desc: "3'lü diz, harfleri patlat." },
  triple: { title: "Üçlü Eşle", desc: "3 kartı eşle, sesi duy." },
  quiz: { title: "Hızlı Quiz", desc: "60 saniyede kaç harf bileceksin?" },
  snake: { title: "Yılan Oyunu", desc: "Doğru harfleri ye, büyü." },
  flappy: { title: "Uçan Kuş", desc: "Doğru harfleri yut, sorulara cevap ver." },
  puzzle: { title: "Yapboz", desc: "Parçaları birleştir, harfin sesini duy." },
  runner: { title: "Uzay Savaşı", desc: "Doğru hedefi vur, yanlışı vurma." },
  subway: { title: "ElifBa Koşusu", desc: "3D koşu — doğru harfin rayına geç." },
  platform: { title: "Elif Ba Macerası", desc: "10 bölümlük platform macerası: zıpla, koş, harf topla." },
  party: { title: "Elifbâ Partisi", desc: "5 botla 3B engel parkuru: çekiçten kaç, çubuğu zıpla, doğru harfin kapısından geç." },
  kart: { title: "Elifbâ Yarışı", desc: "5 botla 3B kart yarışı: virajları al, doğru harfin kapısından geç, turbo kap." },
};

const Game = () => {
  useLockBodyScroll();
  const { gameId } = useParams<{ gameId: string }>();
  if (!GAMES.includes(gameId as typeof GAMES[number])) return <Navigate to="/oyunlar" replace />;
  // Oyun süresi/oturum kaydı (anonim, sadece onay verilmişse)
  return <TrackedGame gameId={gameId!} />;
};

const TrackedGame = ({ gameId }: { gameId: string }) => {
  useGameSession(gameId);

  // Bitiş durumu OLMAYAN oyunlarda (balon, hafıza, kutu, üçlü…) telafi anı
  // = çocuğun oyundan çıktığı andır. Oyun içinde asla açılmaz.
  useEffect(() => () => { releaseRemedy(); }, []);
  // NOT: Normal modda "📝 Test sorusu sayıldı" bildirimi KALDIRILDI —
  // arada bir sayılan cevap mekaniğiyle birlikte (bkz. lib/gameProgress.ts).

  const meta = GAME_META[gameId] ?? { title: "Oyun", desc: "ElifMim oyunu." };
  const head = (
    <RouteHead
      title={`${meta.title} — ElifMim Oyunları`}
      description={meta.desc}
      path={`/oyunlar/${gameId}`}
    />
  );

  const inner = (() => {
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
      case "party": return <PartyGame />;
      case "kart": return <KartGame />;
      case "lane": return <LaneRunnerGame />;
      default: return <Navigate to="/oyunlar" replace />;
    }
  })();

  return <>{head}{inner}</>;
};

export default Game;
