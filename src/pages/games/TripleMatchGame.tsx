// 🔗 ÜÇLÜ EŞLE — baştan yazıldı (tepsi mekaniği korundu, öğrenme eklendi).
//
// ESKİ HÂLİNİN SORUNU: mekanik iyiydi (tepsiye topla, 3 aynı olunca patlasın —
// bağımlılık yapan klasik "triple match") ama İLERLEMEYE HİÇ DOKUNMUYORDU:
// recordGameAnswer/pickNextGameItem yoktu, harf sesi yalnız eşleşince çalıyordu.
// Yani çocuk oynuyor, sistem hiçbir şey öğrenmiyordu. Süre/puan/yıldız da yoktu.
//
// YENİ: "SİPARİŞ" katmanı. Ekranın üstünde bir sipariş kartı var: ses çalar,
// "şu harften 3 tane topla" der. Ölçüm noktası nettir ve gürültüsüzdür:
// SİPARİŞ AÇILDIKTAN SONRAKİ İLK DOKUNUŞ cevaptır (doğru harfi mi seçti?).
// Sonraki dokunuşlar tepsi yönetimidir, ölçüme karışmaz — çocuk oyun oynarken
// yanlışlıkla "yanlış cevap" yemez.
//
// Sipariş tamamlanınca: bonus puan + süre + yeni sipariş. Tepsi dolarsa oyun
// biter (mevcut gerilim korundu). Tahtadaki harfler pickCluster ile KARIŞAN
// harflerden kurulur → tepside ج ile ح yan yana durur, ayrım çalışılır.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { GameEnd } from "@/components/games/GameEnd";
import { ComboBadge, FloatScore } from "@/components/games/ComboBadge";
import { cn } from "@/lib/utils";
import { gamePool, pickCluster } from "./_shared";
import { playItem, playFeedback } from "@/lib/audio";
import { pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { useRemedyOnGameOver } from "@/lib/remedial";
import { comboMult, comboBanner, starsFor, getBest, submitBest } from "@/lib/gameFeel";
import { gardenTease } from "@/lib/sessionEnd";
import { Volume2 } from "lucide-react";
import type { ContentItem } from "@/data/types";

const GAME_ID = "triple";
const TRAY_SIZE = 7;
const DISTINCT_KINDS = 4;
const ROUND_TIME = 100;
const STAR_AT: [number, number, number] = [60, 140, 240];

type BoxItem = { id: number; item: ContentItem; x: number; y: number; rot: number };

let _uid = 0;
const nid = () => ++_uid;

// Taşlar eskiden tamamen RASTGELE konumlanıyordu ve üst üste biniyordu:
// alttaki taşa dokunmak imkânsızlaşıyordu (küçük parmak için tam bir işkence,
// otomatik testte de tıklamalar üstteki taşa takıldı). Artık hafif dağınık
// bir IZGARAYA yerleşirler: yığın hissi kalır ama her taş dokunulabilir.
const COLS = 5;

function buildBoard(): BoxItem[] {
  const pool = gamePool();
  if (pool.length === 0) return [];
  const kinds = pickCluster(pool, Math.min(DISTINCT_KINDS, pool.length));
  const items: { item: ContentItem }[] = [];
  kinds.forEach((it) => {
    for (let i = 0; i < 6; i++) items.push({ item: it });   // her harften 6 taş (2 üçlü)
  });
  // karıştır, sonra ızgaraya oturt
  items.sort(() => Math.random() - 0.5);
  const rows = Math.ceil(items.length / COLS);
  return items.map((e, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    return {
      id: nid(),
      item: e.item,
      x: ((c + 0.5) / COLS) * 100 + (Math.random() * 5 - 2.5),
      y: ((r + 0.5) / rows) * 100 + (Math.random() * 5 - 2.5),
      rot: -10 + Math.random() * 20,
    };
  });
}

const TripleMatchGame = () => {
  const [box, setBox] = useState<BoxItem[]>(() => buildBoard());
  const [tray, setTray] = useState<(BoxItem | null)[]>(() => Array(TRAY_SIZE).fill(null));
  const [order, setOrder] = useState<ContentItem | null>(null);
  const [status, setStatus] = useState<"playing" | "over">("playing");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [filled, setFilled] = useState(0);           // tamamlanan sipariş
  const [time, setTime] = useState(ROUND_TIME);
  const [banner, setBanner] = useState<string | null>(null);
  const [float, setFloat] = useState<{ k: number; text: string; tone: "good" | "bad" } | null>(null);
  const [hintId, setHintId] = useState<number | null>(null);
  const [best] = useState(() => getBest(GAME_ID));
  const [newBest, setNewBest] = useState(false);

  const awaitingRef = useRef(false);    // sipariş açıldı, ilk dokunuş ölçülecek
  const lastTapRef = useRef(Date.now());
  const teaseRef = useRef(gardenTease());
  const floatK = useRef(0);

  const ended = status === "over" || time <= 0;
  useRemedyOnGameOver(ended);

  /** Tahtada bulunan harflerden SRS'in sırada gördüğünü sipariş et. */
  const newOrder = useCallback((currentBox: BoxItem[]) => {
    const kinds = Array.from(new Map(currentBox.map((b) => [b.item.id, b.item])).values());
    if (kinds.length === 0) { setOrder(null); return; }
    const target = pickNextGameItem(kinds) || kinds[0];
    setOrder(target);
    awaitingRef.current = true;
    playItem(target);
  }, []);

  useEffect(() => { newOrder(box); /* ilk sipariş */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setTime((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [ended]);

  useEffect(() => {
    if (ended) setNewBest(submitBest(GAME_ID, score));
  }, [ended, score]);

  // Boşta kalınca ipucu: siparişteki harflerden birini parlat
  useEffect(() => {
    if (ended || !order) { setHintId(null); return; }
    const id = setInterval(() => {
      if (Date.now() - lastTapRef.current < 4000) return;
      const cand = box.find((b) => b.item.id === order.id);
      setHintId(cand ? cand.id : null);
    }, 700);
    return () => clearInterval(id);
  }, [box, order, ended]);

  const showFloat = (text: string, tone: "good" | "bad") => {
    floatK.current += 1;
    setFloat({ k: floatK.current, text, tone });
    setTimeout(() => setFloat(null), 900);
  };

  const tap = (entry: BoxItem) => {
    if (ended) return;
    lastTapRef.current = Date.now();
    setHintId(null);
    const slotIdx = tray.findIndex((s) => s === null);
    if (slotIdx === -1) return;

    // ÖLÇÜM: siparişten sonraki İLK dokunuş. Sonrakiler tepsi yönetimi sayılır.
    if (awaitingRef.current && order) {
      awaitingRef.current = false;
      const correct = entry.item.id === order.id;
      const shown = Array.from(new Set(box.map((b) => b.item.id)));
      recordGameAnswer(order, correct, {
        gameId: GAME_ID, chosenId: entry.item.id, shownIds: shown,
      });
      if (!correct) {
        setStreak(0);
        showFloat("✗", "bad");
        playFeedback(false);
      }
    }

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
      playItem(matchedItem);

      const isOrder = !!order && matchedItem.id === order.id;
      if (isOrder) {
        const st = streak + 1;
        setStreak(st);
        setFilled((f) => f + 1);
        const gain = 20 * comboMult(st);
        setScore((s) => s + gain);
        showFloat(`+${gain}`, "good");
        const b = comboBanner(st);
        if (b) { setBanner(b); setTimeout(() => setBanner(null), 1300); }
        setTime((t) => Math.min(ROUND_TIME, t + 6));
        playFeedback(true);
        setTimeout(() => newOrder(newBox), 700);
      } else {
        // sipariş dışı üçlü de temizlensin (tepsi yönetimi) — küçük puan
        setScore((s) => s + 5);
        showFloat("+5", "good");
      }

      if (newBox.length === 0) {
        // tahta bitti → yeni tahta, oyun akmaya devam etsin
        setTimeout(() => {
          const nb = buildBoard();
          setBox(nb);
          setTray(Array(TRAY_SIZE).fill(null));
          newOrder(nb);
        }, 700);
      }
      return;
    }

    setTray(newTray);
    setBox(newBox);
    if (newTray.every((s) => s !== null)) {
      setTimeout(() => { setStatus("over"); playFeedback(false); }, 300);
    }
  };

  const restart = () => {
    const nb = buildBoard();
    setBox(nb);
    setTray(Array(TRAY_SIZE).fill(null));
    setStatus("playing"); setScore(0); setStreak(0); setFilled(0);
    setTime(ROUND_TIME); setNewBest(false);
    teaseRef.current = gardenTease();
    newOrder(nb);
  };

  const stars = starsFor(score, STAR_AT);
  const orderProgress = useMemo(
    () => (order ? tray.filter((s) => s?.item.id === order.id).length : 0),
    [tray, order],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-topic-blue/20 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-8">
        <PageHeader title="🔗 Üçlü Eşle" backTo="/oyunlar" centered onReset={restart} />

        {ended ? (
          <GameEnd
            title={time <= 0 ? "Süre doldu!" : "Tepsi doldu!"}
            score={score} stars={stars} best={Math.max(best, score)} newBest={newBest}
            tease={teaseRef.current} onRestart={restart}
            detail={`${filled} sipariş tamamladın`}
          />
        ) : (
          <>
            <div className="mb-2 grid grid-cols-3 gap-2 text-center">
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

            {/* SİPARİŞ KARTI — oyunun öğrenme çıpası */}
            <div className="mb-2 flex items-center gap-3 rounded-2xl border-2 border-primary/30 bg-card p-2.5 shadow-soft">
              <button
                onClick={() => order && playItem(order)}
                aria-label="Siparişi dinle"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft active:scale-95"
              >
                <Volume2 className="h-6 w-6" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                  Sipariş — bu harften 3 tane topla
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-2.5 w-8 rounded-full transition-colors",
                        i < orderProgress ? "bg-success" : "bg-muted",
                      )}
                    />
                  ))}
                  <span className="ml-1 text-xs font-extrabold text-muted-foreground">
                    {orderProgress}/3
                  </span>
                </div>
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

              {/* Taş yığını */}
              <div className="relative h-[46vh] overflow-hidden rounded-3xl border-4 border-info/30 bg-gradient-to-b from-info/10 to-info/25 shadow-card">
                {box.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => tap(b)}
                    className={cn(
                      "absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-2 border-primary/25 bg-card shadow-card transition-transform active:scale-90",
                      hintId === b.id && "ring-4 ring-warning animate-pulse",
                    )}
                    style={{ left: `${b.x}%`, top: `${b.y}%`, transform: `translate(-50%,-50%) rotate(${b.rot}deg)` }}
                    aria-label="Taş"
                  >
                    <span dir="rtl" className="font-arabic text-3xl leading-[1.5] text-emerald-800">
                      {b.item.emoji}
                    </span>
                  </button>
                ))}
              </div>

              {/* Tepsi */}
              <div className="mt-2 grid grid-cols-7 gap-1 rounded-2xl border-4 border-warning/40 bg-card p-2 shadow-card">
                {tray.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-xl border-2",
                      s ? "border-primary/30 bg-secondary/40" : "border-dashed border-border bg-muted/30",
                    )}
                  >
                    {s && (
                      <span dir="rtl" className="font-arabic text-2xl leading-[1.5] text-emerald-800">
                        {s.item.emoji}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-center text-xs font-bold text-muted-foreground">
              Tepsi dolarsa oyun biter! Sipariş tamamlayınca <b className="text-success">+6 saniye</b> ⏱
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default TripleMatchGame;
