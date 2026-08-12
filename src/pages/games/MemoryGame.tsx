import { useEffect, useMemo, useRef, useState } from "react";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { InGameQuiz } from "@/components/InGameQuiz";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useGameMode } from "@/lib/gameMode";
import { gamePool, pickCluster, shuffle } from "./_shared";
import { recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";

/**
 * `variant` bir çiftin İKİ YÜZÜdür.
 *
 * SÜPER ÖĞRENME'de (kullanıcı fikri) çift artık iki AYNI glif değil,
 * **ses ↔ resim**tir: "a" kartı harfin GLİFİni gösterir (sessiz), "b" kartı
 * 🔊 simgesidir ve açılınca harfin GERÇEK KAYDINI çalar. Çocuk sesi duyup
 * o harfin nerede olduğunu bulmak zorunda kalır — Kur'an okurken kullandığı
 * eşleştirmenin ta kendisi. Normal (eğlence) modda eski hâli korunur.
 */
interface Card { uid: string; item: ContentItem; flipped: boolean; matched: boolean; variant: "a" | "b"; }

function buildBoard(pairs: number): Card[] {
  const items = pickCluster(gamePool(), pairs);
  const cards: Card[] = [];
  items.forEach((it) => {
    cards.push({ uid: `${it.id}-a`, item: it, flipped: false, matched: false, variant: "a" });
    cards.push({ uid: `${it.id}-b`, item: it, flipped: false, matched: false, variant: "b" });
  });
  return shuffle(cards);
}

const PAIRS = 6;

const MemoryGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const [cards, setCards] = useState<Card[]>(() => buildBoard(PAIRS));
  const [first, setFirst] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const matchCountRef = useRef(0); // normal modda 3 eşleşmede 1 gerçek test
  /** Süper modda kartlar ses↔resim çifti olur (yukarıdaki nota bak). */
  const sesliEslestirme = isSuper;
  /**
   * Hangi SES kartları daha önce açıldı?
   *
   * ⚠️ İLERLEME SAYIMININ ANAHTARI (kullanıcı kuralı): seviye yalnız çocuk
   * bir harfin SES kartını İLK DEFA açıp doğru resmi bulduğunda artar.
   * Gerekçe: o an gerçek bir geri getirme yaşanır — sesi duyar, o harfin
   * hangi karede olduğunu HATIRLAMAK zorundadır (resmi daha önce açıp
   * yerini öğrenmiştir). TERSİ SAYILMAZ: önce resmi açıp sonra sesi bulmak
   * yalnızca konum hafızasıdır, harf bilgisi gerektirmez. İkinci ve sonraki
   * açılışlar da sayılmaz — kart artık bilinen bir yerdedir.
   */
  const acilanSesler = useRef<Set<string>>(new Set());
  /**
   * Bu denemede AÇILAN İLK KART, daha önce hiç açılmamış bir SES kartı mıydı?
   * ⚠️ Bunu ayrı tutmak ŞART: kartı açar açmaz `acilanSesler`e eklediğimiz
   * için eşleşme anında "daha önce açılmış mıydı" sorusu artık cevaplanamaz.
   */
  const ilkKartYeniSes = useRef(false);

  const won = useMemo(() => cards.length > 0 && cards.every((c) => c.matched), [cards]);

  const reset = () => {
    setCards(buildBoard(PAIRS)); setFirst(null); setBusy(false); setMoves(0);
    matchCountRef.current = 0; setShowQuiz(false); acilanSesler.current = new Set();
  };

  /** Bu kart harfin SESİNİ mi taşıyor? (süper modda "b" yüzü) */
  const sesKarti = (c: Card) => sesliEslestirme && c.variant === "b";

  const flip = async (c: Card) => {
    if (busy || c.flipped || c.matched) return;
    const updated = cards.map((x) => x.uid === c.uid ? { ...x, flipped: true } : x);
    setCards(updated);

    if (!first) {
      setBusy(true);
      // Ses↔resim modunda GLİF kartı SESSİZ açılır — sesi çalmak cevabı
      // vermek olurdu. Yalnız 🔊 kartı harfin kaydını çalar.
      if (!sesliEslestirme || sesKarti(c)) await playItem(c.item);
      // Sayım bayrağını EKLEMEDEN ÖNCE oku (yukarıdaki nota bak).
      ilkKartYeniSes.current = sesKarti(c) && !acilanSesler.current.has(c.uid);
      if (sesKarti(c)) acilanSesler.current.add(c.uid);
      setFirst(c);
      setBusy(false);
      return;
    }
    setMoves((m) => m + 1);
    setBusy(true);
    if (sesKarti(c)) acilanSesler.current.add(c.uid);
    const isMatch = first.item.id === c.item.id;
    if (sesliEslestirme) {
      // ⚠️ YALNIZ GERÇEK GERİ GETİRME SAYILIR (yukarıdaki nota bak):
      // ilk kart SES kartıysa, o ses İLK DEFA açılmışsa ve eşleşme
      // tutmuşsa. Yanlış eşleşme SRS'e YAZILMAZ: hafıza oyununda ıska
      // çoğu zaman konumu unutmaktır, harfi bilmemek değil — buna −2
      // seviye yazmak ölçtüğümüz şeyi bozar.
      if (ilkKartYeniSes.current && isMatch) {
        recordGameAnswer(c.item, true, { chosenId: c.item.id });
      }
      ilkKartYeniSes.current = false;
    }
    if (isMatch) {
      setCards((cs) => cs.map((x) => x.item.id === c.item.id ? { ...x, matched: true, flipped: true } : x));
      await playItem(c.item);
      setFirst(null); setBusy(false);
      if (!isSuper) {
        matchCountRef.current += 1;
        if (matchCountRef.current % 3 === 0) setShowQuiz(true);
      }
    } else {
      // Yanlış eşleşmede doğru harfin sesi yine de duyulsun (öğretici an);
      // ses↔resim modunda ikinci kart glifse onun kaydını çalıyoruz.
      await playItem(c.item);
      setCards((cs) => cs.map((x) => (x.uid === first.uid || x.uid === c.uid) ? { ...x, flipped: false } : x));
      setFirst(null); setBusy(false);
    }
  };

  useEffect(() => {
    if (won) playFeedback(true);
  }, [won]);

  useEffect(() => {
    const h = () => reset();
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-topic-pink/30 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🧠 Hafıza Kartları" backTo="/oyunlar" centered onReset={reset} />

        {sesliEslestirme && (
          <p className="mb-3 rounded-2xl border-2 border-info/40 bg-info/10 px-3 py-2 text-center text-xs font-bold text-foreground">
            🔊 kartını aç, sesi dinle — o harfin <b>resmini</b> bul!
          </p>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-primary/30">
            <div className="text-xs text-muted-foreground font-bold">Hamle</div>
            <div className="text-2xl font-extrabold text-primary">{moves}</div>
          </div>
          <div className="rounded-2xl bg-card p-3 text-center shadow-card border-2 border-success/30">
            <div className="text-xs text-muted-foreground font-bold">Kalan</div>
            <div className="text-2xl font-extrabold text-success">{cards.filter((c) => !c.matched).length / 2}</div>
          </div>
        </div>

        {won && (
          <div className="rounded-3xl bg-card p-6 mb-4 text-center shadow-card border-4 border-success/40 animate-bounce-in">
            <div className="text-5xl mb-2">🏆</div>
            <p className="text-lg font-extrabold">Hepsini buldun! {moves} hamle</p>
            <button onClick={reset} className="mt-3 rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground">Tekrar Oyna</button>
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {cards.map((c) => (
            <button
              key={c.uid}
              onClick={() => flip(c)}
              className={cn(
                "aspect-square rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-card border-4 transition-bouncy",
                c.matched ? "bg-success/20 border-success/50 opacity-60" :
                  c.flipped ? "bg-card border-primary/40 animate-pop" :
                    "bg-primary border-primary text-primary-foreground hover:-translate-y-1",
              )}
            >
              {(c.flipped || c.matched)
                ? (sesKarti(c)
                    ? <span className="text-4xl" aria-label="ses kartı">🔊</span>
                    : <span className="text-5xl"><EmojiView value={c.item.emoji} /></span>)
                : <span>?</span>}
            </button>
          ))}
        </div>
      </main>
      {showQuiz && <InGameQuiz onDone={() => setShowQuiz(false)} />}
    </div>
  );
};

export default MemoryGame;
