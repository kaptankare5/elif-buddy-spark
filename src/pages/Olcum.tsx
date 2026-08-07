// Ölçüm Modu — çocuğun harfleri GERÇEKTEN bilip bilmediğini ölçen akış.
// İki konuda çalışır: harf ADLARI (Elifbâ kitabının sorduğu yön) ve harf
// HALLERİ (başta/ortada/sonda). AMAÇ ÖĞRENME DEĞİL, ÖLÇÜM:
// - Harfler curriculum sırasında (Elif→Ye × başta→ortada→sonda) sunulur.
// - Çocuk sesli okur, veli "Bildi / Bilmedi" düğmesine basar.
// - "Bilmedi" işaretlenirse harf kuyruğun sonuna eklenip tekrar sorulur.
// - "Hâlâ bilmiyor" ile veli o harfi geçebilir (gaveUp).
// - Sonuçta: kaç harfi 1./2./3./4+. denemede bildi ve kaçını hâlâ bilmiyor.
// SRS (öğrenme seviyeleri) HİÇ ETKİLENMEZ.
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RouteHead } from "@/components/RouteHead";
import { getTopic } from "@/data/subjects";
import { buildReport, loadMeasure, recordMeasure, resetMeasure, useMeasure } from "@/lib/measurement";
import { buildTransferReport, transferSummaryText } from "@/lib/transfer";
import { playItem, playFeedback } from "@/lib/audio";
import { Volume2, Check, X, HelpCircle, RotateCcw, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/data/types";

const ARABIC_FONT = "font-arabic-naskh";

function itemLabel(id: string, items: ContentItem[]) {
  return items.find((x) => x.id === id)?.translit ?? id;
}

// Hangi konuda ölçüm yapılıyor? "harfler" = harfi gör, ADINI söyle (Elifbâ
// kitabının ve Kur'an okumanın istediği yön — asıl hedef beceri).
// "yazilislar" = başta/ortada/sonda halleri.
const KONULAR = [
  { id: "harfler", ad: "Harf adları", ipucu: "Harfi gör → adını söyle" },
  { id: "yazilislar", ad: "Yazılışlar", ipucu: "Başta / ortada / sonda" },
] as const;
type KonuId = typeof KONULAR[number]["id"];

export default function Olcum() {
  const [konuId, setKonuId] = useState<KonuId>("harfler");
  const topic = getTopic("elifba", konuId);
  const allItems: ContentItem[] = useMemo(() => (topic?.items ?? []).filter((i) => i.emoji), [topic]);
  const allIds = useMemo(() => allItems.map((i) => i.id), [allItems]);
  const measure = useMeasure();

  // Kuyruk: mevcut store'a göre kalan (henüz doğru/geçilmemiş) öğeler.
  // RASTGELE karıştırılır — çocuk sırayı ezberleyip "bir sonraki Elif"
  // demesin. Tekrar sorulmama garantisi kuyruk mantığından gelir: doğru
  // yapılan öğe kuyruktan çıkar; yanlış yapılan öğe kuyruğun SONUNA gider,
  // yani kalan tüm harfler sorulmadan tekrar karşımıza çıkmaz.
  const buildQueue = () => {
    const s = loadMeasure();
    const remaining = allItems.filter((it) => !s[it.id]?.done).map((it) => it.id);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    return remaining;
  };
  const [queue, setQueue] = useState<string[]>(() => buildQueue());
  const [showReport, setShowReport] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const lastResetKey = useRef(0);

  useEffect(() => {
    // Reset olduğunda VE konu değişince kuyruğu yeniden kur.
    // ⚠️ Bağımlılıkta konuId şart: iki konunun öğe sayısı eşit olsaydı
    // (allItems.length değişmeseydi) kuyruk eski konuda kalırdı.
    setQueue(buildQueue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResetKey.current, konuId, allItems.length]);

  const currentId = queue[0];
  const current = allItems.find((i) => i.id === currentId);

  const total = allIds.length;
  const remaining = queue.length;
  const answered = total - remaining;
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);

  const handle = async (kind: "correct" | "wrong" | "giveup") => {
    if (!current) return;
    if (kind === "correct") {
      recordMeasure(current.id, true);
      playFeedback(true);
      setQueue((q) => q.slice(1));
    } else if (kind === "giveup") {
      recordMeasure(current.id, false, true);
      setQueue((q) => q.slice(1));
    } else {
      recordMeasure(current.id, false);
      playFeedback(false);
      // Kuyruğun sonuna ekle — tekrar sorulacak
      setQueue((q) => [...q.slice(1), q[0]]);
    }
  };

  const doReset = () => {
    resetMeasure();
    lastResetKey.current += 1;
    setQueue(allItems.map((i) => i.id));
    setShowReport(false);
  };

  const report = useMemo(() => buildReport(allIds), [allIds, measure]);
  // AKTARIM: uygulamanın verdiği seviye ile çocuğun GERÇEK cevabı yan yana.
  // `measure` bilerek bağımlılıkta: buildTransferReport localStorage'ı kendisi
  // okuyor, ama cevap verildikçe yeniden hesaplanması bu abonelikten geliyor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const aktarim = useMemo(() => buildTransferReport(allIds), [allIds, measure]);
  const finished = remaining === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-info/10 to-background">
      <RouteHead
        title="Ölçüm Modu — ElifMim"
        description="Çocuğun harflerin başta/ortada/sonda hallerini ne kadar önceden bildiğini ölç."
        path="/olcum"
        noindex
      />
      <main className="container mx-auto max-w-xl px-4 pb-24">
        <PageHeader title="📏 Ölçüm Modu" backTo="/ayarlar" centered onReset={doReset} />

        {/* Amaç kartı */}
        <div className="mb-4 rounded-2xl bg-card/90 p-4 shadow-card border-2 border-info/30">
          <div className="flex items-start gap-3">
            <Ruler className="h-6 w-6 shrink-0 text-info mt-0.5" />
            <div className="text-[13px] leading-snug text-foreground">
              <b>Ölçüm:</b> Çocuğun harflerin <b>başta / ortada / sonda</b> hallerini hangilerini <u>hiç öğrenmeden</u> bildiğini öğreniriz.
              Amaç <b>öğretmek değil ölçmek</b>tir — bu ekrandaki cevaplar öğrenme seviyesini <b>etkilemez</b>.
              Harfi çocuk sesli okusun; siz “Bildi / Bilmedi” işaretleyin.
            </div>
          </div>
        </div>

        {/* Konu seçici — hangi beceriyi ölçüyoruz? */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {KONULAR.map((k) => (
            <button
              key={k.id}
              onClick={() => { setKonuId(k.id); setShowReport(false); }}
              className={cn(
                "rounded-2xl border-2 p-2 text-center shadow-soft transition-bouncy",
                konuId === k.id
                  ? "border-info bg-info/10"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <div className="text-xs font-extrabold text-foreground">{k.ad}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{k.ipucu}</div>
            </button>
          ))}
        </div>

        {/* İlerleme çubuğu */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1 text-[11px] font-extrabold text-muted-foreground">
            <span>İlerleme</span>
            <span>{answered}/{total} · %{pct}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-info transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {!finished && current ? (
          <>
            <div className="rounded-3xl bg-card p-6 shadow-card border-4 border-info/30 flex flex-col items-center gap-4">
              <div className="text-[11px] font-extrabold uppercase text-muted-foreground">
                Sıradaki harf
              </div>
              {/* Sabit yükseklikli kutu: harfin altındaki "Doğru okunuş" düğmesiyle
                  arası HER zaman aynı kalsın — derin çanaklı/kuyruklu harfler
                  (ayın sonda ﻊ gibi) glife göre değişen leading yüzünden
                  düğmeye çok yaklaşmasın diye glif değil, kutu boyutlandırır. */}
              <div className="flex h-44 w-full items-center justify-center overflow-visible">
                <div
                  className={cn(ARABIC_FONT, "text-[9rem] leading-[1.5] text-foreground select-none")}
                  dir="rtl"
                >
                  {current.emoji}
                </div>
              </div>
              {/* Not: Harfin Türkçe adı gösterilmez — çocuk cevabı görmeden okumalı.
                  Veli, "Doğru okunuş" düğmesiyle kontrol edebilir. */}
              <button
                onClick={() => playItem(current)}
                className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-extrabold shadow-soft active:scale-95"
                aria-label="Doğru okunuşu dinle"
              >
                <Volume2 className="h-4 w-4" /> Doğru okunuş (veli için)
              </button>
              <div className="text-[11px] text-muted-foreground text-center">
                Çocuk sesli okusun; siz duyduğunuza göre işaretleyin.
              </div>
            </div>

            {/* Cevap düğmeleri */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => handle("wrong")}
                className="rounded-2xl bg-warning text-warning-foreground font-extrabold py-4 shadow-soft active:scale-95 flex items-center justify-center gap-2"
              >
                <X className="h-5 w-5" /> Bilmedi
              </button>
              <button
                onClick={() => handle("correct")}
                className="rounded-2xl bg-success text-success-foreground font-extrabold py-4 shadow-soft active:scale-95 flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5" /> Bildi
              </button>
            </div>
            <button
              onClick={() => handle("giveup")}
              className="mt-2 w-full rounded-2xl bg-muted text-muted-foreground font-extrabold py-3 active:scale-95 flex items-center justify-center gap-2 border-2 border-border"
            >
              <HelpCircle className="h-4 w-4" /> Hâlâ bilmiyor — geç
            </button>

            <div className="mt-3 text-center text-[11px] text-muted-foreground">
              “Bilmedi” dediğin harf sıranın sonunda tekrar karşına çıkar.
            </div>

            <button
              onClick={() => setShowReport((v) => !v)}
              className="mt-4 w-full rounded-xl bg-card border-2 border-border py-2 text-xs font-extrabold text-foreground"
            >
              {showReport ? "Raporu gizle" : "Şimdiye kadarki raporu göster"}
            </button>
          </>
        ) : (
          <div className="rounded-3xl bg-success/10 p-6 shadow-card border-4 border-success/40 text-center">
            <div className="text-4xl mb-2">🎯</div>
            <div className="text-lg font-extrabold text-foreground">Ölçüm tamamlandı</div>
            <div className="text-xs text-muted-foreground mt-1">Sonuçlar aşağıda.</div>
          </div>
        )}

        {(showReport || finished) && (
          <div className="mt-5 rounded-2xl bg-card p-4 shadow-card border-2 border-border">
            <div className="text-sm font-extrabold text-foreground mb-3 flex items-center gap-2">
              📊 Rapor <span className="text-xs text-muted-foreground">({report.total} öğe)</span>
            </div>

            {/* AKTARIM — asıl merak edilen sayı: uygulama "biliyor" dediklerinin
                kaçını çocuk GERÇEKTEN bildi? */}
            {aktarim.bands.length > 0 && (
              <div className="mb-4 rounded-xl border-2 border-gold/50 bg-gold/5 p-3">
                <div className="text-xs font-extrabold text-foreground mb-2">
                  🔁 Aktarım — uygulama ne diyor, çocuk ne yaptı?
                </div>
                <div className="space-y-1">
                  {aktarim.bands.map((b) => {
                    const oran = b.olculen ? Math.round((100 * b.bilen) / b.olculen) : 0;
                    return (
                      <div key={b.level} className="flex items-center gap-2 text-[11px]">
                        <span className="w-20 shrink-0 font-extrabold text-foreground">
                          {b.level === 0 ? "Görülmemiş" : `${"⭐".repeat(b.level)}`}
                        </span>
                        <div className="h-2.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-success" style={{ width: `${oran}%` }} />
                        </div>
                        <span className="w-20 shrink-0 text-right font-bold text-muted-foreground">
                          {b.bilen}/{b.olculen} · %{oran}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {aktarim.l4Aktarim.olculen > 0 && (
                  <div className="mt-2 rounded-lg bg-card border-2 border-border p-2 text-center">
                    <div className="text-[10px] font-bold text-muted-foreground">
                      ⭐⭐⭐⭐ ve üstü harflerde AKTARIM ORANI
                    </div>
                    <div className="text-xl font-extrabold text-foreground">
                      %{Math.round((aktarim.l4Aktarim.oran ?? 0) * 100)}
                      <span className="text-xs font-bold text-muted-foreground">
                        {" "}({aktarim.l4Aktarim.bilen}/{aktarim.l4Aktarim.olculen})
                      </span>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    const t = transferSummaryText(aktarim, `Aktarım — ${KONULAR.find((k) => k.id === konuId)?.ad}`);
                    navigator.clipboard?.writeText(t).catch(() => { /* ignore */ });
                    setKopyalandi(true);
                    setTimeout(() => setKopyalandi(false), 1800);
                  }}
                  className="mt-2 w-full rounded-lg bg-card border-2 border-border py-2 text-[11px] font-extrabold text-foreground"
                >
                  {kopyalandi ? "✓ Kopyalandı" : "📋 Raporu kopyala (paylaşmak için)"}
                </button>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                  Sadece <b>ilk denemede</b> bilinenler sayılır — ikinci turda bilmek
                  &quot;biliyordu&quot; değil, arada hatırladı demektir.
                </p>
              </div>
            )}
            <ReportRow color="bg-success" label="1. deneme — hemen bildi" ids={report.first1} items={allItems} highlight />
            <ReportRow color="bg-info" label="2. deneme — bildi" ids={report.first2} items={allItems} highlight />
            <ReportRow color="bg-warning" label="3. deneme — bildi" ids={report.first3} items={allItems} />
            <ReportRow color="bg-topic-pink" label="4+. deneme — bildi" ids={report.first4plus} items={allItems} />
            <ReportRow color="bg-destructive" label="Hâlâ bilmiyor" ids={report.unknown} items={allItems} />
            <ReportRow color="bg-muted-foreground/60" label="Henüz sorulmadı" ids={report.untested} items={allItems} />

            <button
              onClick={doReset}
              className="mt-3 w-full rounded-xl bg-muted text-foreground font-extrabold py-2 text-xs border-2 border-border flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Ölçümü sıfırla
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function ReportRow({
  color, label, ids, items, highlight,
}: { color: string; label: string; ids: string[]; items: ContentItem[]; highlight?: boolean }) {
  return (
    <div className={cn("mb-2 rounded-xl border-2 p-2", highlight ? "border-success/30 bg-success/5" : "border-border")}>
      <div className="flex items-center gap-3">
        <span className={cn("h-3 w-3 rounded-full shrink-0", color)} />
        <span className="flex-1 text-xs font-extrabold text-foreground">{label}</span>
        <span className="text-sm font-extrabold text-foreground">{ids.length}</span>
      </div>
      {ids.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ids.map((id) => {
            const it = items.find((x) => x.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-2 py-1 text-[11px] font-bold">
                <span className={cn(ARABIC_FONT, "text-lg leading-none")} dir="rtl">{it?.emoji}</span>
                <span className="text-foreground">{it?.translit ?? id}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
