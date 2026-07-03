// İlerleme takibi (localStorage)
import { useEffect, useState } from "react";

export type LetterStatus = "unseen" | "struggling" | "learning" | "mastered";

export interface ProgressEntry {
  correct: number;
  total: number;
  status: LetterStatus;
}

export type TopicProgress = Record<string, ProgressEntry>;
export type AllProgress = Record<string, TopicProgress>;

const STORAGE_KEY = "elifba-progress-v1";

function load(): AllProgress {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function save(p: AllProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("elifba-progress-updated"));
}

function statusFor(correct: number, total: number): LetterStatus {
  if (total === 0) return "unseen";
  const ratio = correct / total;
  if (total >= 4 && ratio >= 0.8) return "mastered";
  if (ratio >= 0.5) return "learning";
  return "struggling";
}

export function recordAnswer(topicId: string, letterId: string, correct: boolean) {
  const p = load();
  if (!p[topicId]) p[topicId] = {};
  const entry = p[topicId][letterId] || { correct: 0, total: 0, status: "unseen" as LetterStatus };
  entry.total += 1;
  if (correct) entry.correct += 1;
  entry.status = statusFor(entry.correct, entry.total);
  p[topicId][letterId] = entry;
  save(p);
}

export function resetTopic(topicId: string) {
  const p = load();
  delete p[topicId];
  save(p);
}

export function resetAll() {
  save({});
}

export function useProgress() {
  const [progress, setProgress] = useState<AllProgress>(() => load());
  useEffect(() => {
    const handler = () => setProgress(load());
    window.addEventListener("elifba-progress-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("elifba-progress-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return progress;
}

export function getTotals(progress: AllProgress) {
  let correct = 0;
  let total = 0;
  Object.values(progress).forEach((topic) => {
    Object.values(topic).forEach((e) => {
      correct += e.correct;
      total += e.total;
    });
  });
  return { correct, total, percent: total === 0 ? 0 : Math.round((correct / total) * 100) };
}
