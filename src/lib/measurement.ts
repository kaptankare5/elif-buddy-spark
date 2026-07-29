// Ölçüm modu — çocuğun harflerin başta/ortada/sonda hallerini önceden
// biliyor mu ölçmek için ayrı bir hafıza. Öğrenme (SRS) sistemine ETKİ
// ETMEZ — bu sadece rapor için toplanan veridir.
//
// Kayıt: her l2-XX-{init|med|fin} öğesi için deneme sayısı ve ilk doğruya
// kadar geçen deneme sayısı. "Bilmedi" işaretlenirse öğe kuyruğun sonuna
// eklenir ve sonra tekrar sorulur (aynı sırada başta→ortada→sonda).
import { useEffect, useState } from "react";

const KEY = "elifba-measurement-v1";
const EVENT = "elifba-measurement-updated";

export type MeasureEntry = {
  attempts: number;         // toplam kaç kez soruldu
  firstCorrectAt: number | null; // kaçıncı denemede ilk doğruyu yaptı
  done: boolean;            // artık sorulmayacak (doğru yaptı veya kullanıcı geçti)
  gaveUp?: boolean;         // hâlâ bilmiyor olarak işaretlendi
};

export type MeasureStore = Record<string, MeasureEntry>;

export function loadMeasure(): MeasureStore {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function saveMeasure(s: MeasureStore) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
}

export function resetMeasure() { saveMeasure({}); }

export function recordMeasure(itemId: string, correct: boolean, giveUp = false) {
  const s = loadMeasure();
  const cur = s[itemId] ?? { attempts: 0, firstCorrectAt: null, done: false };
  cur.attempts += 1;
  if (correct && cur.firstCorrectAt === null) cur.firstCorrectAt = cur.attempts;
  if (correct) cur.done = true;
  if (giveUp) { cur.done = true; cur.gaveUp = true; }
  s[itemId] = cur;
  saveMeasure(s);
}

export function useMeasure(): MeasureStore {
  const [s, setS] = useState<MeasureStore>(() => loadMeasure());
  useEffect(() => {
    const h = () => setS(loadMeasure());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return s;
}

// Rapor grupları
export type MeasureReport = {
  total: number;
  first1: string[];  // 1. denemede bildi
  first2: string[];  // 2. denemede bildi
  first3: string[];  // 3. denemede bildi
  first4plus: string[]; // 4+ denemede bildi
  unknown: string[]; // hâlâ bilmiyor / geçildi
  untested: string[]; // henüz sorulmadı
};

export function buildReport(itemIds: string[]): MeasureReport {
  const s = loadMeasure();
  const r: MeasureReport = {
    total: itemIds.length,
    first1: [], first2: [], first3: [], first4plus: [],
    unknown: [], untested: [],
  };
  for (const id of itemIds) {
    const e = s[id];
    if (!e) { r.untested.push(id); continue; }
    if (e.firstCorrectAt === 1) r.first1.push(id);
    else if (e.firstCorrectAt === 2) r.first2.push(id);
    else if (e.firstCorrectAt === 3) r.first3.push(id);
    else if (e.firstCorrectAt !== null && e.firstCorrectAt >= 4) r.first4plus.push(id);
    else if (e.gaveUp) r.unknown.push(id);
    else r.untested.push(id);
  }
  return r;
}
