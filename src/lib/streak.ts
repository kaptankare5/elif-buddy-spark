// Günlük çalışma serisi (streak) — alışkanlık döngüsü mekaniği.
// Davranış bilimi: görünür, kırılabilir bir seri (🔥) günlük geri dönüşü
// güçlendirir (Duolingo etkisi; hedef gradyanı + kayıptan kaçınma).
// Çocuk dostu kural: seri yalnızca İLERİ gider ya da sıfırlanır; ceza,
// bildirim baskısı veya "seri donduruma satışı" yok.
const KEY = "elifba-streak-v1";
const EVENT = "elifba-streak-updated";

export interface StreakState {
  last: string;   // son aktif gün (YYYY-M-D, yerel saat)
  count: number;  // ardışık gün sayısı
  best: number;   // en iyi seri
}

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadState(): StreakState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as StreakState;
      if (typeof p.count === "number" && typeof p.last === "string") {
        return { last: p.last, count: p.count, best: p.best || p.count };
      }
    }
  } catch { /* ignore */ }
  return { last: "", count: 0, best: 0 };
}

function saveState(s: StreakState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new Event(EVENT));
  } catch { /* ignore */ }
}

// Her cevapta çağrılır (srs.ts). Aynı gün içinde no-op — ucuz.
export function recordStreakActivity() {
  if (typeof window === "undefined") return;
  const s = loadState();
  const today = dayStr(new Date());
  if (s.last === today) return;
  const yesterday = dayStr(new Date(Date.now() - 86_400_000));
  const count = s.last === yesterday ? s.count + 1 : 1;
  saveState({ last: today, count, best: Math.max(s.best, count) });
}

// Görüntüleme: bugün veya dün aktifse seri yaşıyor; daha eskiyse 0 göster.
export function getStreak(): { count: number; best: number; activeToday: boolean } {
  if (typeof window === "undefined") return { count: 0, best: 0, activeToday: false };
  const s = loadState();
  const today = dayStr(new Date());
  const yesterday = dayStr(new Date(Date.now() - 86_400_000));
  if (s.last === today) return { count: s.count, best: s.best, activeToday: true };
  if (s.last === yesterday) return { count: s.count, best: s.best, activeToday: false };
  return { count: 0, best: s.best, activeToday: false };
}

export const STREAK_EVENT = EVENT;
