import { useEffect, useMemo, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useSarsinti } from "@/lib/gameFeel";
import { gamePool, pickCluster, pickWrongs, shuffle } from "./_shared";
import { tahtaBoyu } from "@/lib/zorluk";
import { agirlikliSec, siparisAc, siparisIsle, type Siparis } from "@/lib/siparis";
import { SiparisSeridi } from "@/components/SiparisSeridi";
import { useOyunSonu } from "@/lib/oyunSonucu";
import { OyunSonuKarti } from "@/components/OyunSonuKarti";
import { recordLetterMastery } from "@/data/srs";
import { recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";
import { sfx, titre } from "@/lib/juice";

// =============================================================
// Üçlü Eşleştir — Candy-Crush tarzı, 5x6 grid, 3-4 farklı nesne türü.
// Komşu kutuları takas et; yatay/dikey 3'lü oluşunca patlar ve adı söylenir.
// =============================================================

const COLS = 5;
const ROWS = 6;
const TYPES_COUNT = 4;
/** M-2: bir oturumda kaç hamle. Match-3 gerilimi hamle kıtlığından gelir. */
const HAMLE_BUTCESI = 25;

/**
 * Zorluğa göre harf ÇEŞİDİ: Kolay 3, Orta 4, Zor 5.
 *
 * ⚠️ Bu oyunda zorluk HIZ değil ÇEŞİTLİLİK: az çeşitte üçlüler kendiliğinden
 * oluşuyor (kolay), çok çeşitte çocuk aramak zorunda kalıyor. 3'ün altına
 * inilmez — 2 çeşitte tahta kendi kendini patlatıyor, oyun kalmıyor.
 */
function cesitSayisi(): number { return tahtaBoyu(TYPES_COUNT, 3, 6); }

type Cell = { id: number; item: ContentItem | null };

let _uid = 0;
const nid = () => ++_uid;

function rand<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

// ⚠️ SİPARİŞ AĞIRLIĞI BURADAN OKUNUR: `makeCell` saf bir fonksiyon, React
// state'ine erişemiyor. Modül düzeyindeki bu kutu, aktif siparişi doğum
// mantığına taşır — sipariş edilen harf daha sık düşer (bkz. siparis.ts).
let aktifSiparis: Siparis | null = null;

function makeCell(types: ContentItem[], avoid?: { left?: ContentItem | null; left2?: ContentItem | null; up?: ContentItem | null; up2?: ContentItem | null }): Cell {
  let it: ContentItem;
  let tries = 0;
  do {
    it = agirlikliSec(types, aktifSiparis);
    tries++;
  } while (
    tries < 20 && (
      (avoid?.left && avoid.left2 && avoid.left.id === it.id && avoid.left2.id === it.id) ||
      (avoid?.up && avoid.up2 && avoid.up.id === it.id && avoid.up2.id === it.id)
    )
  );
  return { id: nid(), item: it };
}

function buildGrid(types: ContentItem[]): Cell[][] {
  const g: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      row.push(makeCell(types, {
        left: c >= 1 ? row[c - 1].item : null,
        left2: c >= 2 ? row[c - 2].item : null,
        up: r >= 1 ? g[r - 1][c].item : null,
        up2: r >= 2 ? g[r - 2][c].item : null,
      }));
    }
    g.push(row);
  }
  return g;
}

// Returns cells (r,c) that are part of any 3+ in a row/col
function findMatches(g: Cell[][]): { r: number; c: number; item: ContentItem }[] {
  const matched = new Set<string>();
  const matchInfo: Record<string, ContentItem> = {};
  // horizontal
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c <= COLS; c++) {
      const same = c < COLS && g[r][c].item && g[r][c - 1].item && g[r][c].item!.id === g[r][c - 1].item!.id;
      if (same) run++;
      else {
        if (run >= 3) {
          for (let k = c - run; k < c; k++) {
            const key = `${r},${k}`;
            matched.add(key);
            matchInfo[key] = g[r][k].item!;
          }
        }
        run = 1;
      }
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r <= ROWS; r++) {
      const same = r < ROWS && g[r][c].item && g[r - 1][c].item && g[r][c].item!.id === g[r - 1][c].item!.id;
      if (same) run++;
      else {
        if (run >= 3) {
          for (let k = r - run; k < r; k++) {
            const key = `${k},${c}`;
            matched.add(key);
            matchInfo[key] = g[k][c].item!;
          }
        }
        run = 1;
      }
    }
  }
  return [...matched].map((k) => {
    const [r, c] = k.split(",").map(Number);
    return { r, c, item: matchInfo[k] };
  });
}

function applyGravity(g: Cell[][], types: ContentItem[]): Cell[][] {
  const next = g.map((row) => row.map((cell) => ({ ...cell })));
  for (let c = 0; c < COLS; c++) {
    // collect non-null bottom-up
    const stack: Cell[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (next[r][c].item) stack.push(next[r][c]);
    }
    for (let r = ROWS - 1; r >= 0; r--) {
      if (stack.length) next[r][c] = stack.shift()!;
      else next[r][c] = { id: nid(), item: rand(types) };
    }
  }
  return next;
}

// Tahtada hangi item türleri 1 takasla 3'lü oluşturabilir? — set olarak döner
function findPossibleMatchTypes(g: Cell[][]): ContentItem[] {
  const ids = new Set<string>();
  const map: Record<string, ContentItem> = {};
  const trySwap = (r1: number, c1: number, r2: number, c2: number) => {
    const copy = g.map((row) => row.slice());
    const tmp = copy[r1][c1]; copy[r1][c1] = copy[r2][c2]; copy[r2][c2] = tmp;
    const m = findMatches(copy);
    m.forEach((x) => { ids.add(x.item.id); map[x.item.id] = x.item; });
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c + 1 < COLS) trySwap(r, c, r, c + 1);
    if (r + 1 < ROWS) trySwap(r, c, r + 1, c);
  }
  return [...ids].map((i) => map[i]);
}

const Match3Game = () => {
  const [types, setTypes] = useState<ContentItem[]>(() => pickCluster(gamePool(), cesitSayisi()));
  const [grid, setGrid] = useState<Cell[][]>(() => buildGrid(types));
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [quiz, setQuiz] = useState<{ target: ContentItem; options: ContentItem[] } | null>(null);
  const [siparis, setSiparis] = useState<Siparis | null>(() => { const s0 = siparisAc(types); aktifSiparis = s0; return s0; });
  const { sinif: sarsSinif, sars } = useSarsinti();
  /**
   * ⚠️ ZİNCİR SES KATMANINDA VARDI, GÖZDE YOKTU: art arda patlayan gruplarda
   * perde yükseliyordu ama ekranda hiçbir şey "zincir kuruyorum" demiyordu.
   * Match-3 türünün asıl hazzı bu — rozet zincirle büyür, 3. halkadan sonra
   * tahta da sarsılır. Zincir bir sonraki hamlede sıfırlanır.
   */
  const [zincir, setZincir] = useState(0);
  /**
   * ⚠️ TAŞLAR DÜŞMÜYORDU, YERİNDE BELİRİYORDU: `applyGravity` diziyi
   * yeniden diziyordu ama ekranda hiçbir hareket yoktu — patlamadan sonra
   * tahta bir anda BAŞKA bir tahtaya dönüşüyordu. Match-3'ün yarısı bu
   * düşüş; üstelik hepsini AYNI ANDA düşürmek de sarsak görünüyor,
   * satır satır KADEMELİ gecikme şart (türün bilinen çözümü).
   * Anahtar = hücre id'si, değer = gecikme (ms).
   */
  const [dusen, setDusen] = useState<Map<number, number>>(new Map());
  const [siparisParla, setSiparisParla] = useState(false);
  // M-2 HAMLE BÜTÇESİ: her hamlenin bedeli olsun. Bitince oyun kapanır.
  const [kalanHamle, setKalanHamle] = useState(HAMLE_BUTCESI);
  const bitti = kalanHamle <= 0;
  const rapor = useOyunSonu("match3", bitti, score, { birim: "puan" });

  useEffect(() => {
    const h = () => {
      const t = pickCluster(gamePool(), cesitSayisi());
      setTypes(t); setGrid(buildGrid(t)); setScore(0); setSelected(null);
    };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  }, []);

  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());

  // resolve matches cascade — her item türünü TEK TEK patlat, sesi söyle, sonra devam
  const resolve = async (start: Cell[][]) => {
    let cur = start;
    let safety = 0;
    let cascadeIndex = 0;
    while (safety++ < 20) {
      const matches = findMatches(cur);
      if (!matches.length) break;

      // item türüne göre grupla
      const groups = new Map<string, { r: number; c: number; item: ContentItem }[]>();
      matches.forEach((m) => {
        const arr = groups.get(m.item.id) || [];
        arr.push(m);
        groups.set(m.item.id, arr);
      });

      // her grubu sırayla işle
      let firstInCascade = true;
      for (const [, group] of groups) {
        const item = group[0].item;
        const groupIds = new Set(group.map((m) => {
          const cell = cur[m.r]?.[m.c];
          return cell?.id ?? -1;
        }));

        // İlk hamleden sonraki gruplar — önce vurgula, sonra patlat
        if (!firstInCascade || cascadeIndex > 0) {
          setHighlighted(groupIds);
          await new Promise((res) => setTimeout(res, 550));
          setHighlighted(new Set());
        }
        firstInCascade = false;

        // ⚠️ ZİNCİR DERİNLEŞTİKÇE TİZLEŞİR: art arda patlayan gruplarda aynı
        // sesi duymak zinciri görünmez kılıyor; yükselen perde "devam ediyor"
        // diyor. Match-3'lerin klasik kuralı.
        // M-1: bu eşleşme siparişi karşıladı mı?
        {
          const so = siparisIsle(aktifSiparis, item.id, types);
          if (so.isabet) {
            setScore((sc) => sc + group.length);     // çift puan (aşağıdaki normal puanla birlikte)
            setSiparisParla(true);
            setTimeout(() => setSiparisParla(false), 700);
          }
          if (so.tamam) { sfx("seri"); void playItem(item); }
          aktifSiparis = so.siparis;
          setSiparis(so.siparis);
        }
        sfx("patlat", { seri: cascadeIndex * 2 });
        titre(cascadeIndex > 0 ? "orta" : "hafif");
        if (cascadeIndex > 0) {
          setZincir(cascadeIndex + 1);
          if (cascadeIndex >= 2) sars();   // derin zincir tahtayı sarsar
        }
        setScore((s) => s + group.length);
        // bu grubu null'a çevir
        cur = cur.map((row, r) => row.map((cell, c) => (
          group.some((m) => m.r === r && m.c === c) ? { id: cell.id, item: null } : cell
        )));
        setGrid(cur);
        // sesi söyle ve bitmesini bekle (kesintisiz)
        await playItem(item);
        await new Promise((res) => setTimeout(res, 150));
      }

      cascadeIndex++;
      // tüm gruplar patladıktan sonra yerçekimi
      const onceki = cur;
      cur = applyGravity(cur, types);
      // Yeri DEĞİŞEN her hücre düşme animasyonu alır; gecikme ALTTAN
      // yukarı artar (aşağıdaki taş önce oturur — gerçek yerçekimi sırası).
      const yeniDusen = new Map<number, number>();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (onceki[r][c].id !== cur[r][c].id) {
            yeniDusen.set(cur[r][c].id, (ROWS - 1 - r) * 28);
          }
        }
      }
      setDusen(yeniDusen);
      setGrid(cur);
      await new Promise((res) => setTimeout(res, 300));
      setDusen(new Map());
    }
  };

  const tap = async (r: number, c: number) => {
    // ⚠️ `bitti` EMNİYETİ: sonuç kartı şu an tam ekran kaplayıp tahtayı
    // kapatıyor, ama kartı küçültmek/arkasını göstermek hamle bütçesini
    // eksiye düşürürdü. Kural mantıkta dursun, görselde değil.
    if (busy || quiz || bitti) return;
    if (!selected) { setSelected({ r, c }); return; }
    if (selected.r === r && selected.c === c) { setSelected(null); return; }
    const dr = Math.abs(selected.r - r), dc = Math.abs(selected.c - c);
    if (dr + dc !== 1) { setSelected({ r, c }); return; }
    const sel = selected;
    setBusy(true);
    setSelected(null);
    const swapped = grid.map((row) => row.slice());
    const a = swapped[sel.r][sel.c];
    swapped[sel.r][sel.c] = swapped[r][c];
    swapped[r][c] = a;
    setGrid(swapped);
    setKalanHamle((h) => h - 1);
    await new Promise((res) => setTimeout(res, 200));
    const matches = findMatches(swapped);
    if (!matches.length) {
      titre("hata");
      await playFeedback(false);
      const back = swapped.map((row) => row.slice());
      const tmp = back[sel.r][sel.c];
      back[sel.r][sel.c] = back[r][c];
      back[r][c] = tmp;
      setGrid(back);
      setBusy(false);
      return;
    }
    setZincir(0);   // yeni hamle → zincir sayacı sıfırdan
    await resolve(swapped);

    // Hamle sayacı + ekran taraması: ≥3 farklı 3'lenebilir tür varsa sınav aç
    const nextCount = moveCount + 1;
    setMoveCount(nextCount);
    if (nextCount % 3 === 0) {
      // setGrid async — son halini almak için küçük bekleme
      await new Promise((res) => setTimeout(res, 150));
      setGrid((curr) => {
        const possible = findPossibleMatchTypes(curr);
        if (possible.length >= 3) {
          const target = possible[Math.floor(Math.random() * possible.length)];
          const distractors = pickWrongs(possible, target, 2);
          const opts = shuffle([target, ...distractors]);
          setTimeout(() => {
            setQuiz({ target, options: opts });
            playItem(target);
          }, 200);
        }
        return curr;
      });
    }
    setBusy(false);
  };

  const reset = () => {
    const t = pickCluster(gamePool(), cesitSayisi());
    const s0 = siparisAc(t); aktifSiparis = s0; setSiparis(s0);
    setKalanHamle(HAMLE_BUTCESI);
    setTypes(t); setGrid(buildGrid(t)); setScore(0); setSelected(null); setBusy(false);
    setMoveCount(0); setQuiz(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-topic-pink/20 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🍬 Üçlü Eşleştir" backTo="/oyunlar" centered onReset={reset} />

        <SiparisSeridi siparis={siparis} parla={siparisParla} />

        <div className="mb-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-primary/30">
            <div className="text-[10px] font-bold text-muted-foreground">Eşleşme</div>
            <div className="text-xl font-extrabold text-primary">{score}</div>
          </div>
          <div className={cn(
            "rounded-xl bg-card p-2 shadow-soft border-2",
            kalanHamle <= 5 ? "border-destructive/60" : "border-warning/30",
          )}>
            <div className="text-[10px] font-bold text-muted-foreground">Hamle</div>
            <div className={cn("text-xl font-extrabold tabular-nums",
              kalanHamle <= 5 ? "text-destructive" : "text-warning")}>{kalanHamle}</div>
          </div>
        </div>

        <p className="text-center text-sm font-bold text-muted-foreground mb-2">
          Komşu kutuları yer değiştir — 3'lü dizilim patlasın!
        </p>

        {bitti && (
          <OyunSonuKarti skor={score} birim="eşleşme" rapor={rapor} onTekrar={reset} />
        )}

        <div className={cn(
          "relative rounded-3xl bg-gradient-to-br from-topic-pink/30 to-warning/20 border-8 border-topic-pink/60 shadow-card p-2",
          sarsSinif,
        )}>
          {/* ZİNCİR ROZETİ — büyüdükçe büyür. Sayı yalnız bilgi değil ÖDÜL:
              çocuk "kazara oldu" ile "zincir kurdum"u ancak böyle ayırır. */}
          {zincir > 1 && (
            <div
              key={zincir}
              className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 animate-juice-pop rounded-full bg-warning px-4 py-1 font-extrabold text-warning-foreground shadow-elegant"
              style={{ fontSize: `${Math.min(1.9, 0.95 + zincir * 0.18)}rem` }}
            >
              ⛓️ ZİNCİR ×{zincir}
            </div>
          )}
          <style>{`
            /* Düşüş: taş üstten gelir, hedefi hafifçe aşıp oturur (aşımlı
               yumuşatma — "juice"in klasik eğrisi). Sadece transform ve
               opacity: derleme katmanında kalır, yerleşim tetiklemez. */
            @keyframes m3-dus {
              0%   { transform: translateY(-140%); opacity: 0; }
              70%  { transform: translateY(6%);    opacity: 1; }
              100% { transform: translateY(0);     opacity: 1; }
            }
            .m3-dus { animation: m3-dus 0.28s cubic-bezier(0.33, 1, 0.68, 1) both; }
          `}</style>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {grid.map((row, r) => row.map((cell, c) => {
              const isSel = selected?.r === r && selected?.c === c;
              const isHi = highlighted.has(cell.id);
              return (
                <button
                  key={cell.id}
                  // ⚠️ DOKUNMA TEPKİSİ `pointerdown`'DA: `click` parmağın
                  // KALKMASINI bekliyor — yani geri bildirim çocuğun parmağını
                  // kaldırmasına kadar gecikiyor. Bu dokunuşun BİR CEVAP
                  // OLMADIĞI oyunlarda (kart çevirme, taş seçme, parça takası)
                  // basma anında tepki vermek doğru; yanlışlıkla dokunmanın
                  // SRS bedeli yok. (Cevap sayılan yerler `click`te kaldı.)
                  onPointerDown={() => tap(r, c)}
                  disabled={busy || !cell.item}
                  className={cn(
                    "aspect-square rounded-xl flex items-center justify-center text-3xl shadow-soft border-2 transition-bouncy",
                    dusen.has(cell.id) && "m3-dus",
                    !cell.item ? "bg-transparent border-transparent" :
                      isHi ? "bg-warning/60 border-warning scale-125 animate-pulse ring-4 ring-warning" :
                      isSel ? "bg-primary/30 border-primary scale-110 animate-pop" :
                        "bg-card border-primary/20 active:scale-95"
                  )}
                  style={dusen.has(cell.id) ? { animationDelay: `${dusen.get(cell.id)}ms` } : undefined}
                >
                  {cell.item && <EmojiView value={cell.item.emoji} />}
                </button>
              );
            }))}
          </div>

          {quiz && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur gap-4 p-4 rounded-2xl">
              <div className="text-xs font-bold text-muted-foreground">🎯 Sınav</div>
              <p className="text-base font-extrabold text-center">Sesi dinle, doğru harfi seç</p>
              <button
                onClick={() => playItem(quiz.target)}
                className="rounded-full bg-primary text-primary-foreground px-4 py-2 font-bold shadow-soft text-sm"
              >
                🔊 Tekrar dinle
              </button>
              <div className="flex gap-3 flex-wrap justify-center">
                {quiz.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      const correct = opt.id === quiz.target.id;
                      recordLetterMastery(quiz.target.id, correct);
                      recordGameAnswer(quiz.target, correct, {
                        chosenId: opt.id, shownIds: quiz.options.map((o) => o.id),
                      });
                      if (correct) { sfx("topla"); titre("basari"); } else { sfx("carp"); titre("hata"); }
                      playFeedback(correct);
                      setQuiz(null);
                    }}
                    className="text-5xl bg-card rounded-2xl p-4 border-4 border-primary/40 shadow-card active:scale-95"
                  >
                    <EmojiView value={opt.emoji} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Match3Game;
