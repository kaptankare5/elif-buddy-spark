// 🧩 EKSİK PARÇA — "Harf Tamir Atölyesi". Baştan yazıldı.
//
// ESKİ HÂLİNİN İKİ AYRI SORUNU VARDI:
//
//  A) İLERLEMEYE HİÇ DOKUNMUYORDU. recordGameAnswer/pickNextGameItem yoktu;
//     harf rastgele seçiliyordu. Çocuk oynuyor, sistem hiçbir şey öğrenmiyordu.
//     Bitiş/hedef/süre/seri de yoktu → "bir daha oynayayım" duygusu doğmuyordu.
//
//  B) MEKANİK İÇERİĞE UYMUYORDU. Harf 2×2/3×3 kesilip karıştırılıyordu; ama
//     Elif (ا) gibi ince harflerde parçaların çoğu BOMBOŞ çıkıyor, yapboz hem
//     çözülemez hem anlamsız oluyordu. Latin emojisi için tasarlanmış bir
//     mekanik Arap harfine zorlanmıştı.
//
// YENİ MEKANİK: harften bir parça KESİLİR, çocuk eksik parçayı bulur.
//  • Delik, harfin mürekkebinin YOĞUN olduğu bir yerden seçilir → parça hep
//    anlamlı (ince harflerde bile boş kutu çıkmaz).
//  • Yanlış parçalar KARIŞAN HARFLERİN aynı bölgesinden kesilir (pickWrongs).
//    Yani çeldirici gerçekten inandırıcı: Be'nin parçası Te'ninkine benzer,
//    çocuk noktaya/eğime bakmak zorunda kalır. Ayrım eğitimi doğrudan burada.
//  • Doğru parçayla neredeyse AYNI görünen çeldirici elenir (piksel farkı):
//    yoksa sorunun iki doğru cevabı olurdu — testlerde yaşadığımız hata.
//
// Tekrar sistemi korunur: hedef pickNextGameItem'dan gelir, cevap
// recordGameAnswer'a (chosenId/shownIds ile) yazılır, yanlışta telafi
// kuyruğa girer. Oyun tarafı: süre, kombo çarpanı, yıldız, kişisel rekor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { GameEnd } from "@/components/games/GameEnd";
import { ComboBadge, FloatScore } from "@/components/games/ComboBadge";
import { playItem, playFeedback } from "@/lib/audio";
import { gamePool, pickWrongs, shuffle } from "./_shared";
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { comboMult, comboBanner, starsFor, getBest, submitBest } from "@/lib/gameFeel";
import { gardenTease } from "@/lib/sessionEnd";
import { cn } from "@/lib/utils";
import { Volume2 } from "lucide-react";
import type { ContentItem } from "@/data/types";

const GAME_ID = "puzzle";
const ROUND_TIME = 90;
const STAR_AT: [number, number, number] = [50, 110, 190];

const CV = 300;                 // harf tuvali (kare)
const HOLE = 96;                // kesilen parçanın kenarı
const FONT = `${Math.round(CV * 0.66)}px "Amiri Quran", "Amiri", "Scheherazade New", serif`;

/** Harfi sabit konumda kare tuvale çizer — tüm harfler aynı hizada olsun. */
function glyphCanvas(glyph: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CV; c.height = CV;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#134e3a";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = FONT;
  g.fillText(glyph, CV / 2, CV * 0.54);
  return c;
}

/** Belirli bir kareyi kesip kendi tuvaline koyar (parça görseli). */
function cropPiece(src: HTMLCanvasElement, hx: number, hy: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = HOLE; c.height = HOLE;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, hx, hy, HOLE, HOLE, 0, 0, HOLE, HOLE);
  return c;
}

/** Parçadaki mürekkep oranı + iki parçanın benzerliği (0..1) */
function inkRatio(c: HTMLCanvasElement): number {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, HOLE, HOLE).data;
  let ink = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++;
  return ink / (HOLE * HOLE);
}

function similarity(a: HTMLCanvasElement, b: HTMLCanvasElement): number {
  const da = a.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, HOLE, HOLE).data;
  const db = b.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, HOLE, HOLE).data;
  let same = 0;
  const n = HOLE * HOLE;
  for (let i = 0; i < n; i++) {
    const ia = da[i * 4 + 3] > 40, ib = db[i * 4 + 3] > 40;
    if (ia === ib) same++;
  }
  return same / n;
}

interface Round {
  item: ContentItem;
  /** deliği açılmış harf (data URL) */
  holed: string;
  hx: number; hy: number;
  options: { item: ContentItem; url: string }[];
}

const PuzzleGame = () => {
  const pool = useMemo(() => gamePool().filter((p) => !!p.emoji), []);
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [time, setTime] = useState(ROUND_TIME);
  const [banner, setBanner] = useState<string | null>(null);
  const [float, setFloat] = useState<{ k: number; text: string; tone: "good" | "bad" } | null>(null);
  const [best] = useState(() => getBest(GAME_ID));
  const [newBest, setNewBest] = useState(false);
  const teaseRef = useRef(gardenTease());
  const floatK = useRef(0);

  const ended = time <= 0;
  useRemedyOnGameOver(ended);

  /** Yeni tur kur: hedefi SRS seçer, delik mürekkepli bölgeden açılır. */
  const nextRound = useCallback(() => {
    if (pool.length < 3) return;
    const item = pickNextGameItem(pool) || pool[0];
    const full = glyphCanvas(item.emoji!);

    // Deliği mürekkebi bol bir yere koy — birkaç aday dene, en yoğununu seç.
    let bestHole = { x: (CV - HOLE) / 2, y: (CV - HOLE) / 2, ink: -1 };
    for (let k = 0; k < 24; k++) {
      const x = Math.round(Math.random() * (CV - HOLE));
      const y = Math.round(Math.random() * (CV - HOLE));
      const r = inkRatio(cropPiece(full, x, y));
      if (r > bestHole.ink) bestHole = { x, y, ink: r };
      if (r > 0.16) break;                       // yeterince dolu
    }
    const { x: hx, y: hy } = bestHole;
    const correctPiece = cropPiece(full, hx, hy);

    // Yanlış parçalar: KARIŞAN harflerin aynı bölgesi. Doğruya çok benzeyen
    // (≥%97 aynı) elenir — yoksa iki doğru cevaplı soru olur.
    const wrongs: { item: ContentItem; url: string }[] = [];
    for (const cand of pickWrongs(pool, item, 10)) {
      if (!cand.emoji) continue;
      const piece = cropPiece(glyphCanvas(cand.emoji), hx, hy);
      if (similarity(piece, correctPiece) >= 0.97) continue;
      wrongs.push({ item: cand, url: piece.toDataURL() });
      if (wrongs.length >= 3) break;
    }
    if (wrongs.length < 2) { setTimeout(nextRound, 0); return; }   // şanssız delik → yeniden

    // Delikli harf: parçayı sil
    const holedC = glyphCanvas(item.emoji!);
    const hg = holedC.getContext("2d")!;
    hg.clearRect(hx, hy, HOLE, HOLE);

    setRound({
      item,
      holed: holedC.toDataURL(),
      hx, hy,
      options: shuffle([{ item, url: correctPiece.toDataURL() }, ...wrongs]),
    });
    setPicked(null);
    playItem(item);
  }, [pool]);

  useEffect(() => { nextRound(); }, [nextRound]);

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setTime((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ended]);

  useEffect(() => {
    if (ended) setNewBest(submitBest(GAME_ID, score));
  }, [ended, score]);

  const showFloat = (text: string, tone: "good" | "bad") => {
    floatK.current += 1;
    setFloat({ k: floatK.current, text, tone });
    setTimeout(() => setFloat(null), 900);
  };

  const answer = async (opt: { item: ContentItem; url: string }) => {
    if (!round || picked || ended) return;
    setPicked(opt.item.id);
    const correct = opt.item.id === round.item.id;
    recordGameAnswer(round.item, correct, {
      gameId: GAME_ID,
      chosenId: opt.item.id,
      shownIds: round.options.map((o) => o.item.id),
    });
    if (correct) {
      const st = streak + 1;
      setStreak(st);
      setSolved((v) => v + 1);
      const gain = 10 * comboMult(st);
      setScore((s) => s + gain);
      showFloat(`+${gain}`, "good");
      const b = comboBanner(st);
      if (b) { setBanner(b); setTimeout(() => setBanner(null), 1300); }
      setTime((t) => Math.min(ROUND_TIME, t + 4));    // doğru cevap süre kazandırır
    } else {
      setStreak(0);
      showFloat("✗", "bad");
    }
    await playFeedback(correct);
    setTimeout(nextRound, correct ? 650 : 1500);
  };

  const restart = () => {
    setScore(0); setStreak(0); setSolved(0); setTime(ROUND_TIME);
    setNewBest(false); teaseRef.current = gardenTease();
    nextRound();
  };

  const stars = starsFor(score, STAR_AT);

  return (
    <div className="min-h-screen bg-gradient-to-b from-warning/15 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🧩 Eksik Parça" backTo="/oyunlar" centered onReset={restart} />

        {ended ? (
          <GameEnd
            title="Süre doldu!"
            score={score} stars={stars} best={Math.max(best, score)} newBest={newBest}
            tease={teaseRef.current} onRestart={restart}
            detail={`${solved} harfi tamir ettin`}
          />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border-2 border-success/30 bg-card p-2 shadow-soft">
                <div className="text-[10px] font-bold text-muted-foreground">Puan</div>
                <div className="text-xl font-extrabold text-success">{score}</div>
              </div>
              <div className={cn(
                "rounded-xl border-2 bg-card p-2 shadow-soft",
                time <= 10 ? "border-destructive/60 animate-pulse" : "border-info/30",
              )}>
                <div className="text-[10px] font-bold text-muted-foreground">Süre</div>
                <div className={cn("text-xl font-extrabold", time <= 10 ? "text-destructive" : "text-info")}>{time}s</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-warning/30 bg-card p-2 shadow-soft">
                <div className="text-[10px] font-bold text-muted-foreground">Seri</div>
                {streak >= 2 ? <ComboBadge streak={streak} />
                  : <div className="text-xl font-extrabold text-warning">🔥{streak}</div>}
              </div>
            </div>

            <div className="relative">
              {banner && (
                <div className="pointer-events-none absolute inset-x-0 -top-1 z-30 text-center">
                  <span className="inline-block animate-pop rounded-full bg-warning px-4 py-1.5 text-sm font-extrabold text-warning-foreground shadow-card">
                    {banner}
                  </span>
                </div>
              )}
              {float && <FloatScore key={float.k} text={float.text} tone={float.tone} />}

              {/* Delikli harf */}
              <div className="relative mx-auto aspect-square w-full max-w-[300px] rounded-3xl border-4 border-warning/40 bg-card shadow-card">
                {round && (
                  <>
                    <img src={round.holed} alt="" className="absolute inset-0 h-full w-full" />
                    {/* eksik parçanın yeri — kesikli çerçeve, nabız gibi */}
                    <span
                      className="absolute animate-pulse rounded-lg border-4 border-dashed border-destructive/70 bg-destructive/5"
                      style={{
                        left: `${(round.hx / CV) * 100}%`,
                        top: `${(round.hy / CV) * 100}%`,
                        width: `${(HOLE / CV) * 100}%`,
                        height: `${(HOLE / CV) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>

              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => round && playItem(round.item)}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-soft active:scale-95"
                >
                  <Volume2 className="h-4 w-4" /> Dinle
                </button>
              </div>

              <p className="mt-3 text-center text-sm font-extrabold text-muted-foreground">
                Eksik parçayı bul 🔍
              </p>

              {/* Parça seçenekleri */}
              <div className="mt-2 grid grid-cols-4 gap-2">
                {round?.options.map((opt) => {
                  const isCorrect = !!picked && opt.item.id === round.item.id;
                  const isWrong = picked === opt.item.id && opt.item.id !== round.item.id;
                  return (
                    <button
                      key={opt.item.id}
                      onClick={() => answer(opt)}
                      aria-label="Parça seç"
                      className={cn(
                        "aspect-square rounded-2xl border-4 bg-card p-1 shadow-card transition-bouncy hover:-translate-y-1",
                        isCorrect ? "animate-pop border-success bg-success/20"
                          : isWrong ? "animate-shake border-destructive bg-destructive/20"
                            : "border-primary/25",
                      )}
                    >
                      <img src={opt.url} alt="" className="h-full w-full object-contain" />
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 text-center text-xs font-bold text-muted-foreground">
              Her doğru <b className="text-success">+4 saniye</b> ⏱ · seri büyüdükçe puan katlanır
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default PuzzleGame;
