import { useEffect, useMemo, useRef, useState } from "react";
import { useSecenekTuslari, usePcMi } from "@/lib/klavye";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { gamePool, getGameLang, pickCluster, shuffle } from "./_shared";
import { useAskLayer } from "./_askUI";
import { recordLetterMastery } from "@/data/srs";
import { useGameMode } from "@/lib/gameMode";
import { getGameItemLevel, recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";
import { tahtaBoyu } from "@/lib/zorluk";
import { sfx, titre } from "@/lib/juice";

// =============================================================
// Kutu Boşalt — Sistem rastgele bir harfi söyler ("ha"). Kutudan
// o harfin 3 örneğini sırayla seç. Yanlış seçim → titreşim/yanlış sesi.
// 3'ü doğru seçince harfin SRS seviyesi yükselir; yeni hedef gelir.
// =============================================================

interface Cell { uid: string; item: ContentItem; cleared: boolean; wrong: boolean; }

const PER_TYPE = 3;
const TYPE_COUNT = 4; // 4 farklı harf × 3 = 12 hücre

/**
 * Zorluğa göre tip: Kolay 3 (9 hücre), Orta 4 (12), Zor 5 (15).
 * ⚠️ PER_TYPE (3) sabit — bir tipten 3 taneden az olursa "tip tamamlandı"
 * anı hemen geliyor ve hedef paneli sürekli yanıp sönüyor.
 */
function tipSayisi(): number { return tahtaBoyu(TYPE_COUNT, 3, 5); }

function buildBox(
  ayriAdlar: (adaylar: ContentItem[], n: number) => ContentItem[],
): { cells: Cell[]; types: ContentItem[] } {
  const lang = getGameLang();
  const pool = gamePool(lang);
  // ⚠️ Yazılı modda tahtadaki tipler AYNI ADI taşıyamaz: ثَ ile سَ ikisi de
  // "se" okunur, ikisi de kutuda olursa çocuk doğru okuyup yanlış hücreye
  // dokunur ve yanlış sayılır. Klasik modda bu süzgeç boş geçer.
  const n = tipSayisi();
  const types = ayriAdlar(
    pickCluster(pool, Math.min(n * 2, pool.length)),
    Math.min(n, pool.length),
  );
  const all: ContentItem[] = [];
  types.forEach((t) => { for (let i = 0; i < PER_TYPE; i++) all.push(t); });
  const shuffled = shuffle(all);
  const cells: Cell[] = shuffled.map((it, i) => ({
    uid: `${it.id}-${i}`, item: it, cleared: false, wrong: false,
  }));
  return { cells, types };
}

const SorterGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  // ⚠️ Kullanıcı şartı: bu oyunda yön TERS kurulur — üstte GLİF asılı durur,
  // KUTULARDAKİ hücreler yazılı ad olur. (Klasikte tam tersi: üstte
  // "'Be' harfini bul" yazısı, kutularda glif.)
  // Tahta `ask`e bağlı kurulur (aynı adlı tip eleme), o yüzden hook ÖNCE.
  // ⚠️ Kutu Boşalt'ın tahtası 12 kutu: Ses Şıklarında 12 hoparlör demek,
// çocuk hepsini tek tek dinlemek zorunda kalır (şık sayısı sınırı burada
// işlemiyor, tahtayı oyun kendisi kuruyor). Şekil Eşleme de tek cevaplı
// olmuyor — aynı harfin değişik harekeleri yan yana duruyor. İkisi de klasiğe düşer.
  const ask = useAskLayer({ sekilDestek: false, sesliDestek: false });
  const [board, setBoard] = useState(() => buildBox(ask.ayriAdlar));
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState(false);
  const askRef = useRef(ask); askRef.current = ask;
  const targetLevel = getGameItemLevel(target);
  const showHint = isSuper && targetLevel === 1; // süper modda L1'de etrafı parlasın

  const remainingTypes = useMemo(
    () => {
      const left: Record<string, ContentItem> = {};
      board.cells.forEach((c) => { if (!c.cleared) left[c.item.id] = c.item; });
      return Object.values(left);
    },
    [board.cells]
  );

  const won = useMemo(
    () => board.cells.length > 0 && board.cells.every((c) => c.cleared),
    [board.cells]
  );

  // İlk hedef — sadece hedef yokken ve oyun bitmemişken
  useEffect(() => {
    if (won || target || busy) return;
    if (remainingTypes.length > 0) {
      const next = remainingTypes[Math.floor(Math.random() * remainingTypes.length)];
      setTarget(next);
      setProgress(0);
      setTimeout(() => { void askRef.current.sor(next); }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, target, busy, remainingTypes.length]);

  // Kazanınca otomatik yeni seviye
  useEffect(() => {
    if (!won) return;
    sfx("bitis");
    playFeedback(true);
    const t = setTimeout(() => {
      setBoard(buildBox(ask.ayriAdlar));
      setTarget(null);
      setProgress(0);
      setLevel((l) => l + 1);
    }, 2200);
    return () => clearTimeout(t);
  }, [won, ask.ayriAdlar]);

  useEffect(() => {
    const h = () => { setBoard(buildBox(ask.ayriAdlar)); setScore(0); setTarget(null); setProgress(0); setLevel(1); };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  }, [ask.ayriAdlar]);

  const reset = () => { setBoard(buildBox(ask.ayriAdlar)); setScore(0); setBusy(false); setTarget(null); setProgress(0); setLevel(1); };

  // PC: 1-9 tuşlarıyla kutu seçilebilsin (boşalmış kutu atlanır).
  const pc = usePcMi();
  useSecenekTuslari(board.cells.length, (i) => { const c = board.cells[i]; if (c && !c.cleared) tap(c); });
  const tap = async (c: Cell) => {
    if (busy || c.cleared || !target) return;
    // ⚠️ SES ŞIKLARI: ilk dokunuş DİNLETİR, ikincisi seçer (bkz. _askUI).
    if (!ask.onayla(c.item)) return;
    if (c.item.id === target.id) {
      setBoard((b) => ({ ...b, cells: b.cells.map((x) => x.uid === c.uid ? { ...x, cleared: true } : x) }));
      const newProgress = progress + 1;
      setProgress(newProgress);
      // Aynı tipten her doğru kutuda ses bir basamak tizleşir; tip bitince
      // "seri" sesi gelir — ilerleme duyulur olsun.
      sfx(newProgress >= PER_TYPE ? "seri" : "topla", { seri: newProgress });
      titre(newProgress >= PER_TYPE ? "basari" : "hafif");
      playFeedback(true);
      // Yazılı modda her doğruda harfin gerçek okunuşu (tip tamamlanınca
      // zaten aşağıda playItem çalıyor — iki kez çalmasın).
      // Kayıt bitmeden bir sonraki dokunuş beklenmez (tahta zaten duruyor),
      // ama tip tamamlanınca yeni hedefin sesi bunun üstüne binmesin.
      if (newProgress < PER_TYPE) void ask.cevapSesi(target, true);
      if (newProgress >= PER_TYPE) {
        setBusy(true);
        const completed = target;
        setTarget(null); // effect tetiklenmesin
        playItem(completed);
        recordLetterMastery(completed.id, true);
        recordGameAnswer(completed, true);
        setScore((s) => s + 1);
        setTimeout(() => {
          setBoard((b) => {
            const newCells = b.cells.filter((x) => x.item.id !== completed.id);
            const leftMap: Record<string, ContentItem> = {};
            newCells.forEach((x) => { if (!x.cleared) leftMap[x.item.id] = x.item; });
            const left = Object.values(leftMap);
            if (left.length > 0) {
              const next = left[Math.floor(Math.random() * left.length)];
              setTarget(next);
              setProgress(0);
              setTimeout(() => { void askRef.current.sor(next); }, 250);
            }
            return { ...b, cells: newCells };
          });
          setBusy(false);
        }, 1300);
      }
    } else {
      setBusy(true);
      recordLetterMastery(target.id, false);
      recordGameAnswer(target, false, { chosenId: c.item.id });
      sfx("carp");
      titre("hata");
      await playFeedback(false);
      setBoard((b) => ({ ...b, cells: b.cells.map((x) => x.uid === c.uid ? { ...x, wrong: true } : x) }));
      setTimeout(() => {
        setBoard((b) => ({ ...b, cells: b.cells.map((x) => x.uid === c.uid ? { ...x, wrong: false } : x) }));
        setBusy(false);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-success/15 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="📦 Kutu Boşalt" backTo="/oyunlar" centered onReset={reset} />

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-primary/30">
            <div className="text-[10px] font-bold text-muted-foreground">Seviye</div>
            <div className="text-xl font-extrabold text-primary">{level}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-warning/30">
            <div className="text-[10px] font-bold text-muted-foreground">Temizlenen</div>
            <div className="text-xl font-extrabold text-warning">{score}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Kalan</div>
            <div className="text-xl font-extrabold text-success">{board.cells.filter((c) => !c.cleared).length}</div>
          </div>
        </div>

        {/* Hedef paneli.
            ⚠️ `target` null olduğu ANLARDA (tip tamamlandı → yeni hedef
            seçiliyor) panel tamamen kayboluyor, altındaki kutu yukarı
            zıplıyordu — görsel olarak "ekran bozuldu" gibi duruyor
            (kullanıcı bildirdi). Panel artık HEP DURUYOR; yalnız içeriği
            solup yerine "Aferin!" geliyor. */}
        {!won && (
          <div className={cn(
            "mb-3 rounded-2xl bg-card border-4 border-warning/50 p-3 shadow-card flex items-center justify-between gap-3 min-h-[92px] transition-opacity",
            !target && "opacity-70",
          )}>
            {!target ? (
              <div className="flex-1 text-center text-base font-extrabold text-success">
                ✅ Aferin! Sıradaki harf geliyor…
              </div>
            ) : (
            <>
            <div className="flex-1">
              <div className="text-[11px] font-bold text-muted-foreground">Hedef harf</div>
              {ask.yazili ? (
                // ⚠️ Yazılı modda ADI YAZMA: cevabı vermek olur. Glif konur.
                <div className="text-base font-extrabold">Bu harfin adını bul</div>
              ) : (
                <div className="text-base font-extrabold">"{target.label}" harfini bul</div>
              )}
              <div className="mt-1 flex gap-1">
                {Array.from({ length: PER_TYPE }).map((_, i) => (
                  <span key={i} className={cn(
                    "h-2 w-6 rounded-full",
                    i < progress ? "bg-success" : "bg-muted",
                  )} />
                ))}
              </div>
            </div>
            {ask.mode === "ustte" ? (
              ask.tabela(target, { className: "mb-0 shrink-0", boy: "text-5xl" })
            ) : (
              <button
                onClick={() => ask.tekrar(target)}
                className="shrink-0 rounded-full bg-primary text-primary-foreground px-4 py-2 font-bold shadow-soft text-sm"
              >
                {ask.mode === "flash" ? "👁️ Göster" : "🔊 Dinle"}
              </button>
            )}
            </>
            )}
          </div>
        )}

        {won ? (
          <div className="rounded-3xl bg-card p-6 text-center shadow-card border-4 border-success/40 animate-bounce-in">
            <div className="text-6xl mb-2">🎉</div>
            <p className="text-xl font-extrabold">Kutu boşaldı!</p>
            <button onClick={reset} className="mt-3 rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Tekrar Oyna</button>
          </div>
        ) : (
          <div className="rounded-3xl bg-gradient-to-br from-warning/30 to-warning/10 border-8 border-warning/60 shadow-card p-3">
            <div className="grid grid-cols-3 gap-2">
              {board.cells.map((c, ci) => {
                const highlight = showHint && target && c.item.id === target.id && !c.cleared;
                return (
                  <button
                    key={c.uid}
                    onClick={() => tap(c)}
                    disabled={c.cleared}
                    className={cn(
                      "relative aspect-square rounded-2xl flex items-center justify-center shadow-soft border-4 transition-bouncy",
                      ask.yazili ? "text-base px-1" : "text-4xl",
                      c.cleared ? "opacity-0 pointer-events-none" :
                        c.wrong ? "bg-destructive/30 border-destructive animate-pop" :
                          highlight ? "bg-warning/30 border-warning ring-4 ring-warning/60 animate-pulse" :
                            "bg-card border-primary/20 hover:-translate-y-1 active:scale-95",
                    )}
                  >
                    {/* PC'de tuş rozeti — kutu 1-9 tuşuyla da seçilebilir */}
                    {pc && !c.cleared && (
                      <span className="absolute left-1 top-1 rounded bg-muted px-1 text-[10px] font-extrabold text-muted-foreground">
                        {ci + 1}
                      </span>
                    )}
                    {!c.cleared && <span>{ask.sik(c.item)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SorterGame;
