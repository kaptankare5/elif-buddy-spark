import { useEffect, useRef, useState } from "react";
import { useSecenekTuslari, usePcMi } from "@/lib/klavye";
import { rampa } from "@/lib/zorluk";
import { useOyunSonu } from "@/lib/oyunSonucu";
import { OyunSonuKarti } from "@/components/OyunSonuKarti";
import { sfx, titre } from "@/lib/juice";
import { PageHeader } from "@/components/PageHeader";
import { playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useSarsinti } from "@/lib/gameFeel";
import { Volume2, Eye } from "lucide-react";
import { gamePool } from "./_shared";
import { useAskLayer } from "./_askUI";
import { recordLetterMastery } from "@/data/srs";
import { pickNextGameItem, recordGameAnswer, showHintFor } from "@/lib/gameProgress";
import { useGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";

interface Balloon {
  uid: string;
  item: ContentItem;
  x: number; // 0-100 (yüzde)
  y: number; // 0-100 başlangıç y
  speed: number;
  popped: boolean;
}

/** B-1: bir dalgada kaç doğru balon. Küçük tutulur — dalga bir nefes anıdır. */
const DALGA_BOYU = 10;

const COLORS = ["bg-topic-pink", "bg-topic-blue", "bg-topic-orange", "bg-topic-purple", "bg-success", "bg-warning"];

const BalloonGame = () => {
  const ask = useAskLayer();
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const [target, setTarget] = useState<ContentItem | null>(null);
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [score, setScore] = useState(0);
  // ⚠️ SARSINTI OYUN ALANINA, SAYFAYA DEĞİL (gameFeel.ts): skor ve kalpler
  // okunur kalsın; çocukta bütün sayfayı sarsmak mide bulandırıyor.
  const { sinif: sarsSinif, sars } = useSarsinti();
  const [misses, setMisses] = useState(0);
  // ⚠️ B-1 DALGA YAPISI: oyun hiç bitmiyordu — hedef yok, kayıp yok, kapanış
  // yok. Çocuk oyunu BİTİRMİYOR, terk ediyor; terk edilen oyuna dönülmez.
  // 10 balonluk dalgalar hem hedef verir hem "bir dalga daha / burada
  // bırakabilirim" anını doğal olarak yaratır.
  const [dalga, setDalga] = useState(1);
  const [dalgaSkor, setDalgaSkor] = useState(0);
  const [dalgaBitti, setDalgaBitti] = useState(false);
  const [oyunBittiMi, setOyunBittiMi] = useState(false);
  const rapor = useOyunSonu("balloon", oyunBittiMi, dalga - 1, { birim: "dalga" });
  const [flash, setFlash] = useState(false); // doğru cevapta ışık parlaması (normal mod kolaylık)
  /** Doğru cevap sayısı — rampa buna bakar (skor değil). */
  const dogruRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const newRound = () => {
    const pool = gamePool();
    const tgt = pickNextGameItem(pool) || pool[0];
    setTarget(tgt);
    // Klasikte 5 balon; şimşek/tabela modunda şık sayısı azalır (yazı okumak
    // glif taramaktan yavaştır, balonlar da yukarı kaçıyor).
    const all = ask.secenekler(pool, tgt, 5);
    // Yatay yerleşim şık SAYISINA göre — 2 balonu sola yığmasın.
    const aralik = 100 / (all.length + 1);
    setBalloons(all.map((it, i) => ({
      uid: `${it.id}-${Date.now()}-${i}`,
      item: it,
      x: aralik * (i + 1) + (Math.random() * 6 - 3),
      y: 100 + i * 15,
      // ⚠️ Hız RAMPAYA bağlı. Eskiden 0.18-0.30 arası rastgeleydi ve skordan
      // tamamen bağımsızdı: balonlar 50 doğru sonra da aynı tempoda çıkıyordu.
      speed: (0.18 + Math.random() * 0.12) * rampa(dogruRef.current),
      popped: false,
    })));
    void ask.sor(tgt);
  };

  // Animasyon
  useEffect(() => {
    const tick = (ts: number) => {
      if (!lastTickRef.current) lastTickRef.current = ts;
      const dt = Math.min(50, ts - lastTickRef.current);
      lastTickRef.current = ts;
      setBalloons((bs) => bs.map((b) => b.popped ? b : { ...b, y: b.y - b.speed * dt * 0.06 }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Roundu kontrol: tüm balonlar geçti mi?
  useEffect(() => {
    if (!balloons.length) return;
    if (balloons.every((b) => b.popped || b.y < -20)) {
      // round bitti
      setTimeout(newRound, 400);
    }
  }, [balloons]);

  useEffect(() => { newRound(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    const h = () => { setScore(0); setMisses(0); dogruRef.current = 0; newRound(); };
    window.addEventListener("games-lang-change", h);
    return () => window.removeEventListener("games-lang-change", h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PC: 1-5 tuşlarıyla balon patlatılabilsin (patlamış balon atlanır).
  const pc = usePcMi();
  useSecenekTuslari(balloons.length, (i) => { const b = balloons[i]; if (b && !b.popped) void pop(b); });
  const pop = async (b: Balloon) => {
    // ⚠️ SES ŞIKLARI: ilk dokunuş yalnız DİNLETİR, ikincisi seçer. Şık
    // görünmez (hoparlör) olduğu için dinlemeden seçmek kör atış olurdu.
    // Öteki modlarda `onayla` hep true döner.
    if (!ask.onayla(b.item)) return;
    if (b.popped || !target) return;
    setBalloons((bs) => bs.map((x) => x.uid === b.uid ? { ...x, popped: true } : x));
    const correct = b.item.id === target.id;
    recordLetterMastery(target.id, correct);
    // Karışıklık ölçümü: hangi balonu patlattı + ekranda hangileri vardı
    recordGameAnswer(target, correct, {
      chosenId: b.item.id, shownIds: balloons.map((x) => x.item.id),
    });
    if (correct) {
      setScore((s) => s + 1);
      dogruRef.current += 1;
      const yeniDalgaSkor = dalgaSkor + 1;
      setDalgaSkor(yeniDalgaSkor);
      setFlash(true); setTimeout(() => setFlash(false), 450); // ışık parlaması
      sfx("patlat");
      titre("basari");
      await playFeedback(true);
      // ⚠️ Yeni tur, harfin kaydı BİTİNCE başlar (klasikte söz hemen çözülür,
      // eski 350 ms akış korunur).
      await ask.cevapSesi(target, true);
      if (yeniDalgaSkor >= DALGA_BOYU) {
        // Dalga bitti: kısa kutlama, sonra "devam / bırak" kararı çocuğun.
        sfx("seri"); titre("basari");
        setDalgaBitti(true);
        setBalloons([]);
        return;
      }
      setTimeout(newRound, 350);
    } else {
      setMisses((m) => m + 1);
      sfx("carp");
      titre("hata");
      sars();
      await playFeedback(false);
    }
  };

  const reset = () => {
    setScore(0); setMisses(0); setDalga(1); setDalgaSkor(0);
    setDalgaBitti(false); setOyunBittiMi(false); dogruRef.current = 0; newRound();
  };

  /** Sonraki dalga — biraz daha hızlı (rampa zaten doğru sayısına bağlı). */
  const sonrakiDalga = () => {
    setDalga((d) => d + 1);
    setDalgaSkor(0);
    setDalgaBitti(false);
    newRound();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-info/20 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="🎈 Balon Patlatma" backTo="/oyunlar" centered onReset={reset} />

        {dalgaBitti && !oyunBittiMi && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-xs rounded-3xl border-4 border-success/50 bg-card p-6 text-center shadow-elegant animate-bounce-in">
              <div className="text-5xl mb-1">🎉</div>
              <div className="text-lg font-extrabold text-foreground">{dalga}. dalga bitti!</div>
              <div className="mt-1 text-sm font-bold text-muted-foreground">
                Toplam {score} balon · {misses} kaçtı
              </div>
              <button
                onClick={sonrakiDalga}
                className="mt-5 w-full rounded-2xl bg-primary px-4 py-4 text-lg font-extrabold text-primary-foreground shadow-card transition-bouncy active:scale-95"
              >
                ▶️ {dalga + 1}. dalga
              </button>
              <button
                onClick={() => setOyunBittiMi(true)}
                className="mt-2 w-full rounded-2xl border-2 border-border bg-muted/40 px-4 py-2.5 text-sm font-extrabold text-muted-foreground transition-bouncy active:scale-95"
              >
                Bitir
              </button>
            </div>
          </div>
        )}

        {oyunBittiMi && (
          <OyunSonuKarti
            baslik="Balon bitti" skor={dalga - 1} birim="dalga" rapor={rapor}
            onTekrar={reset} ek={<>{score} balon patlattın</>}
          />
        )}

        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">{dalga}. dalga</div>
            <div className="text-xl font-extrabold text-success tabular-nums">{dalgaSkor}/{DALGA_BOYU}</div>
          </div>
          <div className="rounded-xl bg-card p-2 shadow-soft border-2 border-destructive/30">
            <div className="text-[10px] font-bold text-muted-foreground">Yanlış</div>
            <div className="text-xl font-extrabold text-destructive">{misses}</div>
          </div>
          <button
            onClick={() => ask.tekrar(target)}
            disabled={ask.mode === "ustte"}
            className="rounded-xl bg-primary text-primary-foreground p-2 shadow-soft border-2 border-primary font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            {ask.mode === "flash" ? <Eye className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {ask.mode === "flash" ? "Göster" : "Dinle"}
          </button>
        </div>

        <div className="bg-card rounded-2xl p-3 mb-3 shadow-card border-2 border-primary/20 text-center">
          <p className="text-xs font-bold text-muted-foreground">
            {ask.yazili ? "Gördüğün harfin adını patlat:" : "Sesi dinle, doğru balonu patlat:"}
          </p>
          {!ask.tekrarVar ? (
            // Glifin ASILI durduğu modlar (Tabela / Ses Şıkları / Şekil Eşleme):
            // ortak tabela çizilir, ses düğmesi YOK — çalmak cevabı vermek olur.
            // Mod adı yerine `tekrarVar` okunur ki yeni mod eklendiğinde
            // burası unutulmasın.
            ask.tabela(target, { className: "mb-0 mt-1", boy: "text-5xl" })
          ) : (
            <button onClick={() => ask.tekrar(target)} className="text-5xl mt-1" aria-label="Tekrar">
              {ask.mode === "flash" ? "👁️" : "🔊"}
            </button>
          )}
        </div>

        <div className={cn(
          "relative bg-gradient-to-b from-info/10 to-info/30 rounded-3xl shadow-card border-4 border-info/30 overflow-hidden",
          sarsSinif,
        )} style={{ height: "60vh" }}>
          <style>{`
            @keyframes balon-patla {
              0%   { width: 10px; height: 10px; opacity: 0.9; }
              100% { width: 96px; height: 96px; opacity: 0; }
            }
            .balon-patla { animation: balon-patla 0.34s ease-out both; }
          `}</style>
          {/* Doğru cevap ışık parlaması (normal modda kolaylık hissi) */}
          {flash && (
            <div className="pointer-events-none absolute inset-0 z-10 animate-fade-in"
                 style={{ background: "radial-gradient(circle at 50% 60%, hsl(var(--warning)/0.55), transparent 60%)" }} />
          )}
          {balloons.map((b, i) => {
            const isCorrect = !!target && b.item.id === target.id;
            // İpucu halkası: L1 + daha önce görülmüş harf (showHintFor).
            const hint = isCorrect && !b.popped && showHintFor(b.item);
            return (
              <button
                key={b.uid}
                onClick={() => pop(b)}
                disabled={b.popped}
                className={cn(
                  // ⚠️ BALON "PATLAMIYORDU", SÖNÜYORDU: oyunun adı Balon
                  // Patlatma ama tıklanan balon sadece `opacity-0`'a
                  // gidiyordu — türün TEK haz anı geri bildirimsizdi.
                  // Artık önce ŞİŞİP sonra kayboluyor (patlama okunuyor) ve
                  // arkasında kısa bir parça halkası kalıyor.
                  "absolute -translate-x-1/2 transition-all duration-200 ease-out",
                  b.popped && "opacity-0 scale-150 pointer-events-none",
                )}
                style={{ left: `${b.x}%`, bottom: `${b.y}%` }}
              >
                {pc && !b.popped && (
                  <span className="absolute left-1 top-1 rounded bg-white/85 px-1 text-[10px] font-extrabold text-foreground/70">{i + 1}</span>
                )}
                <div className={cn(
                  "flex items-center justify-center shadow-card",
                  // Yazılı modda balon yerine GENİŞ TABELA: "Be (başta)" gibi bir ad
                  // 64 piksellik baloncuğa sığmıyor, taşıp okunmaz oluyordu.
                  ask.yazili ? "w-28 h-16 rounded-2xl px-1" : "w-16 h-20 rounded-[50%]",
                  COLORS[i % COLORS.length],
                  hint && "ring-4 ring-warning ring-offset-2 ring-offset-transparent animate-pulse",
                )}>
                  <span className={cn(ask.yazili ? "text-base text-white" : "text-3xl")}>
                    {ask.sik(b.item)}
                  </span>
                </div>
                {/* patlama halkası — balonun bıraktığı iz */}
                {b.popped && (
                  <span
                    key={`pt-${b.uid}`}
                    className="balon-patla pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/80"
                  />
                )}
                <div className="w-px h-4 bg-foreground/40 mx-auto" />
              </button>
            );
          })}
        </div>
      </main>
      {ask.katman}
    </div>
  );
};

export default BalloonGame;
