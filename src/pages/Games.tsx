import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { LangToggle } from "@/components/LangToggle";
import { useGameMode, SUPER_MODE_GAMES } from "@/lib/gameMode";


const GAMES = [
  { id: "puzzle", title: "Yapboz", emoji: "🧩", color: "from-warning to-topic-pink", desc: "Parçaları birleştir, sesi duy" },
  { id: "runner", title: "Uzay Savaşı", emoji: "🚀", color: "from-indigo-500 to-fuchsia-500", desc: "Doğru hedefi vur, yanlışı vurma" },
  
  { id: "memory", title: "Hafıza Kartları", emoji: "🃏", color: "from-topic-pink to-pink", desc: "Eşleşenleri bul" },
  { id: "match3", title: "Üçlü Eşleştir", emoji: "🍬", color: "from-topic-pink to-warning", desc: "3'lü dizip patlat" },
  { id: "snake", title: "Yılan Oyunu", emoji: "🐍", color: "from-success to-topic-doga", desc: "Harfleri ye, sınavı geç" },
  { id: "balloon", title: "Balon Patlatma", emoji: "🎈", color: "from-topic-blue to-info", desc: "Doğru balonu patlat" },
  { id: "sorter", title: "Kutu Boşalt", emoji: "📦", color: "from-topic-doga to-success", desc: "Sorulan harfi seç, kutuyu boşalt" },
  { id: "triple", title: "Üçlü Eşle", emoji: "🧩", color: "from-topic-blue to-primary", desc: "3'lü eşle, sesi duy" },
  { id: "flappy", title: "Uçan Kuş", emoji: "🐤", color: "from-info to-primary", desc: "Doğru harfi yut, sorulara cevap ver" },
  { id: "quiz", title: "Hızlı Quiz", emoji: "⚡", color: "from-topic-doga to-success", desc: "60 saniyede skor" },
];

const Games = () => {
  const [mode] = useGameMode();
  const visible = mode === "super" ? GAMES.filter((g) => SUPER_MODE_GAMES.has(g.id)) : GAMES;
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft/40 to-background">
      <main className="container mx-auto max-w-2xl px-4 pb-16">
        <PageHeader title="🎮 Oyunlar" backTo="/" centered />

        <div className="flex justify-center mb-4">
          <LangToggle />
        </div>

        <p className="text-center text-muted-foreground font-semibold mb-6">
          {mode === "super" ? "⚡ Süper Öğrenme Modu — sıkı çalış!" : "Hangi oyunu oynamak istersin?"}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visible.map((g, i) => (
            <Link
              key={g.id}
              to={`/oyunlar/${g.id}`}
              className={`bg-gradient-to-br ${g.color} group flex flex-col items-center justify-center gap-2 rounded-3xl p-6 text-white shadow-card transition-bouncy hover:-translate-y-1 hover:shadow-elegant min-h-[160px] animate-bounce-in`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="text-6xl transition-transform group-hover:scale-110">{g.emoji}</div>
              <h2 className="text-xl font-extrabold text-shadow-soft">{g.title}</h2>
              <p className="text-sm font-semibold opacity-90">{g.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Games;
