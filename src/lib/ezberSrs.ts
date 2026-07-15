// Ezber SRS'i — harf SRS'iyle aynı bilimsel omurga, ezbere uyarlanmış:
//
// 1) SIRALI AÇILIM (hafızlık usulü): parça N+1 ancak N seviye 2'ye
//    ulaşınca tanıtılır — sure baştan sona zincir halinde kurulur.
// 2) SEVİYELER L1-4: doğru = +1 seviye; L3→L4 üst üste 2 doğru ister;
//    YANLIŞ = -2 seviye (harf SRS'indeki kullanıcı kuralıyla aynı) ve
//    parça tekrar kuyruğuna girer → kısa sürede yeniden sorulur.
// 3) ZAYIF ÖNCELİĞİ: soru seçiminde ağırlıklar L1 %55, L2 %20, L3 %15,
//    L4 %10 — bilinmeyen daha sık, bilinen arada bir (unutma eğrisi).
// 4) BAĞLAM SOLDURMA (expanding recall): seviye yükseldikçe gösterilen
//    önceki-parça ipucu azalır (L1-2: 2 parça, L3: 1, L4: 0) — çocuk
//    tanımadan değil, gerçekten HATIRLAYARAK devamını getirir.
//
// Depolama öğrenci profiline duyarlıdır (Hoca Modu): srs.ts'teki aktif
// öğrenci kimliğiyle anahtarlanır, öğrenci değişince kendi ezberi gelir.
import { getActiveStudentScope } from "@/data/srs";
import type { EzberSura } from "@/data/ezber";

export interface SegState {
  lvl: number;     // 0 = görülmemiş, 1-4 öğrenme seviyeleri
  consec: number;  // üst üste doğru (L3→L4 için 2 gerekir)
}

type SuraProgress = Record<string, SegState>;

function storageKey(): string {
  const sid = getActiveStudentScope();
  return sid ? `elifba-ezber-student-${sid}-v1` : "elifba-ezber-guest-v1";
}

function loadAll(): Record<string, SuraProgress> {
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveAll(data: Record<string, SuraProgress>) {
  try { localStorage.setItem(storageKey(), JSON.stringify(data)); } catch { /* ignore */ }
}

export function getSuraProgress(suraId: string): SuraProgress {
  return loadAll()[suraId] ?? {};
}

export function segLevel(suraId: string, segId: string): number {
  return getSuraProgress(suraId)[segId]?.lvl ?? 0;
}

// Cevap kaydı: yanlış -2 seviye (min 1), doğru +1 (L3→L4 için 2 ardışık)
export function recordEzberAnswer(suraId: string, segId: string, correct: boolean) {
  const all = loadAll();
  const sura = all[suraId] ?? (all[suraId] = {});
  const st = sura[segId] ?? (sura[segId] = { lvl: 0, consec: 0 });
  if (correct) {
    st.consec += 1;
    if (st.lvl <= 0) st.lvl = 1;
    if (st.lvl < 3) st.lvl += 1;
    else if (st.lvl === 3 && st.consec >= 2) st.lvl = 4;
  } else {
    st.consec = 0;
    st.lvl = Math.max(1, st.lvl - 2);
  }
  saveAll(all);
}

// Yeni parça görüldü olarak işaretle (öğretme kartı sonrası L1'den başlar)
export function markSeen(suraId: string, segId: string) {
  const all = loadAll();
  const sura = all[suraId] ?? (all[suraId] = {});
  if (!sura[segId] || sura[segId].lvl === 0) sura[segId] = { lvl: 1, consec: 0 };
  saveAll(all);
}

export function resetSura(suraId: string) {
  const all = loadAll();
  delete all[suraId];
  saveAll(all);
}

// Ustalık yüzdesi: seviyelerin toplamı / (4 × parça sayısı)
export function suraMasteryPct(sura: EzberSura): number {
  const prog = getSuraProgress(sura.id);
  const total = sura.segments.length * 4;
  const sum = sura.segments.reduce((a, s) => a + (prog[s.id]?.lvl ?? 0), 0);
  return total ? Math.round((sum / total) * 100) : 0;
}

export function suraMastered(sura: EzberSura): boolean {
  const prog = getSuraProgress(sura.id);
  return sura.segments.every((s) => (prog[s.id]?.lvl ?? 0) >= 4);
}

// ---- soru seçici ----

export type EzberQuestion =
  | { kind: "learn"; index: number }   // yeni parça tanıtımı
  | { kind: "quiz"; index: number };   // devamını getir

// Yanlış cevaplananlar önce tekrar sorulur (oturum içi kuyruk)
const retryQueue: Record<string, number[]> = {};

export function enqueueEzberRetry(suraId: string, index: number) {
  const q = retryQueue[suraId] ?? (retryQueue[suraId] = []);
  if (!q.includes(index)) q.push(index);
}

const LEVEL_WEIGHT: Record<number, number> = { 1: 0.55, 2: 0.2, 3: 0.15, 4: 0.1 };

export function pickEzberQuestion(sura: EzberSura, lastIndex: number | null): EzberQuestion | null {
  const prog = getSuraProgress(sura.id);
  const lvlOf = (i: number) => prog[sura.segments[i].id]?.lvl ?? 0;

  // 1) tekrar kuyruğu (yanlışlar hemen geri gelir)
  const q = retryQueue[sura.id];
  while (q && q.length) {
    const idx = q.shift()!;
    if (idx !== lastIndex || sura.segments.length === 1) return { kind: "quiz", index: idx };
  }

  // 2) sıralı açılım: ilk görülmemiş parça, öncekilerin hepsi L2+ ise tanıtılır
  const firstUnseen = sura.segments.findIndex((_, i) => lvlOf(i) === 0);
  if (firstUnseen !== -1) {
    const prevOk = sura.segments.slice(0, firstUnseen).every((_, i) => lvlOf(i) >= 2);
    if (firstUnseen === 0 || prevOk) return { kind: "learn", index: firstUnseen };
  }

  // 3) görülenler arasından seviye ağırlıklı seçim (zayıf daha sık),
  //    art arda aynı parça sorulmaz
  const seen = sura.segments.map((_, i) => i).filter((i) => lvlOf(i) >= 1);
  if (!seen.length) return null;
  const cands = seen.filter((i) => i !== lastIndex);
  const pool = cands.length ? cands : seen;
  const weights = pool.map((i) => LEVEL_WEIGHT[Math.min(4, Math.max(1, lvlOf(i)))] ?? 0.2);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) {
    r -= weights[k];
    if (r <= 0) return { kind: "quiz", index: pool[k] };
  }
  return { kind: "quiz", index: pool[pool.length - 1] };
}

// Seviyeye göre gösterilecek önceki-parça ipucu sayısı (bağlam soldurma)
export function contextCountFor(lvl: number): number {
  if (lvl <= 2) return 2;
  if (lvl === 3) return 1;
  return 0;
}
