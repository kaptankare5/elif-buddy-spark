import { useEffect, useRef, useState } from "react";
import { Buddy } from "@/components/Buddy";
import { sfx } from "@/lib/juice";

// Yeni bölüm/başarı kutlaması — kısa, coşkulu, kendiliğinden kaybolur.
// Öğrenme bilimi: anlık, belirgin ödül sinyali yetkinlik algısını güçlendirir
// (öz-belirleme kuramı) ve bir sonraki hedefe geçiş motivasyonu verir.
//
// ⚠️ DOKUNARAK KAPATILABİLİR OLMALI (kullanıcı şikâyeti: "bildirimi
// kapatamıyorum, 2-3 saniye ekranda duruyor"). Eskiden en dıştaki katmanda
// `pointer-events-none` vardı: dokunuş ARKAYA geçiyordu, yani kutlamanın
// kendisi tıklanamıyordu — kapatmanın hiçbir yolu yoktu, beklemek şarttı.
// Şimdi ekranın herhangi bir yerine dokunmak kapatır; konfeti hâlâ
// `pointer-events-none` (dokunuşu yutmasın diye değil, üstteki katman zaten
// yakalıyor — süslemeye tıklanabilirlik anlamı yüklemeyelim).
//
// ⚠️ ÜÇ ÇIKIŞ YOLU BİRDEN (kullanıcı şartı: "1 2 saniye sonra otomatik
// kapansın veya kapatma tuşu olsun. ya da ikisi de"): kendiliğinden kapanma
// + kapatma düğmesi + ekrana dokunma. Hiçbiri ötekini beklemez.
//
// ⚠️ KISA BİR KORUMA PAYI VAR (`ACILIS_KILIDI`): kutlama, çocuğun son
// cevabını verdiği dokunuşun hemen ardından açılıyor. O dokunuşun bırakma
// (pointerup/click) olayı kutlama açıldıktan SONRA geliyor ve kutlamayı
// daha görünmeden kapatıyordu. 350 ms boyunca kapatma dinlenmez.
const ACILIS_KILIDI = 350;
const SURE = 2200;

/**
 * ⚠️ GERİ SAYIM GÖRÜNÜR OLMALI. Kutlama kendiliğinden kapanıyor ama çocuk
 * bunu bilmiyordu: ekranda duran kutu "bir şey yapmam mı lazım?" diye
 * bekletiyordu. Kapatma düğmesinin çevresindeki halka kalan süreyi çizer —
 * okuma gerektirmez (aynı gerekçe Koşusu'nun güç barında da kullanıldı:
 * 5-8 yaşta rakam okumak ayrı bir iş).
 */
/** Kutlama çanı bittikten sonra kilit sesi (ms) — üst üste binmesinler. */
const KILIT_GECIKME = 650;

const HALKA_R = 20;
const HALKA_CEVRE = 2 * Math.PI * HALKA_R;

export function UnlockCelebration({ title, subtitle, onDone, sound = "kutlama", sure = SURE, action, kilitSesi }: {
  title: string;
  subtitle?: string;
  onDone: () => void;
  /** Açılışta çalacak ses. `false` = sessiz (arka arkaya iki kutlamada ikincisi). */
  sound?: "kutlama" | "kilit" | false;
  /**
   * ⚠️ KİLİT SESİ KUTLAMANIN ÜSTÜNE, GECİKMELİ BİNER. "Bölümü bitirdin" ile
   * "yeni bölüm açıldı" İKİ ayrı haber; ikisi için iki ayrı kutlama açmak
   * 4+ saniye sürerdi ("geçmek zorda olmasın" şartına aykırı). Tek kutlama,
   * iki ses: önce çan, sonra mandal. Sesler kasten farklı ailelerden
   * (kutlama melodik, kilit mekanik) — üst üste binseler bile ayırt edilir.
   */
  kilitSesi?: boolean;
  /** Kendiliğinden kapanma süresi (ms). `action` varsa YOK SAYILIR. */
  sure?: number;
  /**
   * ⚠️ SORU SORAN KUTLAMA KENDİLİĞİNDEN KAPANMAZ. "Sonraki konuya geçmek
   * ister misin?" bir bildirim değil TEKLİFtir; 2 saniyede kaybolursa çocuk
   * teklifi hiç görmemiş olur. Eylem varsa geri sayım da çizilmez.
   */
  action?: { label: string; onClick: () => void };
}) {
  const [kapatilabilir, setKapatilabilir] = useState(false);
  const [kalan, setKalan] = useState(1);
  // onDone'ın kimliği her render'da değişebiliyor (satır içi ok fonksiyonu);
  // ref'te tutulmazsa zamanlayıcı her render'da sıfırlanır.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const otomatik = !action;

  useEffect(() => {
    if (sound) sfx(sound);
    const kilitSes = kilitSesi ? setTimeout(() => sfx("kilit"), KILIT_GECIKME) : undefined;
    const kilit = setTimeout(() => setKapatilabilir(true), ACILIS_KILIDI);
    if (!otomatik) return () => { clearTimeout(kilit); if (kilitSes) clearTimeout(kilitSes); };
    const t = setTimeout(() => doneRef.current(), sure);
    // Halka HER KAREDE değil 60 ms'de bir güncellenir — 2 saniyelik bir
    // halka için göz farkı görmüyor, boşuna render yapmayalım.
    const bas = Date.now();
    const iv = setInterval(() => {
      setKalan(Math.max(0, 1 - (Date.now() - bas) / sure));
    }, 60);
    return () => {
      clearTimeout(kilit); clearTimeout(t); clearInterval(iv);
      if (kilitSes) clearTimeout(kilitSes);
    };
  }, [sound, sure, otomatik, kilitSesi]);

  const kapat = () => { if (kapatilabilir) doneRef.current(); };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onPointerDown={kapat}
      role="button"
      tabIndex={0}
      aria-label="Kutlamayı kapat"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") kapat(); }}
    >
      {/* Konfeti yağmuru */}
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={i}
          className="absolute animate-confetti pointer-events-none"
          style={{
            left: `${(i * 37) % 100}%`,
            top: "-8%",
            animationDelay: `${(i % 9) * 0.13}s`,
            animationDuration: `${1.8 + (i % 5) * 0.25}s`,
            fontSize: `${16 + (i % 3) * 10}px`,
          }}
        >
          {["🎉", "⭐", "✨", "🎈"][i % 4]}
        </span>
      ))}
      <div className="relative rounded-3xl bg-card border-4 border-warning px-8 py-6 text-center shadow-elegant animate-bounce-in">
        {/* Kapatma düğmesi — çocuk parmağına göre 44px (Apple/Google asgarisi).
            Minik bir × telefonda ıskalanıyor. Çevresindeki halka kalan
            süreyi gösterir: kutlamanın kaybolacağını çocuk ÖNCEDEN görür. */}
        <button
          onClick={kapat}
          aria-label="Kapat"
          className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-card border-2 border-warning text-xl font-extrabold text-muted-foreground shadow-card active:scale-95"
        >
          {otomatik && (
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 44 44" aria-hidden>
              <circle
                cx="22" cy="22" r={HALKA_R} fill="none"
                stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                className="text-warning"
                strokeDasharray={HALKA_CEVRE}
                strokeDashoffset={HALKA_CEVRE * (1 - kalan)}
              />
            </svg>
          )}
          <span className="relative">×</span>
        </button>
        <div className="mb-1 flex justify-center">
          <Buddy pose="celebrate" size={84} bob={false} />
        </div>
        <div className="text-xl font-extrabold text-foreground">{title}</div>
        {subtitle && <div className="text-sm font-bold text-warning mt-1">{subtitle}</div>}
        {action ? (
          <div className="mt-3 flex flex-col items-center gap-2">
            {/* ⚠️ Teklifin kendisi büyük ve tek: çocuk "evet"i arayıp
                bulmasın. "Şimdi değil" küçük ve sade — reddetmek kolay
                olmalı, ama dikkat çekmemeli. */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              className="rounded-full bg-success px-6 py-3 text-base font-extrabold text-success-foreground shadow-card active:scale-95"
            >
              {action.label}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); kapat(); }}
              className="text-xs font-bold text-muted-foreground underline"
            >
              Şimdi değil
            </button>
          </div>
        ) : (
          <div className="mt-2 text-[11px] font-bold text-muted-foreground">Kapatmak için dokun</div>
        )}
      </div>
    </div>
  );
}
