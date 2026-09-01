// 🧠 Yazılış Hafıza Yöntemi — "başta / ortada / sonda" konusunun ezber yükünü
// üç YAPISAL kurala indiren ders sayfası.
//
// Öğrenme bilimi: 84 şekli tek tek ezberlemek çalışma belleğini aşırı yükler
// (Sweller). Oysa Arap yazısı kurallıdır — kuralı öğrenen çocuk şekli TÜRETİR
// (üretici bilgi, ezberden çok daha kalıcı). Karışan harfleri de yan yana
// göstererek ayırt etme öğretiriz (discriminative-contrast; Kornell & Bjork) —
// uygulamadaki çeldirici sistemi (confusables.ts) zaten aynı mantıkta çalışır.
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { RouteHead } from "@/components/RouteHead";
import { BuddyWithBubble } from "@/components/Buddy";
import { TailErase } from "@/components/mnemonics/TailErase";
import { EraseGame } from "@/components/mnemonics/EraseGame";
import { DotCompare } from "@/components/mnemonics/DotCompare";
import { StrokeCompare } from "@/components/mnemonics/StrokeCompare";
import { HarekeMnemo } from "@/components/mnemonics/HarekeMnemo";
import { STABLE_GROUP, TAIL_RULES, DOT_GROUPS, STROKE_PAIRS, HAREKE_MNEMONICS, writingItemIds } from "@/data/writingMnemonics";
import { findItem } from "@/data/subjects";
import { playItem } from "@/lib/audio";
import { markTopicVisited } from "@/lib/placement";
import { Zap } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const YazilisHafiza = () => {
  // Konu sayfasından "kuyruk-silme" / "hareke" gibi bir bölüme direkt atlanabilsin
  // diye (Diyanet/veli konuya girip çıkarken tam anlatımı görsün).
  /**
   * ⚠️ ZİYARET BURADA İŞARETLENİR: bu ders KENDİ KONUSU (`yazilis-hafiza`)
   * ve alıştırması olmadığı için tamamlanma ölçütü "bir kez girildi"dir
   * (bkz. `isTopicCompleted`). Konu rotası buraya yönlendirdiği için
   * Topic.tsx'in kaydı yetmez — sayfaya doğrudan da gelinebiliyor.
   */
  useEffect(() => { markTopicVisited("yazilis-hafiza"); }, []);

  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-background">
      <RouteHead
        title="Yazılış Hafıza Yöntemi — Başta, Ortada, Sonda | ElifMim"
        description="Arap harflerinin başta, ortada ve sonda hallerini ezberlemeden öğren: değişmeyen 6 harf, kuyruk silme kuralı ve nokta yöntemi — animasyonlu anlatım."
        path="/yazilis-hafiza"
      />
      <main className="container mx-auto max-w-2xl px-4 pb-24">
        <PageHeader title="🧠 Yazılış Hafıza Yöntemi" backTo="/konu/elifba/yazilislar" centered />

        <div className="mb-4">
          <BuddyWithBubble
            pose="point"
            size={88}
            say="84 şekli ezberlemene gerek yok! Üç kuralı öğren, gerisini kendin bulursun. 🎯"
          />
        </div>

        {/* ---- 1) DEĞİŞMEYEN 6 HARF ---- */}
        <section id="degismeyen" className="mb-5 scroll-mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-sm font-extrabold text-success-foreground">1</span>
            <h2 className="text-base font-extrabold text-foreground">{STABLE_GROUP.title}</h2>
          </div>
          <div className="rounded-2xl border-2 border-success/40 bg-card p-3 shadow-card">
            <p className="mb-3 text-[11px] font-bold leading-snug text-muted-foreground">
              {STABLE_GROUP.hint}
            </p>
            <div dir="rtl" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {STABLE_GROUP.letters.map((l) => {
                const item = findItem(writingItemIds(l.n).init);
                return (
                  <button
                    key={l.n}
                    onClick={() => item && playItem(item)}
                    aria-label={l.name}
                    className="flex flex-col items-center gap-0.5 rounded-xl border-2 border-success/25 bg-success/5 py-2 transition-bouncy hover:-translate-y-0.5 active:scale-95"
                  >
                    <span className="font-arabic text-4xl leading-[1.6] text-emerald-900">{l.iso}</span>
                    <span className="text-[11px] font-extrabold text-foreground" dir="ltr">{l.name}</span>
                  </button>
                );
              })}
            </div>
            {/* Kanıt şeridi: üç hâli de aynı */}
            <div className="mt-3 rounded-xl bg-success/10 p-2">
              <p className="mb-1 text-center text-[10px] font-extrabold text-success">
                Bak: üç hâli de aynı! (örnek: Dal)
              </p>
              <div dir="rtl" className="flex items-center justify-center gap-3">
                {(["iso", "init", "fin"] as const).map((k, i) => (
                  <span key={k} className="flex flex-col items-center">
                    <span className="font-arabic text-3xl leading-[1.6] text-emerald-900">
                      {k === "iso" ? "د" : k === "init" ? "د" : "ـد"}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground" dir="ltr">
                      {["yalın", "başta", "sonda"][i]}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---- 2) KUYRUK SİLME ---- */}
        <section id="kuyruk-silme" className="mb-5 scroll-mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">2</span>
            <h2 className="text-base font-extrabold text-foreground">Kuyruk Silme Kuralı</h2>
          </div>
          <div className="mb-3 rounded-2xl border-2 border-primary/25 bg-primary/5 p-3">
            <p className="text-[12px] font-bold leading-snug text-foreground">
              Bir harf kendinden sonrakine bağlanacaksa <b className="text-destructive">kuyruğunu (çanağını) bırakır</b>,
              yalnız <b className="text-primary">başı</b> kalır. Yani yalın hâlini biliyorsan, başta hâlini
              <b> ezberlemene gerek yok</b> — kuyruğu sil, çıkar!
            </p>
          </div>

          {/* Önce İZLE (bir kez, worked-example): nasıl silineceğini görsün */}
          <div className="mb-3">
            <p className="mb-1.5 text-center text-[11px] font-extrabold text-muted-foreground">
              👀 Önce izle — Cim örneği
            </p>
            <TailErase rule={TAIL_RULES[0]} />
          </div>

          {/* Sonra SEN DENE — her harf için elle sil oyunu (kim 2 saat okur ki!) */}
          <p className="mb-2 text-center text-[11px] font-extrabold text-muted-foreground">
            ✋ Şimdi sıra sende — kuyruğu parmağınla sil!
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TAIL_RULES.map((r) => (
              <EraseGame key={r.n} rule={r} />
            ))}
          </div>
        </section>

        {/* ---- 3) NOKTA YÖNTEMİ ---- */}
        <section id="nokta-yontemi" className="mb-5 scroll-mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning text-sm font-extrabold text-warning-foreground">3</span>
            <h2 className="text-base font-extrabold text-foreground">Nokta Yöntemi</h2>
          </div>
          <div className="mb-3 rounded-2xl border-2 border-warning/40 bg-warning/5 p-3">
            <p className="text-[12px] font-bold leading-snug text-foreground">
              Harfler birbirine karışıyorsa sebebi şu: <b>iskeletleri aynı!</b> Onları ayıran tek şey
              noktanın <b className="text-warning">sayısı</b> ve <b className="text-warning">yeri</b> (üstte mi, altta mı).
              Şekle değil, <b>noktaya</b> bak.
            </p>
          </div>
          <div className="space-y-3">
            {DOT_GROUPS.map((g) => (
              <DotCompare key={g.id} group={g} />
            ))}
          </div>

          {/* ÇİZGİ YÖNTEMİ — noktası olmayan ikili (Elif ile Lem). Nokta
              bölümünün hemen ardında duruyor çünkü çocuğun sorusu aynı:
              "bunlar birbirinin aynısı, nasıl ayıracağım?" Cevap farklı:
              noktaya değil, çizginin devam edip etmediğine bak. */}
          <div className="mt-3 space-y-3">
            {STROKE_PAIRS.map((p) => (
              <StrokeCompare key={p.id} pair={p} />
            ))}
          </div>
        </section>

        {/* ---- 4) HAREKE HAFIZA YÖNTEMİ (Türkçe öncelikli) ---- */}
        <section id="hareke" className="mb-5 scroll-mt-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info text-sm font-extrabold text-info-foreground">4</span>
            <h2 className="text-base font-extrabold text-foreground">Hareke Hafıza Yöntemi</h2>
          </div>
          <div className="mb-3 rounded-2xl border-2 border-info/40 bg-info/5 p-3">
            <p className="text-[12px] font-bold leading-snug text-foreground">
              Üç harekenin <b className="text-info">TÜRKÇE ADI</b> zaten bize ipucu veriyor —
              çocuk bunu ezberlemeden, sadece adını hatırlayarak bulur:
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[12px] font-bold text-foreground">
              <li>🔹 <b>ÜSTÜN</b> — adında &quot;ÜST&quot; var → <b className="text-info">üstte</b> durur.</li>
              <li>🔹 <b>ÖTRE</b> — adında &quot;Ö&quot; var → <b className="text-info">Ü</b> diye okunur.</li>
              <li>🔹 <b>ESRE</b> — üstünün <b className="text-info">tam tersi</b> → altta durur.</li>
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {HAREKE_MNEMONICS.map((m) => (
              <HarekeMnemo key={m.id} m={m} />
            ))}
          </div>
        </section>

        {/* Alıştırmaya çağrı — öğrendiğini hemen dene (geri getirme pratiği) */}
        <div className="rounded-2xl border-2 border-primary/30 bg-card p-4 text-center shadow-card">
          <BuddyWithBubble
            pose="celebrate"
            size={76}
            say="Kuralları öğrendin! Şimdi test edelim — bak ne kadar kolaylaştı! 🚀"
          />
          <Link
            to="/konu/elifba/yazilislar"
            className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-6 py-3 font-extrabold text-primary-foreground shadow-card transition-bouncy hover:-translate-y-0.5 active:scale-95"
          >
            <Zap className="h-5 w-5" /> Alıştırmaya geç
          </Link>
        </div>
      </main>
    </div>
  );
};

export default YazilisHafiza;
