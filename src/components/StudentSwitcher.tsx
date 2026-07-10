import { useState } from "react";
import { X, Check, UserRound } from "lucide-react";
import { useStudents, switchStudent } from "@/lib/students";
import { cn } from "@/lib/utils";

// Hoca Modu profil değiştirici — öğrenci varsa her sayfa başlığında görünür.
// Tek dokunuşla öğrenci seçilir; seçilen öğrencinin tüm ilerlemesi
// (seviyeler, kilitli bölümler) anında yüklenir, kaldığı yerden devam eder.
export function StudentSwitcher() {
  const { students, active } = useStudents();
  const [open, setOpen] = useState(false);

  if (students.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Öğrenci değiştir"
        title={active ? `Öğrenci: ${active.name}` : "Cihaz sahibi"}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-info to-primary text-white text-xl shadow-card border-2 border-white/50 active:scale-90 transition-bouncy"
      >
        {active ? <span>{active.emoji}</span> : <UserRound className="h-5 w-5" />}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-card border-2 border-primary/20 shadow-elegant p-5 animate-bounce-in max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-foreground">👨‍🏫 Öğrenci Seç</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs font-bold text-muted-foreground">
              Her öğrencinin ilerlemesi ayrı tutulur — seçince kaldığı yerden devam eder.
            </p>

            <div className="space-y-2">
              {/* Cihaz sahibi (hoca) */}
              <button
                onClick={() => { switchStudent(null); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-bouncy active:scale-[0.98]",
                  !active ? "border-primary bg-primary/10" : "border-border bg-muted/40",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-xl">🧑</span>
                <span className="flex-1 font-extrabold text-foreground">Ben (Cihaz sahibi)</span>
                {!active && <Check className="h-5 w-5 text-primary" />}
              </button>

              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { switchStudent(s.id); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-bouncy active:scale-[0.98]",
                    active?.id === s.id ? "border-primary bg-primary/10" : "border-border bg-muted/40",
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-info/15 text-xl">{s.emoji}</span>
                  <span className="flex-1 font-extrabold text-foreground truncate">{s.name}</span>
                  {active?.id === s.id && <Check className="h-5 w-5 text-primary" />}
                </button>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] font-bold text-muted-foreground">
              Öğrenci eklemek/silmek için: Ayarlar → Hoca Modu
            </p>
          </div>
        </div>
      )}
    </>
  );
}
