// Hoca Paneli — cihazdaki öğrenci profillerinin öğrenme raporu + bulut bağlantısı.
// Her öğrenci için: kaç öğe öğrendi (L3+), doğruluk, sıradaki öğrenilecek harf,
// konu bazında seviye haritası. Bağlantı kodu ile öğrenci başka cihaza taşınır
// (camide hocanın telefonu → evde annenin telefonu, kaldığı yerden).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useStudents, switchStudent, type Student } from "@/lib/students";
import { readStudentSrs, useSrsTick, type Level } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";
import type { ContentItem, ContentTopic } from "@/data/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CloudUpload, RefreshCw, Copy, Loader2, LogIn } from "lucide-react";

interface TopicReport {
  topic: ContentTopic;
  levels: { item: ContentItem; level: Level; seen: number }[];
  learned: number;
}

interface StudentReport {
  learned: number;      // L3+ (bölüm kilidi ölçütüyle aynı)
  seenItems: number;    // en az 1 kez karşılaşılan öğe
  totalItems: number;
  accuracy: number | null;
  next: { item: ContentItem; topic: ContentTopic } | null;
  topics: TopicReport[];
}

function computeReport(studentId: string): StudentReport {
  const state = readStudentSrs(studentId, "quiz");
  const topics = getAllTopics().filter((t) => !t.noPractice && t.items.length > 0);
  let learned = 0, seenItems = 0, totalItems = 0, shown = 0, correct = 0;
  let next: StudentReport["next"] = null;
  const topicReports: TopicReport[] = [];

  for (const topic of topics) {
    const levels: TopicReport["levels"] = [];
    let topicLearned = 0;
    for (const item of topic.items) {
      totalItems += 1;
      const e = state[topic.id]?.[item.id];
      const level = (e?.level ?? 1) as Level;
      const seen = e?.seen ?? 0;
      if (seen > 0) {
        seenItems += 1;
        shown += e?.total ?? 0;
        correct += e?.correct ?? 0;
      }
      if (level >= 3) { learned += 1; topicLearned += 1; }
      else if (!next) next = { item, topic }; // müfredat sırasındaki ilk L3 altı öğe
      levels.push({ item, level, seen });
    }
    topicReports.push({ topic, levels, learned: topicLearned });
  }

  return {
    learned,
    seenItems,
    totalItems,
    accuracy: shown > 0 ? Math.round((correct / shown) * 100) : null,
    next,
    topics: topicReports,
  };
}

const LEVEL_STYLE: Record<Level, string> = {
  1: "bg-muted text-muted-foreground",
  2: "bg-warning/25 text-foreground",
  3: "bg-success/25 text-foreground",
  4: "bg-success text-success-foreground",
};

const TeacherPanel = () => {
  const { session } = useAuth();
  const { students, active } = useStudents();
  useSrsTick("quiz"); // öğrenci değişince/bulut birleşince yeniden hesapla
  const [openId, setOpenId] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reports = useMemo(() => {
    void tick; // bulut senkronu sonrası elle tazeleme tetikleyicisi
    const m = new Map<string, StudentReport>();
    for (const s of students) m.set(s.id, computeReport(s.id));
    return m;
  }, [students, tick]);

  const doClaim = async () => {
    if (!claimCode.trim()) return;
    setBusy("claim");
    try {
      const { claimStudentByCode } = await import("@/lib/studentSync");
      const s = await claimStudentByCode(claimCode);
      toast.success(`${s.emoji} ${s.name} bu cihaza bağlandı!`);
      setClaimCode("");
      setTick((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bağlanılamadı");
    } finally {
      setBusy(null);
    }
  };

  const doFetchAll = async () => {
    setBusy("fetch");
    try {
      const { fetchMyCloudStudents } = await import("@/lib/studentSync");
      const list = await fetchMyCloudStudents();
      toast.success(`${list.length} öğrenci buluttan getirildi.`);
      setTick((t) => t + 1);
    } catch {
      toast.error("Öğrenciler getirilemedi.");
    } finally {
      setBusy(null);
    }
  };

  const doConnect = async (s: Student) => {
    setBusy(s.id);
    try {
      const { connectStudentToCloud } = await import("@/lib/studentSync");
      const c = await connectStudentToCloud(s);
      if (c?.linkCode) toast.success(`${c.name} buluta bağlandı — kod: ${c.linkCode}`);
      else toast.error("Bağlanamadı. Giriş yaptığından emin ol.");
      setTick((t) => t + 1);
    } finally {
      setBusy(null);
    }
  };

  const doRefresh = async (s: Student) => {
    setBusy(s.id);
    try {
      const { pullStudentFromCloud, uploadStudentToCloud } = await import("@/lib/studentSync");
      await pullStudentFromCloud(s.id);
      await uploadStudentToCloud(s);
      toast.success(`${s.name} bulutla eşitlendi.`);
      setTick((t) => t + 1);
    } catch {
      toast.error("Eşitleme başarısız.");
    } finally {
      setBusy(null);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).then(
      () => toast.success(`Kod kopyalandı: ${code}`),
      () => toast.error("Kopyalanamadı"),
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <main className="container mx-auto max-w-2xl px-4 pb-24">
        <PageHeader title="👨‍🏫 Hoca Paneli" backTo="/ayarlar" centered />

        {/* Bulut bağlantısı */}
        <div className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40 mb-4">
          <h2 className="font-extrabold mb-1">☁️ Cihazlar arası devam</h2>
          {session ? (
            <>
              <p className="text-[11px] text-muted-foreground leading-snug mb-3">
                Buluta bağlı her öğrencinin 6 haneli <strong>bağlantı kodu</strong> vardır.
                Kodu velinin telefonuna ver: orada da giriş yapıp kodu girince öğrenci
                o cihaza eklenir ve <strong>kaldığı yerden</strong> devam eder.
              </p>
              <div className="flex gap-2">
                <input
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") void doClaim(); }}
                  placeholder="Bağlantı kodu (örn. K7MX2A)"
                  maxLength={6}
                  className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-mono tracking-widest uppercase"
                />
                <button
                  onClick={() => void doClaim()}
                  disabled={busy === "claim"}
                  className="rounded-xl bg-primary text-primary-foreground px-4 py-2 font-extrabold text-sm active:scale-95 disabled:opacity-50"
                >
                  {busy === "claim" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bağlan"}
                </button>
              </div>
              <button
                onClick={() => void doFetchAll()}
                disabled={busy === "fetch"}
                className="mt-2 w-full rounded-xl border-2 border-border bg-muted/40 py-2 text-xs font-extrabold text-foreground flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy === "fetch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Hesabımdaki öğrencileri bu cihaza getir
              </button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground leading-snug">
              Öğrencileri buluta bağlamak ve başka cihazdan devam ettirmek için giriş yapmalısın.
              <Link to="/giris" className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2 text-sm font-extrabold">
                <LogIn className="h-4 w-4" /> Giriş yap / Kayıt ol
              </Link>
            </div>
          )}
        </div>

        {/* Öğrenci raporları */}
        {students.length === 0 && (
          <p className="text-center text-sm font-bold text-muted-foreground py-8">
            Henüz öğrenci yok. Ayarlar → Hoca Modu'ndan öğrenci ekle
            {session ? " veya yukarıdan bağlantı koduyla bağlan." : "."}
          </p>
        )}

        <div className="space-y-3">
          {students.map((s) => {
            const r = reports.get(s.id);
            if (!r) return null;
            const pct = r.totalItems > 0 ? Math.round((r.learned / r.totalItems) * 100) : 0;
            const isOpen = openId === s.id;
            return (
              <div key={s.id} className="rounded-2xl bg-card p-4 shadow-card border-2 border-border/40">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold truncate">{s.name}</h3>
                      {active?.id === s.id && <span className="text-[10px] font-extrabold text-primary shrink-0">AKTİF</span>}
                    </div>
                    {s.linkCode ? (
                      <button
                        onClick={() => copyCode(s.linkCode!)}
                        className="mt-0.5 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-extrabold text-primary"
                      >
                        {s.linkCode} <Copy className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">Yalnız bu cihazda</span>
                    )}
                  </div>
                  {session && (s.cloudId ? (
                    <button
                      onClick={() => void doRefresh(s)}
                      disabled={busy === s.id}
                      aria-label="Bulutla eşitle"
                      className="rounded-xl bg-muted p-2 disabled:opacity-50"
                    >
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                  ) : (
                    <button
                      onClick={() => void doConnect(s)}
                      disabled={busy === s.id}
                      className="rounded-xl bg-primary/15 px-2 py-2 text-[11px] font-extrabold text-primary flex items-center gap-1 disabled:opacity-50"
                    >
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                      Buluta bağla
                    </button>
                  ))}
                </div>

                {/* Özet */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Öğrendi" value={`${r.learned}/${r.totalItems}`} />
                  <Stat label="Doğruluk" value={r.accuracy != null ? `%${r.accuracy}` : "—"} />
                  <Stat label="İlerleme" value={`%${pct}`} />
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>

                {r.next && (
                  <p className="mt-2 text-xs font-bold text-foreground">
                    🎯 Sıradaki: <span dir="rtl" className="font-extrabold text-primary text-base leading-[1.5]">{r.next.item.emoji ?? r.next.item.label}</span>
                    {" "}<span className="text-muted-foreground">({r.next.item.subLabel ?? r.next.item.label} — {r.next.topic.title})</span>
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setOpenId(isOpen ? null : s.id)}
                    className="flex-1 rounded-xl border-2 border-border bg-muted/40 py-1.5 text-xs font-extrabold"
                  >
                    {isOpen ? "Detayı gizle" : "Harf haritası"}
                  </button>
                  {active?.id !== s.id && (
                    <button
                      onClick={() => { switchStudent(s.id); toast.success(`${s.name} aktif — ders başlayabilir.`); }}
                      className="flex-1 rounded-xl bg-primary text-primary-foreground py-1.5 text-xs font-extrabold"
                    >
                      Bu öğrenciyle çalış
                    </button>
                  )}
                </div>

                {/* Konu bazında seviye haritası */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {r.topics.map(({ topic, levels, learned }) => (
                      <div key={topic.id}>
                        <div className="text-[11px] font-extrabold text-muted-foreground mb-1">
                          {topic.emoji} {topic.title} — {learned}/{levels.length}
                        </div>
                        <div dir="rtl" className="flex flex-wrap gap-1">
                          {levels.map(({ item, level, seen }) => (
                            <span
                              key={item.id}
                              title={`${item.subLabel ?? item.label} • Seviye ${level}${seen === 0 ? " (görmedi)" : ""}`}
                              className={cn(
                                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1 font-extrabold text-sm leading-[1.5]",
                                seen === 0 ? "opacity-40" : "",
                                LEVEL_STYLE[level],
                              )}
                            >
                              {item.emoji ?? item.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">
                      Renkler: gri = başlamadı/L1 · sarı = L2 · açık yeşil = L3 · koyu yeşil = L4 (öğrendi).
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 py-2">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="text-sm font-extrabold text-foreground">{value}</div>
    </div>
  );
}

export default TeacherPanel;
