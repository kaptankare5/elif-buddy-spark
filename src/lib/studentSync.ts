// Öğrenci profillerinin BULUT SENKRONU.
// Senaryo: hoca camide kendi telefonunda öğrenciyi çalıştırır → öğrenci
// profili buluta bağlıdır ve her cevap student_letter_stats'e yazılır.
// Evde anne kendi hesabıyla girip 6 haneli BAĞLANTI KODUNU girer →
// aynı öğrenci onun cihazına da eklenir, ilerleme buluttan birleşir ve
// çocuk kaldığı yerden devam eder. Yazılan her cevap iki yönde de senkron.
//
// Local-first ilkesi korunur: bulut yazımı fire-and-forget'tir, birleşmede
// "daha çok karşılaşma görmüş kayıt kazanır" (bkz. srs.ts mergeIntoStudentSrs).
import { supabase } from "@/integrations/supabase/client";
import {
  type LetterSrsEntry,
  type Level,
  type Namespace,
  type SrsState,
  readStudentSrs,
  mergeIntoStudentSrs,
} from "@/data/srs";
import { findTopicOfItem } from "@/data/subjects";
import {
  type Student,
  getStudents,
  updateStudent,
  addLinkedStudent,
  getStudentByCloudId,
} from "@/lib/students";

const NAMESPACES: Namespace[] = ["quiz", "games"];

interface StudentStatRow {
  student_id: string;
  ns: string;
  topic_id: string;
  letter_id: string;
  level: number;
  shown_count: number;
  correct_count: number;
  consecutive_correct: number;
  knew_before: boolean | null;
  learned_at: string | null;
  time_to_learn_ms: number | null;
  total_response_ms: number;
  last_seen_at: string | null;
}

async function currentUid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch { return null; }
}

function rowToEntry(r: StudentStatRow): LetterSrsEntry {
  return {
    level: Math.max(1, Math.min(4, r.level || 1)) as Level,
    correct: r.correct_count || 0,
    total: r.shown_count || 0,
    seen: r.shown_count || 0,
    lastSeen: r.last_seen_at ? new Date(r.last_seen_at).getTime() : 0,
    totalMs: r.total_response_ms ?? 0,
    msToLearn: r.time_to_learn_ms ?? undefined,
    knewBefore: r.knew_before ?? undefined,
    learnedAt: r.learned_at ? new Date(r.learned_at).getTime() : undefined,
    consecutiveCorrect: r.consecutive_correct ?? 0,
  };
}

function entryToRow(
  cloudId: string,
  ns: Namespace,
  topicId: string,
  letterId: string,
  e: LetterSrsEntry,
): StudentStatRow {
  return {
    student_id: cloudId,
    ns,
    topic_id: topicId,
    letter_id: letterId,
    level: e.level,
    shown_count: e.total,
    correct_count: e.correct,
    consecutive_correct: e.consecutiveCorrect ?? 0,
    knew_before: e.knewBefore ?? null,
    learned_at: e.learnedAt ? new Date(e.learnedAt).toISOString() : null,
    time_to_learn_ms: e.msToLearn ?? null,
    total_response_ms: e.totalMs ?? 0,
    last_seen_at: e.lastSeen ? new Date(e.lastSeen).toISOString() : new Date().toISOString(),
  };
}

// ---- Öğrenciyi buluta bağla ------------------------------------------------
// Yerel öğrenci için bulutta kayıt açar, bağlantı kodunu alır ve cihazdaki
// mevcut ilerlemesini yükler. Giriş yapılmamışsa sessizce null döner.
export async function connectStudentToCloud(student: Student): Promise<Student | null> {
  if (student.cloudId) return student;
  const uid = await currentUid();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("students")
    .insert({ owner_id: uid, name: student.name, emoji: student.emoji })
    .select("id, link_code")
    .single();
  if (error || !data) return null;
  const updated = updateStudent(student.id, { cloudId: data.id, linkCode: data.link_code });
  await uploadStudentToCloud(updated ?? { ...student, cloudId: data.id });
  return updated;
}

// Cihazdaki tüm SRS verisini öğrencinin bulut kaydına yazar (ilk bağlanmada).
export async function uploadStudentToCloud(student: Student): Promise<void> {
  if (!student.cloudId) return;
  for (const ns of NAMESPACES) {
    const state = readStudentSrs(student.id, ns);
    const rows: StudentStatRow[] = [];
    for (const [topicId, letters] of Object.entries(state)) {
      for (const [letterId, e] of Object.entries(letters)) {
        if ((e.total ?? 0) > 0) rows.push(entryToRow(student.cloudId, ns, topicId, letterId, e));
      }
    }
    if (rows.length === 0) continue;
    await supabase
      .from("student_letter_stats")
      .upsert(rows, { onConflict: "student_id,ns,topic_id,letter_id" });
  }
}

// ---- Cevap bazlı push (recordSrsAnswer'dan çağrılır) -----------------------
export async function pushStudentEntryByLocalId(
  localStudentId: string,
  ns: Namespace,
  topicId: string,
  letterId: string,
  entry: LetterSrsEntry,
): Promise<void> {
  const student = getStudents().find((s) => s.id === localStudentId);
  if (!student?.cloudId) return; // buluta bağlı değil — yerelde kalır
  const uid = await currentUid();
  if (!uid) return;
  await supabase
    .from("student_letter_stats")
    .upsert(entryToRow(student.cloudId, ns, topicId, letterId, entry), {
      onConflict: "student_id,ns,topic_id,letter_id",
    });
}

// ---- Pull: buluttaki ilerlemeyi yereldekiyle birleştir ---------------------
export async function pullStudentFromCloud(localStudentId: string): Promise<boolean> {
  const student = getStudents().find((s) => s.id === localStudentId);
  if (!student?.cloudId) return false;
  const uid = await currentUid();
  if (!uid) return false;
  const { data, error } = await supabase
    .from("student_letter_stats")
    .select("student_id, ns, topic_id, letter_id, level, shown_count, correct_count, consecutive_correct, knew_before, learned_at, time_to_learn_ms, total_response_ms, last_seen_at")
    .eq("student_id", student.cloudId);
  if (error || !data) return false;
  const byNs: Record<Namespace, SrsState> = { quiz: {}, games: {} };
  for (const r of data as StudentStatRow[]) {
    const ns: Namespace = r.ns === "games" ? "games" : "quiz";
    // Konu kimliği müfredat değişse de öğe kimliğinden bulunur (cloudSync ile aynı kural)
    const topicId = findTopicOfItem(r.letter_id)?.topicId ?? r.topic_id;
    if (!byNs[ns][topicId]) byNs[ns][topicId] = {};
    byNs[ns][topicId][r.letter_id] = rowToEntry(r);
  }
  for (const ns of NAMESPACES) mergeIntoStudentSrs(student.id, ns, byNs[ns]);
  return true;
}

// ---- Bağlantı kodu ile öğrenciye bağlan ------------------------------------
// Kod doğruysa çağıran hesap öğrencinin "velisi" olur; öğrenci bu cihazın
// listesine eklenir ve ilerlemesi buluttan çekilir.
export async function claimStudentByCode(code: string): Promise<Student> {
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 4) throw new Error("Kod çok kısa.");
  const { data, error } = await supabase.rpc("claim_student_by_code", { _code: trimmed });
  if (error) {
    if (error.message.includes("invalid_link_code")) throw new Error("Bu koda ait öğrenci bulunamadı.");
    if (error.message.includes("not_authenticated")) throw new Error("Önce giriş yapmalısın.");
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Bu koda ait öğrenci bulunamadı.");
  const student = addLinkedStudent({
    cloudId: row.id,
    name: row.name,
    emoji: row.emoji,
    linkCode: row.link_code,
  });
  await pullStudentFromCloud(student.id).catch(() => {});
  return student;
}

// ---- Hesabımdaki bulut öğrencilerini bu cihaza getir -----------------------
// (Hoca yeni telefon aldı / uygulamayı sildi kurdu: giriş yapınca sahibi
// olduğu ve veli olarak bağlandığı tüm öğrenciler geri gelir.)
export async function fetchMyCloudStudents(): Promise<Student[]> {
  const uid = await currentUid();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("students")
    .select("id, name, emoji, link_code")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const added: Student[] = [];
  for (const row of data) {
    const existing = getStudentByCloudId(row.id);
    const student = existing ?? addLinkedStudent({
      cloudId: row.id,
      name: row.name,
      emoji: row.emoji,
      linkCode: row.link_code,
    });
    added.push(student);
    await pullStudentFromCloud(student.id).catch(() => {});
  }
  return added;
}
