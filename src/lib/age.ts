// Mini Akıl - Yaş seçimi (2-7 yaş)
import { useEffect, useState } from "react";
import type { Age, ContentTopic } from "@/data/types";

const KEY = "miniakil:age";
const VALID: Age[] = [2, 3, 4, 5, 6, 7];

export function getAge(): Age | null {
  try {
    const v = localStorage.getItem(KEY);
    const n = v ? parseInt(v, 10) : NaN;
    if ((VALID as number[]).includes(n)) return n as Age;
  } catch { /* ignore */ }
  return null;
}

export function setAge(age: Age) {
  try {
    localStorage.setItem(KEY, String(age));
    window.dispatchEvent(new CustomEvent("miniakil:age-changed"));
  } catch { /* ignore */ }
}

export function useAge(): [Age | null, (a: Age) => void] {
  const [age, setLocal] = useState<Age | null>(() => getAge());
  useEffect(() => {
    const fn = () => setLocal(getAge());
    window.addEventListener("miniakil:age-changed", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("miniakil:age-changed", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);
  return [age, (a: Age) => { setAge(a); setLocal(a); }];
}

// 2 ve 7 yaş mevcut topic.ages listelerine ([3..6]) doğrudan eşleşmez.
// Kullanıcı deneyimi için 2 → 3, 7 → 6 gibi davranır.
function effectiveAge(a: Age): Age {
  if (a === 2) return 3;
  if (a === 7) return 6;
  return a;
}

export function topicForAge(topic: ContentTopic, age: Age | null): boolean {
  if (!age) return true;
  if (!topic.ages || topic.ages.length === 0) return true;
  return topic.ages.includes(effectiveAge(age));
}

export function itemsForAge<T>(items: T[], age: Age | null): T[] {
  if (!age) return items;
  const limits: Record<number, number> = {
    2: 6, 3: 8, 4: 14, 5: 22, 6: items.length, 7: items.length,
  };
  const lim = limits[age] ?? items.length;
  return items.slice(0, lim);
}

// KVKK için kabaca bantlanmış yaş — sunucuya yalnız bu gönderilir.
export function ageBandFor(age: Age | null): "2-3" | "4-5" | "6-7" | "unknown" {
  if (!age) return "unknown";
  if (age <= 3) return "2-3";
  if (age <= 5) return "4-5";
  return "6-7";
}

export const AGE_LABELS: Record<Age, string> = {
  2: "2 Yaş",
  3: "3 Yaş",
  4: "4 Yaş",
  5: "5 Yaş",
  6: "6 Yaş",
  7: "7 Yaş",
};

export const AGE_DESCRIPTIONS: Record<Age, string> = {
  2: "Sesler & taklit",
  3: "Tanıma & sesler",
  4: "Renkler & sayılar",
  5: "Harfler & kavramlar",
  6: "Okuma hazırlık",
  7: "1. sınıfa hazırlık",
};
