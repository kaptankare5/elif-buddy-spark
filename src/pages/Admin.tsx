import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Shield, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Pop = { game_id: string; session_count: number; unique_users: number; avg_seconds: number | null; completion_pct: number | null; accuracy_pct: number | null };
type Learn = { topic_id: string; letter_id: string; learners: number; avg_minutes: number | null };
type Daily = { day: string; dau: number; sessions: number };
type Funnel = { step: string; events: number; users: number };
type Age = { age_band: string; gender: string; users: number; sessions: number; accuracy_pct: number | null };
type Power = { learned_items: number; learners: number; avg_seconds_per_item: number | null; avg_minutes_per_item: number | null };
type LetterPower = { topic_id: string; letter_id: string; learners: number; avg_seconds: number | null; knew_before_count: number };
type Rate = { mode: string; learners: number; learned_items: number; active_minutes: number | null; items_per_minute: number | null; items_per_hour: number | null };
type Engage = { game_id: string; mode: string; sessions: number; unique_users: number; total_minutes: number | null; avg_seconds: number | null; completion_pct: number | null; accuracy_pct: number | null };
type Ret = { cohort_week: string; cohort_size: number; d1_pct: number | null; d7_pct: number | null; d30_pct: number | null };
type Svn = { mode: string; users: number; sessions: number; avg_seconds: number | null; completion_pct: number | null; accuracy_pct: number | null };
type UserRow = { user_id: string; pseudonym: string; age_band: string | null; gender: string | null; primary_mode: string; learned_items: number; known_items: number; total_items_seen: number; avg_seconds_per_learned_item: number | null; items_per_active_hour: number | null; last_active: string | null; accuracy_pct: number | null };
type UserLetter = { user_id: string; topic_id: string; letter_id: string; level: number; knew_before: boolean | null; learned_at: string | null; shown_count: number; correct_count: number; seconds_to_learn: number | null; last_seen_at: string | null };
type UserMode = { user_id: string; pseudonym: string; mode: string; events: number; correct: number; avg_seconds: number | null; accuracy_pct: number | null };


const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const Admin = () => {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [pop, setPop] = useState<Pop[]>([]);
  const [learn, setLearn] = useState<Learn[]>([]);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [funnel, setFunnel] = useState<Funnel[]>([]);
  const [ages, setAges] = useState<Age[]>([]);
  const [power, setPower] = useState<Power | null>(null);
  const [letterPower, setLetterPower] = useState<LetterPower[]>([]);
  const [rate, setRate] = useState<Rate[]>([]);
  const [engage, setEngage] = useState<Engage[]>([]);
  const [retention, setRetention] = useState<Ret[]>([]);
  const [svn, setSvn] = useState<Svn[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userModes, setUserModes] = useState<UserMode[]>([]);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [userLetters, setUserLetters] = useState<UserLetter[]>([]);
  const [filterMode, setFilterMode] = useState<"all" | "super" | "normal">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      setLoading(true);
      const sb = supabase as unknown as { from: (t: string) => any };
      const [p, l, d, f, a, lp, lpw, r, eg, rt, sv, up, um] = await Promise.all([
        supabase.from("analytics_game_popularity").select("*").order("session_count", { ascending: false }),
        supabase.from("analytics_letter_learn_time").select("*").order("avg_minutes", { ascending: true }).limit(30),
        supabase.from("analytics_daily_active").select("*").limit(30),
        supabase.from("analytics_paywall_funnel").select("*"),
        supabase.from("analytics_age_breakdown").select("*"),
        sb.from("analytics_learning_power").select("*").maybeSingle(),
        sb.from("analytics_letter_power").select("*").order("avg_seconds", { ascending: true }).limit(50),
        sb.from("analytics_learning_rate").select("*"),
        sb.from("analytics_game_engagement").select("*"),
        sb.from("analytics_retention").select("*").limit(12),
        sb.from("analytics_super_vs_normal").select("*"),
        sb.from("analytics_user_progress").select("*").order("learned_items", { ascending: false }).limit(500),
        sb.from("analytics_super_vs_normal_per_user").select("*"),
      ]);
      setPop((p.data as Pop[]) ?? []);
      setLearn((l.data as Learn[]) ?? []);
      setDaily(((d.data as Daily[]) ?? []).reverse());
      setFunnel((f.data as Funnel[]) ?? []);
      setAges((a.data as Age[]) ?? []);
      setPower((lp.data as Power | null) ?? null);
      setLetterPower((lpw.data as LetterPower[]) ?? []);
      setRate((r.data as Rate[]) ?? []);
      setEngage((eg.data as Engage[]) ?? []);
      setRetention(((rt.data as Ret[]) ?? []).reverse());
      setSvn((sv.data as Svn[]) ?? []);
      setUsers((up.data as UserRow[]) ?? []);
      setUserModes((um.data as UserMode[]) ?? []);
      setLoading(false);
    })();
  }, [isAdmin]);

  // Detay drawer için tek kullanıcının harf kırılımını yükle
  useEffect(() => {
    if (!selectedUid) { setUserLetters([]); return; }
    void (async () => {
      const sb = supabase as unknown as { from: (t: string) => any };
      const { data } = await sb.from("analytics_user_letter_breakdown")
        .select("*").eq("user_id", selectedUid).order("learned_at", { ascending: true });
      setUserLetters((data as UserLetter[]) ?? []);
    })();
  }, [selectedUid]);


  if (authLoading || subLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!session) return <Navigate to="/giris" replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 text-center">
        <PageHeader title="🛡️ Admin" backTo="/" centered />
        <p className="mt-12 text-muted-foreground font-bold">Bu sayfayı görmek için yönetici rolüne sahip olmalısın.</p>
      </div>
    );
  }

  const stepOrder = ["viewed", "plan_selected", "checkout_started", "purchased", "abandoned"];
  const funnelSorted = [...funnel].sort((a, b) => stepOrder.indexOf(a.step) - stepOrder.indexOf(b.step));

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <main className="container mx-auto max-w-5xl px-4 pb-24">
        <PageHeader title="🛡️ Admin Panel" backTo="/" centered />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <KPIs daily={daily} pop={pop} funnel={funnel} />

            <Card title="👤 Profil Bazlı İlerleme">
              <div className="flex flex-wrap gap-2 mb-3 text-xs">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rumuz ara…"
                  className="flex-1 min-w-[140px] rounded-lg border-2 border-border bg-background px-2 py-1"
                />
                {(["all", "super", "normal"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilterMode(m)}
                    className={cn(
                      "rounded-lg px-2 py-1 font-bold border-2",
                      filterMode === m ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border"
                    )}
                  >
                    {m === "all" ? "Hepsi" : m === "super" ? "⚡ Süper" : "🎮 Normal"}
                  </button>
                ))}
              </div>
              <Table headers={["Rumuz", "Yaş", "Mod", "Öğrendiği", "Bildiği", "Ort sn/öğe", "Saat/öğe", "Doğruluk %", "Son aktif"]}>
                {users
                  .filter((u) => filterMode === "all" || u.primary_mode === filterMode)
                  .filter((u) => !search || u.pseudonym.toLowerCase().includes(search.toLowerCase()))
                  .map((u) => (
                    <tr
                      key={u.user_id}
                      onClick={() => setSelectedUid(u.user_id)}
                      className="border-t cursor-pointer hover:bg-muted/40"
                    >
                      <td className="py-1.5 font-extrabold">{u.pseudonym}</td>
                      <td>{u.age_band ?? "—"}</td>
                      <td>{u.primary_mode === "super" ? "⚡" : "🎮"}</td>
                      <td>{u.learned_items}</td>
                      <td>{u.known_items}</td>
                      <td>{u.avg_seconds_per_learned_item ?? "—"}</td>
                      <td>{u.items_per_active_hour ?? "—"}</td>
                      <td>{u.accuracy_pct ?? "—"}</td>
                      <td className="text-[10px]">{u.last_active ? new Date(u.last_active).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                {users.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-3">Henüz veri yok.</td></tr>}
              </Table>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Sadece analitik iznini açan kullanıcılar listelenir. İsim/e-posta gösterilmez.
              </p>
            </Card>

            {selectedUid && (
              <Card title={`🔍 Profil Detayı — ${users.find((x) => x.user_id === selectedUid)?.pseudonym ?? selectedUid.slice(0, 6)}`}>
                <button onClick={() => setSelectedUid(null)} className="mb-2 text-xs underline">← Kapat</button>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {userModes.filter((m) => m.user_id === selectedUid).map((m) => (
                    <div key={m.mode} className="rounded-xl bg-muted/40 p-3 text-xs">
                      <div className="font-extrabold">{m.mode === "super" ? "⚡ Süper" : "🎮 Normal"}</div>
                      <div>Olay: <b>{m.events}</b> • Doğru: <b>{m.correct}</b></div>
                      <div>Ort. sn: <b>{m.avg_seconds ?? "—"}</b> • Doğruluk: <b>{m.accuracy_pct ?? "—"}%</b></div>
                    </div>
                  ))}
                </div>
                <Table headers={["Konu", "Harf", "Seviye", "Biliyordu", "Öğrenme sn", "Doğru/Görüldü"]}>
                  {userLetters.map((r) => (
                    <tr key={r.topic_id + r.letter_id} className="border-t">
                      <td className="py-1.5 font-semibold">{r.topic_id}</td>
                      <td>{r.letter_id}</td>
                      <td>L{r.level}</td>
                      <td>{r.knew_before === true ? "✓" : r.knew_before === false ? "—" : "?"}</td>
                      <td>{r.seconds_to_learn ?? "—"}</td>
                      <td>{r.correct_count}/{r.shown_count}</td>
                    </tr>
                  ))}
                  {userLetters.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-3">Henüz harf verisi yok.</td></tr>}
                </Table>
              </Card>
            )}


            <Card title="🆚 Süper Öğrenme vs Normal Mod">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="pb-1">Mod</th><th>Kişi</th><th>Oturum</th><th>Ort. sn</th><th>Tamamlama %</th><th>Doğruluk %</th>
                  </tr></thead>
                  <tbody>
                    {svn.map((r) => (
                      <tr key={r.mode} className="border-t">
                        <td className="py-1.5 font-extrabold capitalize">{r.mode === "super" ? "⚡ Süper" : "🎮 Normal"}</td>
                        <td>{r.users}</td><td>{r.sessions}</td>
                        <td>{r.avg_seconds ?? "—"}</td><td>{r.completion_pct ?? "—"}</td><td>{r.accuracy_pct ?? "—"}</td>
                      </tr>
                    ))}
                    {svn.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-3">Henüz yeterli veri yok.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="⚡ Öğrenme Hızı (dakikada yeni öğe, bildiği harfler hariç)">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mode" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="items_per_hour" fill="#10b981" name="Saatte öğe" />
                  <Bar dataKey="items_per_minute" fill="#3b82f6" name="Dakikada öğe" />
                </BarChart>
              </ResponsiveContainer>
              <Table headers={["Mod", "Öğrenen", "Öğrenilen öğe", "Aktif dakika", "Dakika/öğe", "Saat/öğe"]}>
                {rate.map((r) => (
                  <tr key={r.mode} className="border-t">
                    <td className="py-1.5 font-extrabold capitalize">{r.mode === "super" ? "⚡ Süper" : "🎮 Normal"}</td>
                    <td>{r.learners}</td><td>{r.learned_items}</td>
                    <td>{r.active_minutes ?? "—"}</td><td>{r.items_per_minute ?? "—"}</td><td>{r.items_per_hour ?? "—"}</td>
                  </tr>
                ))}
                {rate.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground py-3">Henüz veri yok.</td></tr>}
              </Table>
            </Card>

            <Card title="🕒 Oyun Süresi (toplam dakika, mod kırılımı)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={engage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="game_id" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_minutes" fill="#f59e0b" name="Toplam dakika" />
                </BarChart>
              </ResponsiveContainer>
              <Table headers={["Oyun", "Mod", "Oturum", "Kişi", "Toplam dk", "Ort. sn", "Tamamlama %", "Doğruluk %"]}>
                {engage.map((r) => (
                  <tr key={r.game_id + r.mode} className="border-t">
                    <td className="py-1.5 font-semibold">{r.game_id}</td>
                    <td className="capitalize">{r.mode === "super" ? "⚡" : "🎮"} {r.mode}</td>
                    <td>{r.sessions}</td><td>{r.unique_users}</td>
                    <td>{r.total_minutes ?? "—"}</td><td>{r.avg_seconds ?? "—"}</td>
                    <td>{r.completion_pct ?? "—"}</td><td>{r.accuracy_pct ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </Card>

            <Card title="🔁 Retention (haftalık kohort)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={retention}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cohort_week" tickFormatter={(d) => d?.slice(5) ?? ""} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="d1_pct" stroke="#3b82f6" strokeWidth={2} name="D1 %" />
                  <Line type="monotone" dataKey="d7_pct" stroke="#10b981" strokeWidth={2} name="D7 %" />
                  <Line type="monotone" dataKey="d30_pct" stroke="#f59e0b" strokeWidth={2} name="D30 %" />
                </LineChart>
              </ResponsiveContainer>
              <Table headers={["Hafta", "Kohort", "D1 %", "D7 %", "D30 %"]}>
                {retention.map((r) => (
                  <tr key={r.cohort_week} className="border-t">
                    <td className="py-1.5 font-semibold">{r.cohort_week}</td>
                    <td>{r.cohort_size}</td>
                    <td>{r.d1_pct ?? "—"}</td><td>{r.d7_pct ?? "—"}</td><td>{r.d30_pct ?? "—"}</td>
                  </tr>
                ))}
                {retention.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-3">Henüz yeterli kohort yok.</td></tr>}
              </Table>
            </Card>


            <Card title="⚡ Öğrenme Gücü (gerçek soru süresi, bildiği harfler hariç)">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Yeni öğrenilen öğe" value={power?.learned_items ?? 0} />
                <KPI label="Öğrenen kişi" value={power?.learners ?? 0} />
                <KPI label="Ort. saniye / öğe" value={power?.avg_seconds_per_item ?? "—"} />
                <KPI label="Ort. dakika / öğe" value={power?.avg_minutes_per_item ?? "—"} />
              </div>
              <Table headers={["Konu", "Öğe", "Öğrenen", "Ort. saniye", "Önceden biliyordu"]}>
                {letterPower.map((r) => (
                  <tr key={r.topic_id + r.letter_id} className="border-t">
                    <td className="py-1.5 font-semibold">{r.topic_id}</td>
                    <td>{r.letter_id}</td>
                    <td>{r.learners}</td>
                    <td>{r.avg_seconds ?? "—"}</td>
                    <td>{r.knew_before_count}</td>
                  </tr>
                ))}
                {letterPower.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-3">Henüz yeterli veri yok.</td></tr>}
              </Table>
            </Card>


            <Card title="📅 Günlük Aktif Kullanıcı (DAU)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="dau" stroke="#3b82f6" strokeWidth={2} name="DAU" />
                  <Line type="monotone" dataKey="sessions" stroke="#f59e0b" strokeWidth={2} name="Oturum" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="🎮 Oyun Popülerliği">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pop}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="game_id" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="session_count" fill="#3b82f6" name="Oturum" />
                  <Bar dataKey="unique_users" fill="#10b981" name="Tekil kullanıcı" />
                </BarChart>
              </ResponsiveContainer>
              <Table headers={["Oyun", "Oturum", "Kişi", "Ort. sn", "Tamamlama %", "Doğruluk %"]}>
                {pop.map((r) => (
                  <tr key={r.game_id} className="border-t">
                    <td className="py-1.5 font-semibold">{r.game_id}</td>
                    <td>{r.session_count}</td>
                    <td>{r.unique_users}</td>
                    <td>{r.avg_seconds ?? "—"}</td>
                    <td>{r.completion_pct ?? "—"}</td>
                    <td>{r.accuracy_pct ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </Card>

            <Card title="⏱️ Harf/Öğe Öğrenme Süresi (Level 4'e ulaşma, dakika)">
              <Table headers={["Konu", "Öğe", "Öğrenen", "Ort. dakika"]}>
                {learn.map((r) => (
                  <tr key={r.topic_id + r.letter_id} className="border-t">
                    <td className="py-1.5 font-semibold">{r.topic_id}</td>
                    <td>{r.letter_id}</td>
                    <td>{r.learners}</td>
                    <td>{r.avg_minutes ?? "—"}</td>
                  </tr>
                ))}
                {learn.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-3">Henüz veri yok.</td></tr>}
              </Table>
            </Card>

            <Card title="💳 Ödeme Funnel'i">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={funnelSorted} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="step" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="users" fill="#8b5cf6" name="Kullanıcı" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="👥 Yaş & Cinsiyet Dağılımı">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={ages} dataKey="users" nameKey="age_band" label>
                    {ages.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Table headers={["Yaş", "Cinsiyet", "Kişi", "Oturum", "Doğruluk %"]}>
                {ages.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 font-semibold">{r.age_band}</td>
                    <td>{r.gender}</td>
                    <td>{r.users}</td>
                    <td>{r.sessions}</td>
                    <td>{r.accuracy_pct ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </Card>

            <p className="text-xs text-muted-foreground text-center pt-4 flex items-center justify-center gap-2">
              <Shield className="h-3 w-3" /> Tüm veriler anonim toplulaştırılmıştır.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

function KPIs({ daily, pop, funnel }: { daily: Daily[]; pop: Pop[]; funnel: Funnel[] }) {
  const totalDau = daily[daily.length - 1]?.dau ?? 0;
  const totalSessions = pop.reduce((s, r) => s + r.session_count, 0);
  const viewed = funnel.find((f) => f.step === "viewed")?.users ?? 0;
  const purchased = funnel.find((f) => f.step === "purchased")?.users ?? 0;
  const convPct = viewed > 0 ? Math.round((purchased / viewed) * 1000) / 10 : 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="Bugün DAU" value={totalDau} />
      <KPI label="Toplam oturum" value={totalSessions} />
      <KPI label="Paywall görüntüleme" value={viewed} />
      <KPI label="Dönüşüm %" value={convPct} />
    </div>
  );
}
function KPI({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft border-2 border-border/40">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="text-2xl font-extrabold text-primary">{value}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-card border-2 border-border/40">
      <h2 className="font-extrabold mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground">
          {headers.map((h) => <th key={h} className="pb-1 font-bold">{h}</th>)}
        </tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default Admin;
