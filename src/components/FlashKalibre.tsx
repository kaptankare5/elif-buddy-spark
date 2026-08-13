// ŞİMŞEK EŞİĞİ KALİBRASYONU — "bu çocuk için kaç saniye?"
//
// ⚠️ NEDEN GEREKLİ: şimşek süresini şimdiye kadar TAHMİNLE seçiyorduk.
// Literatür net bir tek sayı vermiyor, çünkü iki ayrı darboğaz var
// (kodlama ~150 ms, bakış kaydırma 8 yaşında ~411 ms) ve ikisi de çocuktan
// çocuğa değişiyor. Doğru cevap ölçmekle bulunur.
//
// ⚠️ BİLGİYİ DEĞİL ALGIYI ÖLÇER. Sorular yalnız çocuğun ZATEN BİLDİĞİ
// harflerden (L3+) seçilir. Bilmediği harfle ölçüm yapılsaydı "kısa sürede
// bilemedi" sonucu çıkardı — oysa o harfi uzun sürede de bilemezdi.
//
// ⚠️ SRS'E HİÇBİR ŞEY YAZMAZ. Bu bir ölçüm aracı; yanlış cevaplar çocuğun
// ilerlemesini düşürmemeli (Ölçüm Modu'yla aynı ilke).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { flattenItems } from "@/data/subjects";
import { getGameItemLevel } from "@/lib/gameProgress";
import { getUnlockedItemIdSet } from "@/lib/unlock";
import { okunurAd, pickNameWrongs, sameName, FLASH_CUE_MS, FLASH_PRESETS, setFlashMs } from "@/lib/askMode";
import { glifKaydirmaEm } from "@/lib/glifOlcu";
import { playFeedback } from "@/lib/audio";
import type { ContentItem } from "@/data/types";

/** Denenen süreler (ms) — en kısadan uzuna. */
const SURELER = [300, 500, 800] as const;
/** Her süre için kaç soru. 4 × 3 = 12 soru ≈ 2 dakika. */
const SORU = 4;
/** Bir sürenin "yeterli" sayılması için gereken doğruluk. */
const ESIK = 0.75;
/** Ölçüm için gereken en az bilinen harf. */
const MIN_HARF = 6;

interface Soru { hedef: ContentItem; sik: ContentItem[]; ms: number; }

function bilinenHavuz(): ContentItem[] {
  const acik = getUnlockedItemIdSet();
  return flattenItems().filter(
    (it) => it.emoji && it.audio && okunurAd(it) && acik.has(it.id) && getGameItemLevel(it) >= 3,
  );
}

function sorulariKur(havuz: ContentItem[]): Soru[] {
  const out: Soru[] = [];
  for (const ms of SURELER) {
    for (let i = 0; i < SORU; i++) {
      const hedef = havuz[Math.floor(Math.random() * havuz.length)];
      const yanlis = pickNameWrongs(havuz, hedef, 1)[0];
      if (!yanlis || sameName(yanlis, hedef)) continue;
      out.push({ hedef, sik: Math.random() < 0.5 ? [hedef, yanlis] : [yanlis, hedef], ms });
    }
  }
  // Süreler KARIŞIK sorulur: hepsi sırayla gelirse çocuk son bloklarda
  // yorulur ve fark "süre farkı" değil "yorgunluk farkı" olur.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function FlashKalibre({ onClose }: { onClose: () => void }) {
  const havuz = useMemo(bilinenHavuz, []);
  const yeterli = havuz.length >= MIN_HARF;
  const [sorular] = useState<Soru[]>(() => (yeterli ? sorulariKur(havuz) : []));
  const [idx, setIdx] = useState(0);
  const [asama, setAsama] = useState<"bekle" | "cue" | "glif" | "sik" | "bitti">("bekle");
  const [sonuc, setSonuc] = useState<Array<{ ms: number; dogru: boolean }>>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const soru = sorular[idx];

  const basla = useCallback(() => {
    if (!soru) return;
    setAsama("cue");
    timers.current.push(window.setTimeout(() => {
      setAsama("glif");
      timers.current.push(window.setTimeout(() => setAsama("sik"), soru.ms));
    }, FLASH_CUE_MS));
  }, [soru]);

  const sec = (it: ContentItem) => {
    if (asama !== "sik" || !soru) return;
    const dogru = it.id === soru.hedef.id;
    void playFeedback(dogru);
    setSonuc((s) => [...s, { ms: soru.ms, dogru }]);
    if (idx + 1 >= sorular.length) setAsama("bitti");
    else { setIdx((i) => i + 1); setAsama("bekle"); }
  };

  // Süre başına doğruluk + öneri
  const ozet = SURELER.map((ms) => {
    const k = sonuc.filter((x) => x.ms === ms);
    const d = k.filter((x) => x.dogru).length;
    return { ms, toplam: k.length, dogru: d, oran: k.length ? d / k.length : 0 };
  });
  // Öneri: EŞİĞİ GEÇEN EN KISA süre. Hiçbiri geçmiyorsa en uzun süre —
  // ve "daha da uzatmak gerekebilir" uyarısı.
  const gecen = ozet.filter((o) => o.toplam > 0 && o.oran >= ESIK);
  const oneri = gecen.length ? Math.min(...gecen.map((o) => o.ms)) : SURELER[SURELER.length - 1];
  const hicbiriGecmedi = sonuc.length > 0 && gecen.length === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-foreground">⚡ Şimşek süresi ölçümü</h3>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1 text-sm font-bold">Kapat</button>
        </div>

        {!yeterli ? (
          <p className="text-sm text-muted-foreground leading-snug">
            Ölçüm için çocuğun <b>zaten bildiği</b> en az {MIN_HARF} harf gerekiyor
            (⭐⭐⭐ ve üstü). Bilinmeyen harfle ölçüm yapılırsa &quot;kısa sürede
            bilemedi&quot; çıkar — oysa o harfi uzun sürede de bilemezdi.
            Biraz daha çalıştıktan sonra tekrar deneyin.
          </p>
        ) : asama === "bitti" ? (
          <div>
            <p className="mb-2 text-sm font-bold text-foreground">Sonuç</p>
            <div className="space-y-1.5">
              {ozet.map((o) => (
                <div key={o.ms} className={cn(
                  "flex items-center justify-between rounded-xl border-2 px-3 py-2",
                  o.oran >= ESIK ? "border-success/50 bg-success/10" : "border-destructive/40 bg-destructive/10",
                )}>
                  <span className="text-sm font-extrabold">{(o.ms / 1000).toFixed(1)} sn</span>
                  <span className="text-sm font-bold text-muted-foreground">
                    {o.dogru}/{o.toplam} · %{Math.round(o.oran * 100)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-snug">
              {hicbiriGecmedi ? (
                <>Hiçbir süre %{Math.round(ESIK * 100)} doğruluğu geçmedi. Bu çocuk için
                şimşek modu <b>henüz erken</b> olabilir — Tabela modunu deneyin.</>
              ) : (
                <>Eşiği geçen <b>en kısa</b> süre öneriliyor. Daha kısası harfi
                görmesine yetmiyor, daha uzunu gereksiz yere oyunu kapatıyor.</>
              )}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setFlashMs(oneri); onClose(); }}
                className="flex-1 rounded-full bg-primary px-4 py-2.5 font-extrabold text-primary-foreground shadow-card"
              >
                {(oneri / 1000).toFixed(1)} sn olarak ayarla
              </button>
              <button onClick={onClose} className="rounded-full bg-muted px-4 py-2.5 font-bold">Vazgeç</button>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-xs font-bold text-muted-foreground">
              Soru {idx + 1} / {sorular.length}
            </p>
            <div className="relative flex h-44 items-center justify-center rounded-2xl bg-muted/40">
              {asama === "bekle" && (
                <button onClick={basla} className="rounded-full bg-primary px-6 py-3 font-extrabold text-primary-foreground shadow-card">
                  Hazırım — göster
                </button>
              )}
              {asama === "cue" && <div className="h-10 w-10 animate-ping rounded-full border-4 border-primary/80" />}
              {asama === "glif" && soru && (
                <div className="rounded-[2rem] border-2 border-foreground/75 bg-white/90 px-7 py-1.5 shadow-card">
                  <div
                    className="block font-arabic text-emerald-950"
                    style={{
                      fontSize: "4rem", lineHeight: 1.7,
                      transform: `translateY(${glifKaydirmaEm(soru.hedef.emoji ?? "").toFixed(4)}em)`,
                    }}
                    dir="rtl"
                  >
                    {soru.hedef.emoji}
                  </div>
                </div>
              )}
              {asama === "sik" && <p className="text-sm font-bold text-muted-foreground">Hangisiydi?</p>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {soru?.sik.map((o) => (
                <button
                  key={o.id}
                  onClick={() => sec(o)}
                  disabled={asama !== "sik"}
                  className="rounded-2xl border-4 border-primary/20 bg-card px-2 py-4 text-lg font-extrabold shadow-card disabled:opacity-40"
                >
                  {okunurAd(o)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
              Sorular çocuğun <b>zaten bildiği</b> harflerden seçilir ve
              ilerlemeye <b>yazılmaz</b> — burada bilgi değil, <b>görme süresi</b> ölçülüyor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
