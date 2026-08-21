import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { gamePool, shuffle } from "./_shared";
import { useAge } from "@/lib/age";
import { getZorluk, type Zorluk } from "@/lib/zorluk";
import type { ContentItem } from "@/data/types";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import { sfx, titre } from "@/lib/juice";
import { useOyunSonu } from "@/lib/oyunSonucu";

/**
 * Yapboz — yaşa göre:
 *   3-4 yaş → 2x2  (4 parça)
 *   5-6 yaş → 3x3  (9 parça)
 * Tap-to-swap. Bittiğinde nesnenin adı seslendirilir.
 */
/**
 * Parça sayısı YAŞA göre, zorluk onu bir basamak kaydırır.
 *
 * ⚠️ YAŞ TABAN, ZORLUK KAYDIRMA: yaşı silip yalnız zorluğa bakmak 4 yaşındaki
 * çocuğu Zor'da 16 parçaya atıyordu. Zorluk en fazla ±1 basamak oynatır ve
 * 2×2'nin altına inilmez (tek parça yapboz değildir).
 */
function gridForAge(age: number | null, z: Zorluk = getZorluk()): number {
  const taban = !age || age <= 4 ? 2 : 3;   // 4 parça / 9 parça
  const kaydir = z === "kolay" ? -1 : z === "zor" ? 1 : 0;
  return Math.max(2, Math.min(4, taban + kaydir));
}

const PuzzleGame = () => {
  const [age] = useAge();
  const N = gridForAge(age);

  // Yapboz için uygun olmayan tek-renk / düz şekil görsellerini ayıkla.
  // Tek ton emojiler (turuncu/mavi/sarı kareler vs.) yapbozda hep aynı parça gibi görünüyor.
  const BLOCKED_EMOJIS = new Set([
    "⬛","⬜","🟥","🟧","🟨","🟩","🟦","🟪","🟫",
    "⭕","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤",
    "🔺","🔻","🔶","🔷","🔸","🔹","▪️","▫️","◼️","◻️","◾","◽","▬","⬡",
  ]);
  const pool = useMemo(
    () => gamePool().filter((p) => p.emoji && [...p.emoji].length <= 2 && !BLOCKED_EMOJIS.has(p.emoji)),
    [],
  );
  const [item, setItem] = useState<ContentItem | null>(null);
  const [tiles, setTiles] = useState<number[]>([]);
  const [first, setFirst] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [oturan, setOturan] = useState<number[]>([]);
  const [score, setScore] = useState(0);

  /**
   * Rekor = bu oturumda kaç yapboz tamamlandı. Oyunun bitişi yok, her yapboz
   * bir "tur"; skor kümülatif olduğu için her çözümde kayıt tazelenir ve en
   * iyisi kalır. ⚠️ Aynı çağrı GÜNLÜK SERİYİ de besliyor — Yapboz kayıt
   * katmanına hiç bağlı değildi, oynayan çocuğun serisi ilerlemiyordu.
   */
  const rapor = useOyunSonu("puzzle", solved, score, { birim: "yapboz" });

  const sizeRef = useRef<HTMLDivElement>(null);

  const startNew = () => {
    if (pool.length === 0) return;
    const it = pool[Math.floor(Math.random() * pool.length)];
    setItem(it);
    const total = N * N;
    let arr = Array.from({ length: total }, (_, i) => i);
    do { arr = shuffle(arr); } while (arr.every((v, i) => v === i));
    setTiles(arr);
    setFirst(null);
    setSolved(false);
  };

  useEffect(() => { startNew(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [N]);

  const tap = (i: number) => {
    if (solved) return;
    // Seçme ve takas AYRI sesler: çocuk hangi aşamada olduğunu duyarak da
    // anlasın (parça seçildi mi, yer değişti mi).
    if (first === null) { sfx("kaydir"); setFirst(i); return; }
    if (first === i) { sfx("kaydir"); setFirst(null); return; }
    const next = [...tiles];
    [next[first], next[i]] = [next[i], next[first]];
    sfx("patlat");
    setTiles(next);
    setFirst(null);

    // ⚠️ DOĞRU YERE OTURAN PARÇA GÖRÜNSÜN: yapbozun tek geri bildirimi
    // "bitti" idi; aradaki her doğru hamle sessizdi. Artık yeni yerine oturan
    // parça bir kez "pop" yapıyor — ilerleme hamle hamle okunuyor.
    const yeniDogru: number[] = [];
    for (const idx of [first, i]) if (next[idx] === idx && tiles[idx] !== idx) yeniDogru.push(idx);
    if (yeniDogru.length) {
      setOturan(yeniDogru);
      setTimeout(() => setOturan([]), 340);
    }

    if (next.every((v, idx) => v === idx)) {
      setSolved(true);
      setScore((s) => s + 1);
      if (item) {
        // Doğru cevap sesi → sonra harfin gerçek okunuşu
        sfx("bitis");
        playFeedback(true);
        setTimeout(() => { void playItem(item); }, 300);
      }
    }
  };

  const sayItem = () => { if (item) void playItem(item); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-warning/15 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🧩 Yapboz" backTo="/oyunlar" centered onReset={startNew} />

        <div className="mb-3 flex items-center justify-between text-sm font-bold">
          <span>⭐ {score}</span>
          <button
            onClick={sayItem}
            disabled={!item}
            className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 shadow-soft border-2 border-primary font-bold flex items-center gap-1 disabled:opacity-40"
            aria-label="Nesnenin adını dinle"
          >
            <Volume2 className="h-4 w-4" /> Dinle
          </button>
          <span className="text-muted-foreground">{N}×{N} • {age ? `${age} yaş` : ""}</span>
        </div>

        <div
          ref={sizeRef}
          className="relative mx-auto aspect-square w-full max-w-sm rounded-3xl bg-card border-4 border-warning/40 shadow-card p-2 overflow-hidden"
          style={{ ["--tile" as string]: `calc((min(100vw - 2rem, 24rem) - 1rem) / ${N})` }}
        >
          <div
            className="grid gap-1 h-full w-full"
            style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}
          >
            {tiles.map((val, idx) => {
              const row = Math.floor(val / N);
              const col = val % N;
              const correct = val === idx;
              return (
                <button
                  key={idx}
                  // ⚠️ DOKUNMA TEPKİSİ `pointerdown`'DA: `click` parmağın
                  // KALKMASINI bekliyor — yani geri bildirim çocuğun parmağını
                  // kaldırmasına kadar gecikiyor. Bu dokunuşun BİR CEVAP
                  // OLMADIĞI oyunlarda (kart çevirme, taş seçme, parça takası)
                  // basma anında tepki vermek doğru; yanlışlıkla dokunmanın
                  // SRS bedeli yok. (Cevap sayılan yerler `click`te kaldı.)
                  onPointerDown={() => tap(idx)}
                  className={cn(
                    "relative overflow-hidden rounded-lg border-2 transition-bouncy active:scale-95",
                    first === idx
                      ? "border-primary scale-95 ring-4 ring-primary/40"
                      : solved && correct
                      ? "border-success"
                      : "border-border/40",
                    "bg-gradient-to-br from-card to-muted/50",
                    oturan.includes(idx) && "animate-juice-pop border-success ring-4 ring-success/50",
                  )}
                  aria-label={`Parça ${idx + 1}`}
                >
                  {item?.emoji && (
                    <span
                      aria-hidden
                      className="absolute inset-0 leading-none select-none flex items-center justify-center"
                      style={{
                        width: `${N * 100}%`,
                        height: `${N * 100}%`,
                        top: `-${row * 100}%`,
                        left: `-${col * 100}%`,
                        fontSize: `calc(var(--tile) * ${N * 0.95})`,
                      }}
                    >
                      {item.emoji}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {solved && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-success/85 backdrop-blur-sm animate-bounce-in">
              <div className="text-7xl mb-2">{item?.emoji}</div>
              <div className="text-2xl font-extrabold text-white mb-1">{item?.label}</div>
              <div className="text-3xl font-extrabold text-white text-shadow-soft mb-1">
                🎉 Aferin!
              </div>
              <div className="mb-4 text-sm font-bold text-white/90">
                {score} yapboz
                {rapor?.rekor && <span className="ml-1">· 🏆 rekor!</span>}
                {!rapor?.rekor && rapor?.oncekiEnIyi != null && (
                  <span className="ml-1">· rekorun {rapor.oncekiEnIyi}</span>
                )}
              </div>
              <button
                onClick={startNew}
                className="rounded-full bg-white text-success px-6 py-3 font-extrabold shadow-soft active:scale-95"
              >
                Yeni Yapboz
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm font-bold text-muted-foreground">
          İki parçaya dokun → yerleri değişir
        </p>
      </main>
    </div>
  );
};

export default PuzzleGame;
