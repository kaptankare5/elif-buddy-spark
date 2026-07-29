// 🩹 TELAFİ — hata yapılan harfin HAFIZA YÖNTEMİ çocuğun önüne gelir.
//
// Çocuk Ayn'ın (ع) ortadaki hâlinde hata yaptıysa, ona kuralı yeniden
// ANLATMAK yerine YAPTIRIRIZ: "Ayn'ın kuyruğunu sil" oyunu açılır, silince
// ortadaki hâli ortaya çıkar. Nokta ailesindeki bir harfte hata yaptıysa
// nokta karşılaştırması gelir. Öğrenme bilimi: hatadan hemen sonra verilen
// AÇIKLAYICI geri bildirim, doğru cevabı söylemekten çok daha güçlüdür
// (Butler, Karpicke & Roediger 2008 — "explanation feedback").
//
// AMA HER HATADA DEĞİL. Kullanıcı şartı: "çocuğu sürekli karşısına çıkartıp
// da sıkmasın." Üç kapı var:
//   1) ISRAR — o harf/hâl gerçekten sorun mu? Tek şanssız hata yetmez;
//      ölçülmüş karışıklık ısısı eşiği geçmeli ya da 2. kez hata olmalı.
//   2) SOĞUMA — aynı harf için 30 dakika, herhangi bir telafi için 4 dakika
//      ara. Arka arkaya iki telafi asla çıkmaz.
//   3) TAVAN — bir seansta en fazla 3 telafi.
//
// Oyunlarda telafi ASLA oyunun ortasında açılmaz (akışı keser): kuyruğa
// alınır, oyun bitince (ölünce/süre dolunca) gösterilir.
import { useEffect } from "react";
import { heatBetween, itemHeat } from "@/lib/confusion";
import { formOf, letterNumOf } from "@/lib/confusables";
import { TAIL_RULES, DOT_GROUPS, STABLE_GROUP } from "@/data/writingMnemonics";

const LETTER_COOLDOWN_MS = 30 * 60_000; // aynı harf için
const ANY_COOLDOWN_MS = 4 * 60_000;     // herhangi bir telafi için
const SESSION_MAX = 3;                  // seans tavanı
const HEAT_GATE = 0.5;                  // ısrar eşiği

/** Telafi gösterilecek hâl: hangi harf, hangi yöntem. */
export type Remedy = {
  itemId: string;
  letter: number;
  /** "kuyruk" = kuyruğu sil oyunu · "nokta" = nokta karşılaştırması · "sabit" = değişmeyen harf */
  kind: "kuyruk" | "nokta" | "sabit";
};

// Seans içi durum (sekme kapanınca sıfırlanır — kalıcı olmasına gerek yok)
const _lastForLetter = new Map<number, number>();
let _lastAny = 0;
let _sessionCount = 0;
let _queued: Remedy | null = null;

const EVENT = "elifba-remedy-show";
export const REMEDY_EVENT = EVENT;

const hasTail = (n: number) => TAIL_RULES.some((r) => r.n === n);
const hasDots = (n: number) => DOT_GROUPS.some((g) => g.letters.some((l) => l.n === n));
const isStable = (n: number) => STABLE_GROUP.letters.some((l) => l.n === n);

/**
 * HANGİ HATAYI YAPTIYSA O YÖNTEM. Bir harf iki yönteme birden girebilir:
 * Be'nin (ب) hem kuyruk kuralı var (ب → بـ), hem de diş ailesinde noktayla
 * ayrılır. Doğru ders, çocuğun karıştırdığı EKSENE bağlıdır:
 *   • Be'yi Nun'la karıştırdıysa (farklı harf, aynı iskelet) → NOKTA yöntemi.
 *   • Be'nin baştaki hâlini sondaki hâliyle karıştırdıysa → KUYRUK yöntemi.
 * Hangi şıkkı seçtiği bilinmiyorsa harfin baskın yöntemine düşülür.
 */
function methodFor(letter: number, chosenId?: string): Remedy["kind"] | null {
  const chosenLetter = chosenId ? letterNumOf(chosenId) : null;
  const sameLetter = chosenLetter != null && chosenLetter === letter;

  if (chosenLetter != null && !sameLetter) {
    // FARKLI HARF karıştırdı → ayırt edici işaret noktadır
    if (hasDots(letter)) return "nokta";
  } else if (sameLetter) {
    // AYNI harfin başka hâliyle karıştırdı → şekil/kuyruk dersi
    if (isStable(letter)) return "sabit";
    if (hasTail(letter)) return "kuyruk";
  }
  // Bilinmiyorsa: kuyruk > nokta > sabit
  if (hasTail(letter)) return "kuyruk";
  if (hasDots(letter)) return "nokta";
  if (isStable(letter)) return "sabit";
  return null;
}

/**
 * Bu yanlış cevap telafiyi hak ediyor mu?
 * Yalnız "Yazılışlar" konusu (l2-NN-init|med|fin) — kullanıcı şartı:
 * "başta ortada sonda hâlindeki bir harfte hata yaparsa".
 */
export function considerRemedy(itemId: string, chosenId?: string): Remedy | null {
  if (!formOf(itemId)) return null;               // başta/ortada/sonda değil
  const letter = letterNumOf(itemId);
  if (letter == null) return null;
  const kind = methodFor(letter, chosenId);
  if (!kind) return null;                          // bu harfin yöntemi yok

  const now = Date.now();
  if (_sessionCount >= SESSION_MAX) return null;
  if (now - _lastAny < ANY_COOLDOWN_MS) return null;
  if (now - (_lastForLetter.get(letter) ?? 0) < LETTER_COOLDOWN_MS) return null;

  // ISRAR kapısı: ya bu ikilinin ısısı eşiği geçmiş, ya da harf genel olarak
  // ısınmış. Tek seferlik şanssız hata (ısı 0.34) telafiyi tetiklemez.
  const paired = chosenId ? heatBetween(itemId, chosenId) : 0;
  if (Math.max(paired, itemHeat(itemId)) < HEAT_GATE) return null;

  return { itemId, letter, kind };
}

function markRemedyShown(r: Remedy) {
  _lastAny = Date.now();
  _lastForLetter.set(r.letter, _lastAny);
  _sessionCount += 1;
}

/** Test/Flashcard: telafiyi HEMEN göster (tek global host dinler). */
export function showRemedy(r: Remedy) {
  markRemedyShown(r);
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: r })); } catch { /* SSR */ }
}

/** Oyun: akışı kesme — kuyruğa al, oyun bitince gösterilecek. */
export function queueRemedy(r: Remedy | null) {
  if (r) _queued = r;
}

/** Oyun bitti (öldü / süre doldu) → kuyruktaki telafiyi göster. */
export function releaseRemedy() {
  if (!_queued) return;
  const r = _queued;
  _queued = null;
  showRemedy(r);
}

export function hasQueuedRemedy(): boolean { return _queued !== null; }

/**
 * Oyunlar için: "öldü / süre doldu" anında kuyruktaki telafiyi açar.
 * Oyunun ortasında ASLA açılmaz — kullanıcı şartı. Ölüm animasyonu görünsün
 * diye kısa bir gecikme var.
 */
export function useRemedyOnGameOver(over: boolean, delayMs = 1400) {
  useEffect(() => {
    if (!over || !hasQueuedRemedy()) return;
    const t = setTimeout(() => releaseRemedy(), delayMs);
    return () => clearTimeout(t);
  }, [over, delayMs]);
}

/** Testler için. */
export function __resetRemedial() {
  _lastForLetter.clear();
  _lastAny = 0;
  _sessionCount = 0;
  _queued = null;
}

export const REMEDY_LIMITS = { LETTER_COOLDOWN_MS, ANY_COOLDOWN_MS, SESSION_MAX, HEAT_GATE };
