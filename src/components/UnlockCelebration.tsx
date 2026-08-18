import { useEffect, useRef, useState } from "react";
import { Buddy } from "@/components/Buddy";

// Yeni bölüm/başarı kutlaması — kısa, coşkulu, kendiliğinden kaybolur.
// Öğrenme bilimi: anlık, belirgin ödül sinyali yetkinlik algısını güçlendirir
// (öz-belirleme kuramı) ve bir sonraki hedefe geçiş motivasyonu verir.
// 2.6 sn sonra kendini kapatır — akışı bölmez.
//
// ⚠️ DOKUNARAK KAPATILABİLİR OLMALI (kullanıcı şikâyeti: "bildirimi
// kapatamıyorum, 2-3 saniye ekranda duruyor"). Eskiden en dıştaki katmanda
// `pointer-events-none` vardı: dokunuş ARKAYA geçiyordu, yani kutlamanın
// kendisi tıklanamıyordu — kapatmanın hiçbir yolu yoktu, beklemek şarttı.
// Şimdi ekranın herhangi bir yerine dokunmak kapatır; konfeti hâlâ
// `pointer-events-none` (dokunuşu yutmasın diye değil, üstteki katman zaten
// yakalıyor — süslemeye tıklanabilirlik anlamı yüklemeyelim).
//
// ⚠️ KISA BİR KORUMA PAYI VAR (`ACILIS_KILIDI`): kutlama, çocuğun son
// cevabını verdiği dokunuşun hemen ardından açılıyor. O dokunuşun bırakma
// (pointerup/click) olayı kutlama açıldıktan SONRA geliyor ve kutlamayı
// daha görünmeden kapatıyordu. 350 ms boyunca kapatma dinlenmez.
const ACILIS_KILIDI = 350;
const SURE = 2600;

export function UnlockCelebration({ title, subtitle, onDone }: {
  title: string;
  subtitle?: string;
  onDone: () => void;
}) {
  const [kapatilabilir, setKapatilabilir] = useState(false);
  // onDone'ın kimliği her render'da değişebiliyor (satır içi ok fonksiyonu);
  // ref'te tutulmazsa zamanlayıcı her render'da sıfırlanır.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const kilit = setTimeout(() => setKapatilabilir(true), ACILIS_KILIDI);
    const t = setTimeout(() => doneRef.current(), SURE);
    return () => { clearTimeout(kilit); clearTimeout(t); };
  }, []);

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
            Minik bir × telefonda ıskalanıyor. */}
        <button
          onClick={kapat}
          aria-label="Kapat"
          className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full bg-card border-2 border-warning text-xl font-extrabold text-muted-foreground shadow-card active:scale-95"
        >×</button>
        <div className="mb-1 flex justify-center">
          <Buddy pose="celebrate" size={84} bob={false} />
        </div>
        <div className="text-xl font-extrabold text-foreground">{title}</div>
        {subtitle && <div className="text-sm font-bold text-warning mt-1">{subtitle}</div>}
        <div className="mt-2 text-[11px] font-bold text-muted-foreground">Kapatmak için dokun</div>
      </div>
    </div>
  );
}
