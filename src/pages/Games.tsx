import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useGameMode, SUPER_MODE_GAMES } from "@/lib/gameMode";

type Diff = "kolay" | "zor";
interface GameDef { id: string; title: string; emoji: string; color: string; desc: string; diff: Diff }

// Zorluk sınıfı: refleks/hız/eşzamanlı karar isteyen oyunlar "zor",
// sakin/tempolu olanlar "kolay". Küçük çocuk kolaydan başlayabilsin.
const GAMES: GameDef[] = [
  // — Kolay —
  { id: "memory", title: "Hafıza Kartları", emoji: "🃏", color: "from-topic-pink to-pink", desc: "Eşleşenleri bul", diff: "kolay" },
  { id: "balloon", title: "Balon Patlatma", emoji: "🎈", color: "from-topic-blue to-info", desc: "Doğru balonu patlat", diff: "kolay" },
  { id: "sorter", title: "Kutu Boşalt", emoji: "📦", color: "from-topic-doga to-success", desc: "Sorulan harfi seç, kutuyu boşalt", diff: "kolay" },
  { id: "puzzle", title: "Yapboz", emoji: "🧩", color: "from-warning to-topic-pink", desc: "Parçaları birleştir, sesi duy", diff: "kolay" },
  { id: "triple", title: "Üçlü Eşle", emoji: "🔗", color: "from-topic-blue to-primary", desc: "3'lü eşle, sesi duy", diff: "kolay" },
  { id: "quiz", title: "Hızlı Quiz", emoji: "⚡", color: "from-topic-doga to-success", desc: "60 saniyede skor", diff: "kolay" },
  // — Zor —
  { id: "subway", title: "ElifBa Koşusu", emoji: "🏃", color: "from-sky-500 to-emerald-500", desc: "3D koşu! Doğru harfin rayına geç", diff: "zor" },
  { id: "platform", title: "Harf Macerası", emoji: "🍄", color: "from-red-500 to-orange-400", desc: "10 bölüm! Zıpla, koş, harf topla", diff: "zor" },
  { id: "flappy", title: "Uçan Kuş", emoji: "🐤", color: "from-info to-primary", desc: "Doğru harfi yut, sorulara cevap ver", diff: "zor" },
  { id: "snake", title: "Yılan Oyunu", emoji: "🐍", color: "from-success to-topic-doga", desc: "Harfleri ye, sınavı geç", diff: "zor" },
  { id: "runner", title: "Uzay Savaşı", emoji: "🚀", color: "from-indigo-500 to-fuchsia-500", desc: "Doğru hedefi vur, yanlışı vurma", diff: "zor" },
  { id: "match3", title: "Üçlü Eşleştir", emoji: "🍬", color: "from-topic-pink to-warning", desc: "3'lü dizip patlat", diff: "zor" },
];

const Games = () => {
  const [mode] = useGameMode();
  const visible = mode === "super" ? GAMES.filter((g) => SUPER_MODE_GAMES.has(g.id)) : GAMES;
  const kolay = visible.filter((g) => g.diff === "kolay");
  const zor = visible.filter((g) => g.diff === "zor");

  const Card = ({ g, i }: { g: GameDef; i: number }) => (
    <Link
      key={g.id}
      to={`/oyunlar/${g.id}`}
      className={`bg-gradient-to-br ${g.color} group flex flex-col items-center justify-center gap-1.5 rounded-3xl p-5 text-white shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant min-h-[150px] animate-bounce-in`}
      style={{ animationDelay: `${i * 60}ms` }}
    >
      <div className="text-5xl sm:text-6xl transition-transform group-hover:scale-110">{g.emoji}</div>
      <h2 className="text-lg sm:text-xl font-extrabold text-shadow-soft text-center leading-tight">{g.title}</h2>
      <p className="text-xs sm:text-sm font-semibold opacity-90 text-center leading-tight">{g.desc}</p>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft/40 to-background">
      <main className="container mx-auto max-w-3xl px-4 pb-20">
        <PageHeader title="🎮 Oyunlar" backTo="/" centered />

        <p className="text-center text-muted-foreground font-semibold mb-5 text-sm sm:text-base">
          {mode === "super" ? "⚡ Süper Öğrenme Modu — sıkı çalış!" : "Hangi oyunu oynamak istersin?"}
        </p>

        {kolay.length > 0 && (
          <>
            <h3 className="mb-2 flex items-center gap-2 font-extrabold text-success">
              <span className="text-lg">🟢</span> Kolay Oyunlar
              <span className="text-[11px] font-bold text-muted-foreground">— sakin & eğlenceli</span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {kolay.map((g, i) => <Card key={g.id} g={g} i={i} />)}
            </div>
          </>
        )}

        {zor.length > 0 && (
          <>
            <h3 className="mb-2 flex items-center gap-2 font-extrabold text-destructive">
              <span className="text-lg">🔴</span> Zor Oyunlar
              <span className="text-[11px] font-bold text-muted-foreground">— hızlı & refleks</span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {zor.map((g, i) => <Card key={g.id} g={g} i={i} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Games;
