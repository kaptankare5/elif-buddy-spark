// YERLEŞTİRME ("Test Out") + ARA-KONTROL (back-check) + ZAYIFLIK TAKİBİ.
//
// İKİ KATMAN (kritik ayrım):
//  1) Konu "atlandı" bayrağı (skipped): 4/4 hızlı-geçiş sınavını geçince set
//     edilir. SONRAKİ konuyu AÇAR ama konunun öğelerini SAHTE ustalaştırmaz —
//     öğeler "görülmemiş" kalır (LevelBadge'de YENİ). Böylece cevaplanmamış
//     harfler asla L4 gibi görünmez (kullanıcı şartı).
//  2) Dürüst öğe-SRS'i ayrı yaşar: ara-kontrol soruları gerçek SRS'e işlenir,
//     harfler yoklandıkça gerçek seviyelerini kazanır.
//
// DENEME SÜRESİ (probation): atlanan konu hemen güvenilmez; ilk oturumlarda
// YOĞUN yoklanır (yüksek back-check oranı). Birkaç iyi yoklamayla "onaylanır"
// → radar seyrelir. Yoklamalar kötüyse "zayıf" olur ve AÇIĞA ORANTILI ağırlıkla
// geri çağrılır (sert geri-kilit YOK — konu açık kalır, sadece soru payı artar,
// tavan ~%80). Böylece şansla/tesadüfle geçen çocuk erken yakalanır ve çürük
// temel, çocuğu matematiksel olarak kendine çeker.

import { getActiveStudentScope } from "@/data/srs";
import { getAllTopics } from "@/data/subjects";

const EVENT = "elifba-placement-updated";
const KEY = () => {
  const s = getActiveStudentScope();
  return s ? `elifba-placement-student-${s}-v1` : `elifba-placement-guest-v1`;
};

export interface TopicPlacement {
  skipped?: boolean;
  skippedAt?: number;
  confirmed?: boolean; // deneme süresi geçildi (radar seyreldi)
  bc: boolean[];       // son ara-kontrol sonuçları (en çok BC_WINDOW)
}
type PlacementState = Record<string, TopicPlacement>;

const BC_WINDOW = 8;
const PROBATION_RATE = 0.35; // deneme süresi: yoğun yoklama
const RADAR_RATE = 0.10;     // onaylanmış sağlıklı: hafif bakım radarı
const SHAKY_RATE = 0.35;     // sallantılı (%50–75): pekiştir
const MAX_BACKCHECK = 0.80;  // zayıf konu tavanı (fiilen geri çeker)
const CONFIRM_AFTER = 4;     // bu kadar iyi yoklamadan sonra onayla
const WEAK_THRESHOLD = 0.50; // bunun altı doğruluk = zayıf
const MIN_SAMPLES = 3;       // sınıflandırma için en az yoklama sayısı

function load(): PlacementState {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY()) || "{}"); } catch { return {}; }
}

function save(s: PlacementState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch { /* */ }
  // Var olan SRS tick'lerini de tetikle → Topic/Index/DebugHud tazelensin.
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* */ }
  try { window.dispatchEvent(new Event("elifba-srs-quiz-updated")); } catch { /* */ }
  try { window.dispatchEvent(new Event("elifba-progress-updated")); } catch { /* */ }
}

function accuracy(bc: boolean[]): number | null {
  if (!bc || bc.length === 0) return null;
  return bc.filter(Boolean).length / bc.length;
}

export function getPlacement(topicId: string): TopicPlacement | null {
  return load()[topicId] ?? null;
}

export function isTopicSkipped(topicId: string): boolean {
  return !!load()[topicId]?.skipped;
}

// Hızlı-geçiş sınavı geçildi → konuyu "atlandı" işaretle (öğeler görülmemiş
// kalır; sonraki konu açılır). Deneme süresi başlar.
export function markTopicSkipped(topicId: string) {
  const s = load();
  s[topicId] = { skipped: true, skippedAt: Date.now(), confirmed: false, bc: [] };
  save(s);
}

// Bir konudan ara-kontrol sorusu gelme olasılığı (0..MAX_BACKCHECK).
// Yoklama verisi açığın büyüklüğüne göre oranı belirler.
export function backCheckPressure(topicId: string): number {
  const p = load()[topicId];
  if (!p?.skipped) return 0;
  const bc = p.bc ?? [];
  const acc = accuracy(bc);
  if (bc.length >= MIN_SAMPLES && acc !== null) {
    if (acc < WEAK_THRESHOLD) {
      // ZAYIF: açığa orantılı tırmanış. gap 0.5→%50 pay, gap 1→%80 pay.
      const gap = 1 - acc; // 0.5 .. 1
      return Math.min(MAX_BACKCHECK, 0.5 + (gap - 0.5) * 0.6);
    }
    if (acc < 0.75) return SHAKY_RATE; // sallantılı → pekiştir
  }
  if (!p.confirmed) return PROBATION_RATE; // deneme süresi
  return RADAR_RATE; // onaylanmış sağlıklı
}

// Şu anki konuda, ondan ÖNCEKİ atlanmış konulardan bir ara-kontrol yapılsın mı?
// Yapılacaksa hangi konudan? (zayıf konu baskın çıkar). null = bu sefer yok.
export function pickBackCheckTopic(currentTopicId: string): string | null {
  const topics = getAllTopics();
  const idx = topics.findIndex((t) => t.id === currentTopicId);
  if (idx <= 0) return null;
  const earlier = topics.slice(0, idx).filter((t) => isTopicSkipped(t.id));
  if (earlier.length === 0) return null;
  const pressures = earlier.map((t) => ({ id: t.id, p: backCheckPressure(t.id) })).filter((x) => x.p > 0);
  if (pressures.length === 0) return null;
  // Toplam oran = en zayıf konunun baskısı (tek çürük temel havuzu ele geçirir).
  const maxP = Math.max(...pressures.map((x) => x.p));
  if (Math.random() > maxP) return null; // bu sefer ara-kontrol yok
  // Baskıya göre ağırlıklı seç.
  const total = pressures.reduce((a, x) => a + x.p, 0);
  let r = Math.random() * total;
  for (const x of pressures) { r -= x.p; if (r <= 0) return x.id; }
  return pressures[pressures.length - 1].id;
}

// Debug için: en son ara-kontrol.
let _lastBackCheck: { topicId: string; correct: boolean; at: number } | null = null;
export function getLastBackCheck() { return _lastBackCheck; }

// Ara-kontrol cevabını kaydet → deneme süresi/zayıflık durumunu güncelle.
// (Öğenin gerçek SRS'i ayrıca recordSrsAnswer ile işlenir — burası yalnız
// konu-düzeyi durum.)
export function recordBackCheck(topicId: string, correct: boolean) {
  const s = load();
  const p = s[topicId] ?? (s[topicId] = { skipped: true, bc: [] });
  p.bc = [...(p.bc ?? []), correct].slice(-BC_WINDOW);
  const acc = accuracy(p.bc);
  if (!p.confirmed && p.bc.length >= CONFIRM_AFTER && acc !== null && acc >= 0.75) {
    p.confirmed = true;
  }
  _lastBackCheck = { topicId, correct, at: Date.now() };
  save(s);
}

// ---- DEBUG (yalnız test modunda HUD'da) ----
export interface PlacementDebugRow {
  topicId: string;
  title: string;
  status: "deneme" | "onaylı" | "sallantı" | "zayıf";
  bcAcc: number | null;
  bcN: number;
  pressure: number;
}
export function getPlacementDebug(): PlacementDebugRow[] {
  const s = load();
  const rows: PlacementDebugRow[] = [];
  for (const t of getAllTopics()) {
    const p = s[t.id];
    if (!p?.skipped) continue;
    const bc = p.bc ?? [];
    const acc = accuracy(bc);
    let status: PlacementDebugRow["status"];
    if (bc.length >= MIN_SAMPLES && acc !== null && acc < WEAK_THRESHOLD) status = "zayıf";
    else if (bc.length >= MIN_SAMPLES && acc !== null && acc < 0.75) status = "sallantı";
    else if (!p.confirmed) status = "deneme";
    else status = "onaylı";
    rows.push({
      topicId: t.id, title: t.title, status,
      bcAcc: acc, bcN: bc.length, pressure: +backCheckPressure(t.id).toFixed(2),
    });
  }
  return rows;
}

// Cihazdaki tüm yerleştirme verisini sil (test/sıfırlama için).
export function resetPlacement() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY()); } catch { /* */ }
  save({});
}
