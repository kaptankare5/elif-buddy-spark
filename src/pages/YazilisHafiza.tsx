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
import { KuyrukAtolyesi } from "@/components/mnemonics/KuyrukAtolyesi";
import { TAIL_RULES } from "@/data/writingMnemonics";
import { markTopicVisited } from "@/lib/placement";
import { Zap } from "lucide-react";
import { harfRengi, acikTon } from "@/data/harfRenkleri";
import { EmojiView } from "@/components/EmojiView";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
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
            say="Harflerin kuyruğunu süngerle sil — arkasından çıkan şey ezberlemen gereken yeni bir harf değil, AYNI harf! 🧽"
          />
        </div>

        
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

          {/* Sonra SEN DENE — kuyruk atölyesi (tek tek 16 kart yerine sahne) */}
          <KuyrukAtolyesiBolumu />
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

/**
 * 🧽 KUYRUK ATÖLYESİ BÖLÜMÜ — 16 harfin hepsi TEK sahnede, sırayla.
 *
 * ⚠️ ESKİDEN 16 KART BİRDEN ÇİZİLİYORDU (`EraseGame` ızgarası): telefonda
 * 16 ayrı kanvas + 16 maske kurulumu demek, sayfa açılışını kasıyor ve
 * çocuk hangisinden başlayacağını bilemiyordu. Şimdi tek sahne var, harf
 * seçici üstte; hangi harfleri bitirdiği renkli rozetlerden okunuyor.
 *
 * ⚠️ HİÇBİR ŞEYE YAZMAZ (kullanıcı şartı): bitirilen harfler yalnız bu
 * bileşenin state'inde tutulur — localStorage'a bile yazılmaz, SRS'e hiç
 * dokunmaz. Sayfadan çıkınca sıfırlanır; burası bir ders, ölçüm değil.
 */
/** Harf silinince sonrakine kendiliğinden geçme süresi (ms). */
const OTOMATIK_GECIS = 2600;

function KuyrukAtolyesiBolumu() {
  const [idx, setIdx] = useState(0);
  const [bitenler, setBitenler] = useState<number[]>([]);
  const [bekliyor, setBekliyor] = useState(false);
  const rule = TAIL_RULES[idx];
  const renk = harfRengi(rule.n);
  const hepsiBitti = bitenler.length === TAIL_RULES.length;
  // Sıradaki BİTMEMİŞ harf; yoksa listede bir sonraki (baştan başa döner).
  const hedefIdx = useMemo(() => {
    const s = TAIL_RULES.findIndex((r, i) => i > idx && !bitenler.includes(r.n));
    if (s >= 0) return s;
    const b = TAIL_RULES.findIndex((r) => !bitenler.includes(r.n));
    return b >= 0 ? b : (idx + 1) % TAIL_RULES.length;
  }, [idx, bitenler]);

  const gec = useCallback(() => {
    setBekliyor(false);
    setIdx(hedefIdx);
  }, [hedefIdx]);

  // Kendiliğinden geçiş — kutlama ve harfin sesi bitsin diye beklenir.
  useEffect(() => {
    if (!bekliyor) return;
    const t = setTimeout(() => { setBekliyor(false); setIdx(hedefIdx); }, OTOMATIK_GECIS);
    return () => clearTimeout(t);
  }, [bekliyor, hedefIdx]);

  // Harf değişince bekleme durumu sıfırlanır (elle seçim otomatiği iptal eder).
  useEffect(() => { setBekliyor(false); }, [idx]);

  return (
    <div>
      <p className="mb-2 text-center text-[11px] font-extrabold text-muted-foreground">
        ✋ Şimdi sıra sende — süngeri tut, kuyruğu ovala!
      </p>

      {/* harf seçici — her harf kendi renginde */}
      <div dir="rtl" className="mb-2 flex flex-wrap justify-center gap-1.5">
        {TAIL_RULES.map((r, i) => {
          const c = harfRengi(r.n);
          const secili = i === idx;
          const tamam = bitenler.includes(r.n);
          return (
            <button
              key={r.n}
              onClick={() => setIdx(i)}
              aria-label={`${r.name} harfini seç`}
              aria-current={secili}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-2xl text-xl transition-transform active:scale-95",
                secili ? "scale-110 shadow-card" : "shadow-soft",
              )}
              style={{
                background: secili ? c : acikTon(c, 0.82),
                color: secili ? "#fff" : c,
                outline: secili ? `2px solid ${c}` : "none",
                outlineOffset: 2,
              }}
            >
              <EmojiView value={r.iso} />
              {tamam && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] font-black text-success-foreground">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <KuyrukAtolyesi
        key={rule.n}
        rule={rule}
        onDone={() => {
          setBitenler((b) => (b.includes(rule.n) ? b : [...b, rule.n]));
          setBekliyor(true);
        }}
      />

      {/* ilerleme */}
      <div className="mt-2 text-center text-[11px] font-extrabold text-muted-foreground">
        {bitenler.length} / {TAIL_RULES.length} harf temizlendi
      </div>

      {/**
        * ⚠️ SONRAKİ HARFE GEÇİŞ HEM KENDİLİĞİNDEN HEM ELLE (kullanıcı:
        * "sonraki harfe geçmesi otomatik olsun veya harfin altında kocaman
        * sonraki harf butonu olsun… kullanıcı anlasın yani").
        * Otomatik geçiş, kutlama + HARFİN SESİ bitmeden başlamaz
        * (OTOMATIK_GECIS): ses yarıda kesilirse çocuk harfi duymamış olur —
        * zaten sesi eklememizin sebebi oydu.
        * Düğme büyük ve SIRADAKİ HARFİ GÖSTERİR: okuma bilmeyen çocuk
        * "hangi harfe geçiyorum"u yazıdan değil GLİFTEN anlar.
        */}
      <button
        onClick={gec}
        className="mt-2 flex w-full items-center justify-center gap-3 rounded-3xl px-4 py-4 text-white shadow-card transition-transform active:scale-95"
        style={{ background: renk }}
        aria-label={`Sonraki harfe geç: ${TAIL_RULES[hedefIdx].name}`}
      >
        <span className="text-base font-extrabold">Sonraki</span>
        <span className="text-4xl"><EmojiView value={TAIL_RULES[hedefIdx].iso} /></span>
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-xl font-black">
          ▶
          {bekliyor && (
            <span
              className="absolute inset-0 rounded-full border-[3px] border-white/90"
              style={{ animation: `atolye-halka ${OTOMATIK_GECIS}ms linear forwards` }}
            />
          )}
        </span>
      </button>

      {hepsiBitti && (
        <div className="mt-2 rounded-2xl border-2 border-success/40 bg-success/10 p-2.5 text-center">
          <p className="text-[12px] font-extrabold text-success">
            🏆 Hepsinin kuyruğunu sildin! Artık başta hâllerini ezberlemene gerek yok.
          </p>
        </div>
      )}
    </div>
  );
}

export default YazilisHafiza;
