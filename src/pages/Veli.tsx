// 👪 "Veli Paneli" — veliye yönelik günlük özet + ÖVGÜ TETİKLEYİCİSİ.
//
// DAVRANIŞ BİLİMİ: küçük çocukta en güçlü pekiştireç ANNE-BABA ÖVGÜSÜdür.
// Panel, çocuğun bugün ne öğrendiğini veliye gösterir ve doğrudan "ona şunu
// söyle" diyerek övgüyü TETİKLER → çocuk daha çok motive olur + veli
// uygulamada kalır (kategoride gatekeeper velidir). Ayrıca kategoride ailenin
// güveni en büyük sermaye: panel "sağlıklı, çocuğum öğreniyor" hissini verir.
// Tüm veri mevcut SRS'ten türetilir (aktif öğrenci profiline göre — Hoca Modu).
import { PageHeader } from "@/components/PageHeader";
import { getAllTopics } from "@/data/subjects";
import { getTopicSrs, useSrsTick } from "@/data/srs";
import { getStreak } from "@/lib/streak";
import { useStudents } from "@/lib/students";
import { Link } from "react-router-dom";
import { TrendingUp, Sprout, Heart } from "lucide-react";

function startOfToday(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

// Pazartesi 00:00 — haftalık sayaçların başlangıcı
function startOfWeek(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Pzt=0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

// Bir öğrencinin SRS verisini (aktif kapsamdan bağımsız) doğrudan anahtardan
// okuyup bu haftaki çalışmayı sayar — Hoca Modu karşılaştırması için.
function studentWeekly(studentId: string): { practiced: number; learned: number } {
  const t0 = startOfWeek();
  let practiced = 0, learned = 0;
  try {
    const raw = localStorage.getItem(`elifba-srs-quiz-student-${studentId}-v1`);
    if (!raw) return { practiced, learned };
    const state = JSON.parse(raw) as Record<string, Record<string, { lastSeen?: number; learnedAt?: number }>>;
    for (const topic of Object.values(state)) {
      for (const e of Object.values(topic)) {
        if ((e.lastSeen ?? 0) >= t0) practiced++;
        if ((e.learnedAt ?? 0) >= t0) learned++;
      }
    }
  } catch { /* ignore */ }
  return { practiced, learned };
}

function computeSummary() {
  const t0 = startOfToday();
  const topics = getAllTopics().filter((t) => !t.noPractice && t.items.length > 0);
  let practicedToday = 0, learnedToday = 0, mastered = 0, learned = 0, total = 0;
  const newTodayTopics: string[] = [];
  for (const t of topics) {
    const srs = getTopicSrs("quiz", t.id);
    let topicNew = 0;
    for (const it of t.items) {
      total++;
      const e = srs[it.id];
      if (!e) continue;
      if ((e.lastSeen ?? 0) >= t0) practicedToday++;
      if ((e.learnedAt ?? 0) >= t0) { learnedToday++; topicNew++; }
      if ((e.level ?? 1) >= 4) mastered++;
      if ((e.level ?? 1) >= 3) learned++;
    }
    if (topicNew > 0) newTodayTopics.push(`${t.emoji} ${t.title.replace(/^\d+\.\s*/, "")}`);
  }
  return { practicedToday, learnedToday, mastered, learned, total, newTodayTopics };
}

const Veli = () => {
  useSrsTick("quiz");
  const { active, students } = useStudents();
  const s = computeSummary();
  // Haftalık dostane karşılaştırma (Hoca Modu, 2+ öğrenci): kutlama dili,
  // utandırma yok — herkesin emeği görünür, tatlı rekabet çalışmayı artırır.
  const weekly = students
    .map((st) => ({ st, ...studentWeekly(st.id) }))
    .sort((a, b) => b.practiced - a.practiced);
  const streak = getStreak();
  const name = active?.name || "Çocuğunuz";
  const activeToday = s.practicedToday > 0;
  const pct = s.total ? Math.round((s.learned / s.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-info/10 to-background">
      <main className="container mx-auto max-w-xl px-4 pb-16">
        <PageHeader title="👪 Veli Paneli" backTo="/ayarlar" centered />

        {active && (
          <div className="mb-3 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info/15 border-2 border-info/40 px-4 py-1 text-xs font-extrabold text-info">
              {active.emoji} {active.name} için
            </span>
          </div>
        )}

        {/* BUGÜN — hero özet + övgü tetikleyicisi */}
        <div className="mb-3 rounded-2xl bg-gradient-to-br from-success to-emerald-600 p-5 text-white shadow-card">
          <div className="text-xs font-bold opacity-90 mb-1">BUGÜN</div>
          {activeToday ? (
            <>
              <div className="text-2xl font-extrabold mb-1">
                {name} bugün çalıştı! 🎉
              </div>
              <div className="text-sm font-semibold opacity-95 leading-relaxed">
                {s.learnedToday > 0
                  ? <><b>{s.learnedToday} yeni harf/hece</b> öğrendi{s.newTodayTopics.length ? ` (${s.newTodayTopics.slice(0, 3).join(", ")})` : ""} · {s.practicedToday} alıştırma yaptı.</>
                  : <>{s.practicedToday} alıştırma yaptı, öğrendiklerini pekiştirdi. 💪</>}
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-extrabold mb-1">Bugün henüz çalışmadı</div>
              <div className="text-sm font-semibold opacity-95 leading-relaxed">
                {name}'a "Hadi birlikte birkaç harf çalışalım mı?" demeye ne dersiniz? Günde
                5 dakika bile büyük fark yaratır. 🌱
              </div>
            </>
          )}
        </div>

        {/* ÖVGÜ TETİKLEYİCİSİ — velinin çocuğa söyleyeceği somut cümle */}
        {activeToday && (
          <div className="mb-3 rounded-2xl bg-warning/10 border-2 border-warning/40 p-4 flex items-start gap-3">
            <Heart className="h-6 w-6 text-warning shrink-0 fill-warning/30 mt-0.5" />
            <div>
              <div className="text-sm font-extrabold text-foreground mb-0.5">💛 Ona şunu söyleyin:</div>
              <p className="text-[13px] font-bold text-foreground leading-relaxed italic">
                {s.learnedToday > 0
                  ? `"Aferin ${active?.name || "canım"}! Bugün ${s.learnedToday} yeni harf öğrenmişsin, seninle gurur duyuyorum! 🌟"`
                  : `"Aferin ${active?.name || "canım"}! Bugün de çalıştın, çok gayretlisin! 🌟"`}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                Bilimsel: küçük çocukta en güçlü motivasyon anne-baba övgüsüdür — bu tek cümle
                yarın da çalışma isteğini artırır.
              </p>
            </div>
          </div>
        )}

        {/* genel durum */}
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-card p-3 shadow-soft border-2 border-success/30">
            <div className="text-[10px] font-bold text-muted-foreground">Öğrenilen</div>
            <div className="text-xl font-extrabold text-success">{s.learned}</div>
            <div className="text-[9px] font-bold text-muted-foreground">/ {s.total}</div>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-soft border-2 border-warning/30">
            <div className="text-[10px] font-bold text-muted-foreground">🔥 Seri</div>
            <div className="text-xl font-extrabold text-warning">{streak.count}</div>
            <div className="text-[9px] font-bold text-muted-foreground">gün</div>
          </div>
          <div className="rounded-xl bg-card p-3 shadow-soft border-2 border-info/30">
            <div className="text-[10px] font-bold text-muted-foreground">Ustalaşan</div>
            <div className="text-xl font-extrabold text-info">{s.mastered}</div>
            <div className="text-[9px] font-bold text-muted-foreground">harf</div>
          </div>
        </div>

        {/* ilerleme çubuğu */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[11px] font-extrabold text-muted-foreground whitespace-nowrap">Elifbâ %{pct}</span>
          <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden border border-border">
            <div className="h-full rounded-full bg-gradient-to-r from-info to-success transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* 🌟 BU HAFTA — kardeşler/öğrenciler arası dostane kutlama (Hoca Modu) */}
        {weekly.length >= 2 && (
          <div className="mb-4 rounded-2xl bg-card border-2 border-gold/40 p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-extrabold text-foreground">🌟 Bu Hafta Yıldızlar</span>
              <span className="text-[10px] font-bold text-muted-foreground">Pazartesiden beri</span>
            </div>
            <div className="space-y-1.5">
              {weekly.map(({ st, practiced, learned }, i) => (
                <div key={st.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
                  <span className="text-base" aria-hidden>{["🥇", "🥈", "🥉"][i] ?? "⭐"}</span>
                  <span className="text-lg" aria-hidden>{st.emoji}</span>
                  <span className="flex-1 truncate text-sm font-extrabold text-foreground">{st.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {practiced} harf çalıştı{learned > 0 ? ` · ${learned} yeni 🌟` : ""}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] font-bold text-success">
              Hepsi harika gidiyor — her birine ayrı ayrı "aferin" demeyi unutmayın! 💚
            </p>
          </div>
        )}

        {/* detay linkleri */}
        <div className="grid grid-cols-2 gap-2">
          <Link to="/ilerleme" className="flex items-center justify-center gap-2 rounded-2xl bg-card p-3 shadow-soft border-2 border-border/40 font-extrabold text-sm text-foreground active:scale-95">
            <TrendingUp className="h-5 w-5 text-primary" /> Detaylı İlerleme
          </Link>
          <Link to="/bahce" className="flex items-center justify-center gap-2 rounded-2xl bg-card p-3 shadow-soft border-2 border-border/40 font-extrabold text-sm text-foreground active:scale-95">
            <Sprout className="h-5 w-5 text-success" /> Harf Bahçesi
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] font-bold text-muted-foreground leading-relaxed">
          Bu panel veliler içindir. {active ? "Hoca Modu'nda öğrenci değiştirerek her çocuğun özetini görebilirsiniz." : "Ayarlar → Hoca Modu'ndan çocuk profilleri ekleyebilirsiniz."}
        </p>
      </main>
    </div>
  );
};

export default Veli;
