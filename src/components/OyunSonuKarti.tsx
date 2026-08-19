import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/juice";
import type { SonucRaporu } from "@/lib/oyunSonucu";

/**
 * OTURUM SONU KARTI — her oyunun aynı biçimde kapanması için.
 *
 * ⚠️ TEKRAR DÜĞMESİ BİRİNCİ VE BÜYÜK. Sonsuz koşu türünde tekrar oynama oranı
 * doğrudan yeniden başlamanın sürtünmesine bağlı — "onuncu ölümde cazip"
 * olmasının yarısı, yeniden başlamanın bedava olmasıdır.
 *
 * ⚠️ "REKORA 3 KALDI" CÜMLESİ KASITLI: oturumu ÇÖZÜLMEMİŞ bir hedefle bitirmek
 * geri dönüşü besliyor; bitişe yaklaşırken çaba artıyor (hedef gradyanı).
 *
 * ⚠️ İLK OYUNDA REKOR YAZISI YOK — kıyaslanacak bir şey yokken "rekor kırdın"
 * demek sonraki gerçek rekoru değersizleştirir (bkz. oyunSonucu.ts).
 */
export function OyunSonuKarti({
  baslik = "Oyun bitti",
  skor,
  birim = "puan",
  rapor,
  onTekrar,
  onCik,
  ek,
}: {
  baslik?: string;
  skor: number;
  birim?: string;
  rapor: SonucRaporu | null;
  onTekrar: () => void;
  /** Verilmezse oyun listesine döner. */
  onCik?: () => void;
  /** Oyuna özel ek satır (ör. "12 harf bildin"). */
  ek?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const cik = onCik ?? (() => navigate("/oyunlar"));
  const caldi = useRef(false);
  useEffect(() => {
    if (caldi.current) return;
    caldi.current = true;
    sfx(rapor?.rekor ? "seri" : "bitis");
  }, [rapor?.rekor]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-3xl border-4 border-primary/40 bg-card p-6 text-center shadow-elegant animate-bounce-in">
        {rapor?.rekor && (
          <div className="mb-2 inline-block rounded-full bg-warning/20 px-3 py-1 text-xs font-extrabold text-warning">
            🏆 YENİ REKOR
          </div>
        )}
        <div className="text-sm font-bold text-muted-foreground">{baslik}</div>

        <div className="mt-1 text-5xl font-extrabold leading-none text-foreground tabular-nums">
          {skor}
        </div>
        <div className="text-xs font-bold text-muted-foreground">{birim}</div>

        {ek && <div className="mt-2 text-sm font-bold text-foreground">{ek}</div>}

        {rapor?.oncekiEnIyi !== null && rapor?.oncekiEnIyi !== undefined && (
          <div className="mt-3 text-sm font-bold text-muted-foreground">
            {rapor.rekor
              ? <>eskisi <b className="text-foreground">{rapor.oncekiEnIyi}</b></>
              : <>rekorun <b className="text-foreground">{rapor.oncekiEnIyi}</b></>}
          </div>
        )}

        {rapor?.kalan != null && (
          <div className="mt-1 text-sm font-extrabold text-primary">
            {rapor.kalan} kaldı!
          </div>
        )}

        <button
          onClick={onTekrar}
          className={cn(
            "mt-5 w-full rounded-2xl bg-primary px-4 py-4 text-lg font-extrabold text-primary-foreground",
            "shadow-card transition-bouncy active:scale-95",
          )}
        >
          🔄 Tekrar
        </button>
        <button
          onClick={cik}
          className="mt-2 w-full rounded-2xl border-2 border-border bg-muted/40 px-4 py-2.5 text-sm font-extrabold text-muted-foreground transition-bouncy active:scale-95"
        >
          Oyunlara dön
        </button>
      </div>
    </div>
  );
}
