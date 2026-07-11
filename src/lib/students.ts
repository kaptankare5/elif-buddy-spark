// Hoca Modu — cihazda birden çok öğrenci profili.
// Hoca telefonuna öğrenciler kaydeder; profil değiştirince tüm ilerleme
// (harf seviyeleri, kilitli bölümler, konu kilitleri) o öğrencinin verisiyle
// kaldığı yerden devam eder. Veri cihazda yaşar (buluta yazılmaz).
import { useEffect, useState } from "react";
import { setActiveStudentScope, getActiveStudentScope } from "@/data/srs";

export interface Student {
  id: string;
  name: string;
  emoji: string; // avatar
  // Bulut senkronu (studentSync.ts): öğrenci buluta bağlıysa Supabase
  // students.id ve 6 haneli paylaşım kodu burada tutulur. Kod başka
  // cihazda girilince aynı öğrenciye bağlanılır, ilerleme birleşir.
  cloudId?: string;
  linkCode?: string;
}

const KEY = "elifba-students-v1";
export const STUDENT_EVENT = "elifba-student-changed";

const AVATARS = ["🦁", "🐱", "🐰", "🐼", "🦊", "🐨", "🐧", "🦉", "🐢", "🦋", "🐠", "🌟"];

function loadList(): Student[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((s) => s && s.id && s.name) : [];
  } catch { return []; }
}

function saveList(list: Student[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(STUDENT_EVENT));
  } catch { /* ignore */ }
}

export function getStudents(): Student[] { return loadList(); }

export function addStudent(name: string): Student | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const list = loadList();
  const s: Student = {
    id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: trimmed.slice(0, 24),
    emoji: AVATARS[list.length % AVATARS.length],
  };
  saveList([...list, s]);
  return s;
}

export function updateStudent(id: string, patch: Partial<Omit<Student, "id">>): Student | null {
  const list = loadList();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  saveList(list);
  return list[i];
}

export function getStudentByCloudId(cloudId: string): Student | null {
  return loadList().find((s) => s.cloudId === cloudId) ?? null;
}

// Bulutta zaten var olan bir öğrenciyi (bağlantı koduyla gelen) yerel listeye ekler.
export function addLinkedStudent(cloud: { cloudId: string; name: string; emoji: string; linkCode: string }): Student {
  const existing = getStudentByCloudId(cloud.cloudId);
  if (existing) return existing;
  const list = loadList();
  const s: Student = {
    id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name: cloud.name.slice(0, 24),
    emoji: cloud.emoji || AVATARS[list.length % AVATARS.length],
    cloudId: cloud.cloudId,
    linkCode: cloud.linkCode,
  };
  saveList([...list, s]);
  return s;
}

export function removeStudent(id: string) {
  saveList(loadList().filter((s) => s.id !== id));
  // Aktif silinirse cihaz sahibine dön. İlerleme verisi de temizlenir.
  if (getActiveStudentScope() === id) setActiveStudentScope(null);
  for (const ns of ["quiz", "games"]) {
    try { localStorage.removeItem(`elifba-srs-${ns}-student-${id}-v1`); } catch { /* */ }
  }
}

export function getActiveStudent(): Student | null {
  const id = getActiveStudentScope();
  if (!id) return null;
  return loadList().find((s) => s.id === id) ?? null;
}

// Profil değiştir: null = cihaz sahibi ("Ben"). SRS kapsamı anında değişir,
// tüm ekranlar olaylarla tazelenir — öğrenci kaldığı yerden devam eder.
export function switchStudent(id: string | null) {
  setActiveStudentScope(id);
  try { window.dispatchEvent(new Event(STUDENT_EVENT)); } catch { /* ignore */ }
  // Buluta bağlı öğrenciye geçiliyorsa diğer cihazlardaki ilerlemeyi çek
  // (fire-and-forget; birleşince ekranlar olaylarla tazelenir).
  if (id) {
    import("@/lib/studentSync")
      .then(({ pullStudentFromCloud }) => pullStudentFromCloud(id))
      .catch(() => {});
  }
}

// Aktif öğrenci + liste; değişiklikte otomatik tazelenir.
export function useStudents(): { students: Student[]; active: Student | null } {
  const [state, setState] = useState(() => ({ students: getStudents(), active: getActiveStudent() }));
  useEffect(() => {
    const h = () => setState({ students: getStudents(), active: getActiveStudent() });
    window.addEventListener(STUDENT_EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(STUDENT_EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return state;
}
