// 📖 "Kur'an Provası" — Mushaf'tan okuma köprüsü.
//
// Uygulamanın NİHAİ HEDEFİ: çocuğu gerçek Kur'an okumaya geçirmek. Ezber
// (hatırlama, okunuş destekli) ile harfler arasındaki boşluğu kapatır:
// çocuk ezberlediği sûreyi bu kez MUSHAF YAZISINDAN, OKUNUŞSUZ okur. Her
// parçayı sesli okur, dokununca kendini kontrol eder (okunuş açılır) ve
// "okudum" işaretler. Tüm parçalar okununca sûre "Mushaf'tan okundu" olur.
// İlerleme öğrenci profiline göre saklanır (Hoca Modu).
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { SURAS, getSura } from "@/data/ezber";
import { getActiveStudentScope } from "@/data/srs";
import { cn } from "@/lib/utils";
import { Check, Eye, RotateCcw, Crown, BookOpen } from "lucide-react";

const AR_FONT = { fontFamily: '"Amiri Quran", "Scheherazade New", "Traditional Arabic", serif' };

function storageKey(): string {
  const sid = getActiveStudentScope();
  return sid ? `elifba-prova-student-${sid}-v1` : "elifba-prova-guest-v1";
}
type ProvaState = Record<string, string[]>; // suraId → okunmuş parça id'leri
function loadAll(): ProvaState {
  try { return JSON.parse(localStorage.getItem(storageKey()) || "{}"); } catch { return {}; }
}
function saveAll(s: ProvaState) {
  try { localStorage.setItem(storageKey(), JSON.stringify(s)); } catch { /* ignore */ }
}
function readSet(suraId: string): Set<string> {
  return new Set(loadAll()[suraId] ?? []);
}
function markRead(suraId: string, segId: string) {
  const all = loadAll();
  const arr = new Set(all[suraId] ?? []);
  arr.add(segId);
  all[suraId] = [...arr];
  saveAll(all);
}
function resetSura(suraId: string) {
  const all = loadAll();
  delete all[suraId];
  saveAll(all);
}

// ---- liste ekranı ----
const ProvaList = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft/40 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="📖 Kur'an Provası" backTo="/ezber" centered />

        <div className="mb-4 rounded-2xl bg-card p-4 shadow-card border-2 border-primary/30">
          <h3 className="font-extrabold text-sm text-foreground mb-1">Artık gerçek Mushaf'tan oku! 🕌</h3>
          <p className="text-[12px] leading-relaxed text-muted-foreground font-semibold">
            Ezberlediğin sûreleri şimdi <span className="text-foreground">okunuşsuz, sadece
            Mushaf yazısından</span> oku. Her parçayı sesli oku, dokununca kendini kontrol et.
            Bu, gerçek Kur'an okumaya ilk adımın! 📖
          </p>
        </div>

        <div className="space-y-3">
          {SURAS.map((s, i) => {
            const read = readSet(s.id);
            const done = s.segments.every((seg) => read.has(seg.id));
            const pct = Math.round((s.segments.filter((seg) => read.has(seg.id)).length / s.segments.length) * 100);
            return (
              <Link
                key={s.id}
                to={`/prova/${s.id}`}
                className="block rounded-2xl bg-card p-4 shadow-card border-2 border-border/40 transition-bouncy hover:-translate-y-0.5 hover:shadow-elegant animate-bounce-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-foreground">{s.title}</h2>
                      {done && <Crown className="h-4 w-4 text-warning shrink-0" />}
                    </div>
                    <p className="text-[11px] font-bold text-muted-foreground">{done ? "Mushaf'tan okundu ✓" : `${pct}% okundu`}</p>
                  </div>
                  <BookOpen className="h-5 w-5 text-primary shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
};

// ---- okuma ekranı ----
const ProvaRead = ({ suraId }: { suraId: string }) => {
  const sura = getSura(suraId);
  const navigate = useNavigate();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [read, setRead] = useState<Set<string>>(() => readSet(suraId));
  const [, force] = useState(0);
  const celebratedRef = useRef(false);
  const [celebrate, setCelebrate] = useState(false);

  const allDone = !!sura && sura.segments.every((seg) => read.has(seg.id));

  useEffect(() => {
    if (allDone && !celebratedRef.current && read.size > 0) {
      celebratedRef.current = true;
      setCelebrate(true);
    }
  }, [allDone, read.size]);

  const onReveal = useCallback((segId: string) => {
    setRevealed((prev) => { const n = new Set(prev); n.add(segId); return n; });
  }, []);
  const onMark = useCallback((segId: string) => {
    markRead(suraId, segId);
    setRead((prev) => { const n = new Set(prev); n.add(segId); return n; });
  }, [suraId]);
  const restart = useCallback(() => {
    resetSura(suraId);
    setRead(new Set());
    setRevealed(new Set());
    celebratedRef.current = false;
    setCelebrate(false);
    force((x) => x + 1);
  }, [suraId]);

  if (!sura) return <Navigate to="/prova" replace />;

  const readCount = sura.segments.filter((seg) => read.has(seg.id)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-soft/40 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title={`${sura.emoji} ${sura.title}`} backTo="/prova" centered />

        {/* ilerleme */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] font-extrabold text-muted-foreground whitespace-nowrap">{readCount}/{sura.segments.length} okundu</span>
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden border border-border">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-300" style={{ width: `${(readCount / sura.segments.length) * 100}%` }} />
          </div>
          <span className="text-sm">📖</span>
        </div>

        <p className="mb-3 text-center text-[11px] font-bold text-muted-foreground">
          Her satırı sesli oku 🗣️ · Emin değilsen "Göster"e bas, kendini kontrol et ✓
        </p>

        <div className="space-y-2.5">
          {sura.segments.map((seg, i) => {
            const isRead = read.has(seg.id);
            const isReveal = revealed.has(seg.id);
            return (
              <div
                key={seg.id}
                className={cn(
                  "rounded-2xl bg-card p-4 shadow-card border-2 transition-colors",
                  isRead ? "border-success/60 bg-success/5" : "border-border/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                    isRead ? "bg-success text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {isRead ? "✓" : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* MUSHAF yazısı — büyük, okunuşsuz */}
                    <div className="text-right leading-[2]" dir="rtl">
                      <span className="text-3xl text-foreground" style={AR_FONT}>{seg.ar}</span>
                    </div>
                    {/* kontrol: okunuş yalnız "Göster"den sonra */}
                    {isReveal && (
                      <div className="mt-1 text-left text-xs font-bold text-primary animate-fade-in" dir="ltr">{seg.tr}</div>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onReveal(seg.id)}
                    disabled={isReveal}
                    className={cn(
                      "rounded-xl py-2 text-sm font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-95",
                      isReveal ? "bg-muted text-muted-foreground" : "bg-card border-2 border-primary/40 text-primary shadow-soft",
                    )}
                  >
                    <Eye className="h-4 w-4" /> {isReveal ? seg.tr : "Göster"}
                  </button>
                  <button
                    onClick={() => onMark(seg.id)}
                    className={cn(
                      "rounded-xl py-2 text-sm font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-95",
                      isRead ? "bg-success/20 text-success border-2 border-success/40" : "bg-success text-success-foreground shadow-soft",
                    )}
                  >
                    <Check className="h-4 w-4" /> {isRead ? "Okudum ✓" : "Okudum"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {celebrate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6" onClick={() => setCelebrate(false)}>
            <div className="rounded-3xl bg-card p-8 shadow-elegant border-2 border-warning/50 text-center max-w-sm">
              <div className="text-5xl mb-2">🕌</div>
              <div className="text-2xl font-extrabold text-success mb-1">Mâşâallah!</div>
              <p className="text-sm font-bold text-muted-foreground mb-4">
                {sura.title}'ni Mushaf'tan okudun! Gerçek Kur'an okumaya bir adım daha yaklaştın. 📖✨
              </p>
              <div className="flex justify-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); restart(); }} className="inline-flex items-center gap-1.5 rounded-full bg-muted border-2 border-border px-4 py-2.5 font-extrabold text-sm active:scale-95">
                  <RotateCcw className="h-4 w-4" /> Tekrar
                </button>
                <button onClick={(e) => { e.stopPropagation(); navigate("/prova"); }} className="rounded-full bg-success text-success-foreground px-5 py-2.5 font-extrabold text-sm shadow-soft active:scale-95">
                  Diğer Sûreler
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const Prova = () => {
  const { suraId } = useParams<{ suraId: string }>();
  return suraId ? <ProvaRead suraId={suraId} /> : <ProvaList />;
};

export default Prova;
