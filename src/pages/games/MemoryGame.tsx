import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmojiView } from "@/components/EmojiView";
import { PageHeader } from "@/components/PageHeader";
import { InGameQuiz } from "@/components/InGameQuiz";
import { playItem, playFeedback } from "@/lib/audio";
import { cn } from "@/lib/utils";
import { useGameMode } from "@/lib/gameMode";
import { tahtaBoyu } from "@/lib/zorluk";
import { useOyunSonu } from "@/lib/oyunSonucu";
import { gamePool, pickCluster, shuffle } from "./_shared";
import { recordGameAnswer } from "@/lib/gameProgress";
import type { ContentItem } from "@/data/types";
import { sfx, titre } from "@/lib/juice";

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

/**
 * Zorluğa göre çift sayısı: Kolay 4, Orta 6, Zor 8.
 *
 * ⚠️ ÇİFT SAYIYA YUVARLANIR: `tahtaBoyu` tek sayı döndürebiliyor (Kolay'da 5)
 * ve ızgara 3 sütunlu — 10 kart 3+3+3+1 diziliyor, son satırda tek kart
 * kalınca tahta bozuk görünüyor.
 * ⚠️ AŞAĞI yuvarlanır, en yakına DEĞİL: `Math.round(5/2)*2` altı veriyor,
 * yani Kolay ile Orta AYNI tahtayı alıyordu (ölçüldü: 6 · 6 · 8) ve zorluk
 * bu oyunda hiçbir şey değiştirmiyordu.
 */
function ciftSayisi(tur = 0): number {
  // ⚠️ H-2 TUR ZİNCİRİ: Kolay'da 4 çiftle tahta 22 SANİYEDE bitiyordu ve
  // sonrası boştu. Her turda bir çift eklenir; oturum 22 saniye değil birkaç
  // dakika sürer. Tavan 10 — türün kuralı "kart sayısı çocuğun çalışma
  // belleğine göre", sonsuz büyüyen tahta hafıza oyunu olmaktan çıkar.
  const taban = Math.max(4, Math.floor(tahtaBoyu(PAIRS, 4, 8) / 2) * 2);
  return Math.min(10, taban + tur);
}

/** ⚠️ H-1 YILDIZ: kusursuz oyun = çift sayısı kadar hamle. 1.5 katına kadar
 *  3 yıldız, 2 katına kadar 2, sonrası 1. "Bitirdim" ile "iyi bitirdim" ayrı. */
function yildiz(hamle: number, cift: number): number {
  if (hamle <= cift * 1.5) return 3;
  if (hamle <= cift * 2.2) return 2;
  return 1;
}

const MemoryGame = () => {
  const [mode] = useGameMode();
  const isSuper = mode === "super";
  const [tur, setTur] = useState(0);
  const [cards, setCards] = useState<Card[]>(() => buildBoard(ciftSayisi(0)));
  /**
   * ⚠️ EŞLEŞME BİR OLAYDI AMA GÖRÜNMÜYORDU: tutturulan çift sessizce
   * `opacity-60`'a düşüyordu — oyunun EN İYİ anı en sönük geri bildirimi
   * alıyordu. Artık çift bir kez "pop" yapıyor. Iska ise SARSILIYOR ama
   * hafifçe: burada ıska konumu unutmaktır, harfi bilmemek değil (ses
   * katmanında da aynı ilke: `titre("hafif")`, "hata" değil).
   */
  const [popUid, setPopUid] = useState<string[]>([]);
  const [sarsUid, setSarsUid] = useState<string[]>([]);
  const [first, setFirst] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [moves, setMoves] = useState(0);
  const eslesmeSeri = useRef(0);
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

  /** H-2: aynı oturumda bir sonraki tahta — bir çift daha büyük. */
  const sonrakiTur = () => {
    const t = tur + 1;
    setTur(t);
    setCards(buildBoard(ciftSayisi(t))); setFirst(null); setBusy(false); setMoves(0);
    matchCountRef.current = 0; setShowQuiz(false); acilanSesler.current = new Set();
    eslesmeSeri.current = 0;
  };

  const won = useMemo(() => cards.length > 0 && cards.every((c) => c.matched), [cards]);
  const ciftAdet = cards.length / 2;
  /**
   * ⚠️ REKOR **HAMLE DEĞİL TAHTA SAYISI** — ölçüldü, hamle rekoru bu oyunda
   * ADALETSİZ: `sonrakiTur` her turda tahtayı bir çift büyütüyor (4 → 10) ve
   * daha çok çift zorunlu olarak daha çok hamle demek. Yani 1. turun rekoru
   * (4 çift, ~6 hamle) asla kırılamıyordu; çocuk 9 çiftlik tahtayı kusursuz
   * bitirse bile kart ona "rekorun 6" diyordu — en iyi oynadığı turda
   * başarısız hissettiriliyordu. Tahta sayısı ise boyuttan bağımsız
   * karşılaştırılabilir ve oturum uzunluğunu ölçer. Tek tahtanın KALİTESİ
   * zaten ⭐ ile gösteriliyor, o iş rekorun işi değil.
   */
  const rapor = useOyunSonu("memory", won, tur + 1, { yon: "yuksek", birim: "tahta" });

  const reset = () => {
    setTur(0);
    setCards(buildBoard(ciftSayisi(0))); setFirst(null); setBusy(false); setMoves(0);
    matchCountRef.current = 0; setShowQuiz(false); acilanSesler.current = new Set();
  };

  /** Bu kart harfin SESİNİ mi taşıyor? (süper modda "b" yüzü) */
  const sesKarti = (c: Card) => sesliEslestirme && c.variant === "b";

  /**
   * ⚠️ SES BEKLENİR AMA TAHTAYI KİLİTLEYEMEZ.
   *
   * `await playItem(...)` kaydı yüklenemeyen bir öğede reddedebiliyor ya da
   * hiç çözülmeyebiliyor. Burada bu ölümcüldü: `flip` içinde await'in
   * ardından `setFirst(c)` ve `setBusy(false)` var — ses takılırsa ilk kart
   * hiç kaydedilmiyor, `busy` açık kalıyor ve TAHTA DONUYOR. Aynı tuzağa
   * tanıtım kartında da düşmüştük. Hata yutulur, akış devam eder.
   */
  const sesCal = async (it: ContentItem) => {
    try { await playItem(it); } catch { /* kayıt çalmasa da oyun aksamaz */ }
  };

  const flip = async (c: Card) => {
    if (busy || c.flipped || c.matched) return;
    sfx("kaydir");   // kart çevirme — dokunuşun karşılığı olsun
    const updated = cards.map((x) => x.uid === c.uid ? { ...x, flipped: true } : x);
    setCards(updated);

    if (!first) {
      setBusy(true);
      // Ses↔resim modunda GLİF kartı SESSİZ açılır — sesi çalmak cevabı
      // vermek olurdu. Yalnız 🔊 kartı harfin kaydını çalar.
      if (!sesliEslestirme || sesKarti(c)) await sesCal(c.item);
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
      // Eşleşme serisi: arka arkaya tutturunca ses tizleşir.
      sfx("topla", { seri: eslesmeSeri.current++ });
      titre("basari");
      setCards((cs) => cs.map((x) => x.item.id === c.item.id ? { ...x, matched: true, flipped: true } : x));
      setPopUid([first.uid, c.uid]);
      setTimeout(() => setPopUid([]), 340);
      await sesCal(c.item);
      setFirst(null); setBusy(false);
      if (!isSuper) {
        matchCountRef.current += 1;
        if (matchCountRef.current % 3 === 0) setShowQuiz(true);
      }
    } else {
      eslesmeSeri.current = 0;
      titre("hafif");   // ⚠️ "hata" DEĞİL: hafıza oyununda ıska konumu unutmaktır,
                        // harfi bilmemek değil — sert geri bildirim yanlış ders verir.
      // Yanlış eşleşmede doğru harfin sesi yine de duyulsun (öğretici an);
      // ses↔resim modunda ikinci kart glifse onun kaydını çalıyoruz.
      setSarsUid([first.uid, c.uid]);
      setTimeout(() => setSarsUid([]), 320);
      await sesCal(c.item);
      setCards((cs) => cs.map((x) => (x.uid === first.uid || x.uid === c.uid) ? { ...x, flipped: false } : x));
      setFirst(null); setBusy(false);
    }
  };

  useEffect(() => {
    if (won) { sfx("bitis"); titre("basari"); playFeedback(true); }
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
            <div className="text-3xl mb-1 tracking-widest">
              {"⭐".repeat(yildiz(moves, ciftAdet))}
              <span className="opacity-25">{"⭐".repeat(3 - yildiz(moves, ciftAdet))}</span>
            </div>
            <p className="text-lg font-extrabold">Hepsini buldun!</p>
            <p className="text-sm font-bold text-muted-foreground">
              {moves} hamle · {tur + 1}. tahta
              {rapor?.rekor && <span className="ml-1 text-warning">· 🏆 rekor!</span>}
              {!rapor?.rekor && rapor?.oncekiEnIyi != null && (
                <span className="ml-1">· rekorun {rapor.oncekiEnIyi} tahta</span>
              )}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button onClick={sonrakiTur} className="rounded-full bg-primary px-5 py-3 font-extrabold text-primary-foreground shadow-card active:scale-95">
                ▶️ Bir tahta daha ({ciftSayisi(tur + 1)} çift)
              </button>
              <button onClick={reset} className="rounded-full border-2 border-border bg-muted/40 px-5 py-2 text-sm font-extrabold text-muted-foreground active:scale-95">
                Baştan başla
              </button>
            </div>
          </div>
        )}

        {/* ⚠️ SERBEST OYUN'da havuz yalnız GÖRÜLMÜŞ harflerden kurulur; hiç
            ilerleme yoksa `pickCluster` boş dönüyor ve tahta 0 kartla
            açılıyordu — çocuk bomboş bir ekran görüyor, oyun bozuk sanıyor.
            Sebebi söyleyip çıkış yolu gösteriyoruz. */}
        {cards.length < 4 && (
          <div className="rounded-3xl border-4 border-warning/40 bg-card p-6 text-center shadow-card">
            <div className="mb-2 text-5xl">🌱</div>
            <p className="text-base font-extrabold text-foreground">Henüz yeterli harf yok</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Serbest Oyun yalnız <b>daha önce gördüğün</b> harfleri kullanır.
              Önce birkaç harf öğren, sonra buraya dön.
            </p>
            <Link to="/" className="mt-3 inline-block rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground shadow-card">
              Derslere git
            </Link>
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
                popUid.includes(c.uid) && "animate-juice-pop",
                sarsUid.includes(c.uid) && "animate-juice-shake",
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
