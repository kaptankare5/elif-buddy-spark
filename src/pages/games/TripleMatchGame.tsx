import { useEffect, useRef, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { gamePool, getGameLang, pickN } from "./_shared";
import { playItem, playFeedback } from "@/lib/audio";
import type { ContentItem, Lang } from "@/data/types";

// =============================================================
// Triple Match — İçerik havuzundan (Türkçe/İngilizce) gelen kelimeler
// 3 aynı item bir araya gelirse patlar ve sesi çalınır.
// =============================================================

const TRAY_SIZE = 7;
const DISTINCT_KINDS = 5;

type BoxItem = {
  id: number;
  item: ContentItem;
  x: number;
  y: number;
  rot: number;
};

let _uid = 0;
const nid = () => ++_uid;

function buildBoard(lang: Lang): BoxItem[] {
  const pool = gamePool(lang);
  if (pool.length === 0) return [];
  const kinds = pickN(pool, Math.min(DISTINCT_KINDS, pool.length));
  const items: BoxItem[] = [];
  kinds.forEach((it) => {
    const triples = 1 + Math.floor(Math.random() * 3); // 3,6,9
    const count = triples * 3;
    for (let i = 0; i < count; i++) {
      items.push({
        id: nid(),
        item: it,
        x: 8 + Math.random() * 84,
        y: 8 + Math.random() * 84,
        rot: -15 + Math.random() * 30,
      });
    }
  });
  return items.sort(() => Math.random() - 0.5);
}

const TripleMatchGame = () => {
  const [lang, setLang] = useState<Lang>(() => getGameLang());
  const [box, setBox] = useState<BoxItem[]>(() => buildBoard(getGameLang()));
  const [tray, setTray] = useState<(BoxItem | null)[]>(() => Array(TRAY_SIZE).fill(null));
  const [floatText, setFloatText] = useState<string | null>(null);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [matches, setMatches] = useState(0);
  const [hintId, setHintId] = useState<number | null>(null);
  const lastTapRef = useRef<number>(Date.now());

  useEffect(() => {
    const onChange = () => {
      const l = getGameLang();
      setLang(l);
      setBox(buildBoard(l));
      setTray(Array(TRAY_SIZE).fill(null));
      setStatus("playing");
      setMatches(0);
      setFloatText(null);
    };
    window.addEventListener("games-lang-change", onChange);
    return () => window.removeEventListener("games-lang-change", onChange);
  }, []);

  // İdle hint — 5sn dokunma yoksa eşleştirilebilir bir taşı vurgula
  useEffect(() => {
    if (status !== "playing") { setHintId(null); return; }
    const id = setInterval(() => {
      if (Date.now() - lastTapRef.current < 5000) return;
      const trayCounts: Record<string, number> = {};
      tray.forEach((s) => { if (s) trayCounts[s.item.id] = (trayCounts[s.item.id] || 0) + 1; });
      const boardCounts: Record<string, BoxItem[]> = {};
      box.forEach((b) => { (boardCounts[b.item.id] = boardCounts[b.item.id] || []).push(b); });
      let pickKey: string | null = null;
      for (const k of Object.keys(trayCounts)) {
        if ((trayCounts[k] + (boardCounts[k]?.length || 0)) >= 3 && (boardCounts[k]?.length || 0) > 0) {
          pickKey = k; break;
        }
      }
      if (!pickKey) {
        const k = Object.keys(boardCounts).find((kk) => boardCounts[kk].length >= 3);
        if (k) pickKey = k;
      }
      if (pickKey && boardCounts[pickKey]) {
        setHintId(boardCounts[pickKey][0].id);
      }
    }, 800);
    return () => clearInterval(id);
  }, [box, tray, status]);

  const reset = () => {
    setBox(buildBoard(lang));
    setTray(Array(TRAY_SIZE).fill(null));
    setStatus("playing");
    setMatches(0);
    setFloatText(null);
    lastTapRef.current = Date.now();
  };

  const tap = (entry: BoxItem) => {
    if (status !== "playing") return;
    lastTapRef.current = Date.now();
    setHintId(null);
    const slotIdx = tray.findIndex((s) => s === null);
    if (slotIdx === -1) return;

    const newTray = [...tray];
    newTray[slotIdx] = entry;
    const newBox = box.filter((b) => b.id !== entry.id);

    const counts: Record<string, BoxItem[]> = {};
    newTray.forEach((s) => { if (s) (counts[s.item.id] = counts[s.item.id] || []).push(s); });
    const matchedKey = Object.keys(counts).find((k) => counts[k].length >= 3);

    if (matchedKey) {
      const matchedItem = counts[matchedKey][0].item;
      let removed = 0;
      const cleared = newTray.map((s) => {
        if (s && s.item.id === matchedKey && removed < 3) { removed++; return null; }
        return s;
      });
      const compact: (BoxItem | null)[] = cleared.filter((s) => s !== null) as BoxItem[];
      while (compact.length < TRAY_SIZE) compact.push(null);

      setTray(compact);
      setBox(newBox);
      setMatches((m) => m + 1);
      setFloatText(matchedItem.label);
      playItem(matchedItem);
      setTimeout(() => setFloatText(null), 1400);

      if (newBox.length === 0 && compact.every((s) => s === null)) {
        setTimeout(() => { setStatus("won"); playFeedback(true); }, 600);
      }
      return;
    }

    setTray(newTray);
    setBox(newBox);

    if (newTray.every((s) => s !== null)) {
      setTimeout(() => { setStatus("lost"); playFeedback(false); }, 300);
    }
  };

  const isEn = false;

  return (
    <div className="min-h-screen bg-gradient-to-b from-topic-blue/20 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-8">
        <PageHeader title="🧩 Triple Match" backTo="/oyunlar" centered onReset={reset} />

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-primary/30">
            <div className="text-[10px] font-bold text-muted-foreground">{isEn ? "Matches" : "Eşleşme"}</div>
            <div className="text-xl font-extrabold text-primary">{matches}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-warning/30">
            <div className="text-[10px] font-bold text-muted-foreground">{isEn ? "Left" : "Kalan"}</div>
            <div className="text-xl font-extrabold text-warning">{box.length}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">{isEn ? "Tray" : "Tepsi"}</div>
            <div className="text-xl font-extrabold text-success">{tray.filter(Boolean).length}/{TRAY_SIZE}</div>
          </div>
        </div>

        <p className="text-center text-sm font-bold text-muted-foreground mb-2">
          {isEn ? "Tap items — collect 3 of a kind!" : "Tıkla — 3 aynısını topla!"}
        </p>

        <div className="relative w-full aspect-square rounded-3xl bg-gradient-to-br from-topic-blue/30 to-primary/10 border-8 border-topic-blue/60 shadow-card overflow-hidden">
          {box.map((b) => (
            <button
              key={b.id}
              onClick={() => tap(b)}
              className={cn(
                "absolute flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-card border-4 border-primary/40 shadow-card text-5xl sm:text-6xl font-extrabold active:scale-90 transition-bouncy hover:scale-110 hover:z-10 animate-bounce-in",
                hintId === b.id && "ring-4 ring-warning bg-warning/30 animate-pulse z-20"
              )}
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
              }}
            >
              <EmojiView value={b.item.emoji} />
            </button>
          ))}
          {floatText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-success text-success-foreground text-3xl font-extrabold px-6 py-3 rounded-2xl shadow-elegant animate-pop">
                {floatText} ✨
              </div>
            </div>
          )}

          {status !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur gap-4">
              <div className="text-6xl">{status === "won" ? "🎉" : "💔"}</div>
              <div className="text-3xl font-extrabold text-foreground">
                {status === "won" ? (isEn ? "You Win!" : "Kazandın!") : (isEn ? "Game Over" : "Oyun Bitti")}
              </div>
              <button
                onClick={reset}
                className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-extrabold shadow-soft active:scale-95"
              >
                {isEn ? "Play Again" : "Tekrar Oyna"}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-card border-4 border-primary/40 p-2 shadow-card">
          <div className="grid grid-cols-7 gap-1.5">
            {tray.map((slot, i) => (
              <div
                key={i}
                className={cn(
                  "aspect-square rounded-xl border-2 flex items-center justify-center text-3xl",
                  slot ? "bg-primary-soft border-primary animate-pop" : "bg-muted/40 border-dashed border-muted-foreground/30"
                )}
              >
                {slot && <EmojiView value={slot.item.emoji} />}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripleMatchGame;
