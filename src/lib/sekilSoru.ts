// ŞEKİL EŞLEME — "bu, hangi harfin ortadaki hâli?" sorusu.
//
// ⚠️ NEDEN AYRI BİR MOD: bir harfin başta/ortada/sonda hâlleri AYNI mp3'ü
// çalıyor. `sameSound` bu yüzden onları aynı soruya koymuyor (yoksa sorunun
// iki doğru cevabı olurdu) — sonuç olarak 2. konudaki 84 şekil oyunlarda
// HİÇ ölçülemiyordu. Soru SESLE değil GÖRSEL sorulunca ölçülebiliyor:
// ekranda `ـبـ` asılı durur, şıklar harflerin yalın glifleridir.
import { flattenItems } from "@/data/subjects";
import { letterNumOf } from "@/lib/confusables";
import type { ContentItem } from "@/data/types";

const SEKIL_AD: Record<string, string> = { init: "başta", med: "ortada", fin: "sonda" };

let _tablo: Map<number, Array<{ glif: string; form: string }>> | null = null;

function tablo() {
  if (_tablo) return _tablo;
  const m = new Map<number, Array<{ glif: string; form: string }>>();
  for (const it of flattenItems()) {
    const f = /^l2-(\d{2})-(init|med|fin)$/.exec(it.id);
    if (!f || !it.emoji) continue;
    const n = Number(f[1]);
    if (!m.has(n)) m.set(n, []);
    m.get(n)!.push({ glif: it.emoji, form: f[2] });
  }
  _tablo = m;
  return m;
}

/**
 * Hedef harfin BAŞKA bir yazılış hâli — soru olarak asılacak glif.
 *
 * ⚠️ Hedefin KENDİ glifiyle aynı olan hâller elenir: bağlanmayan harflerde
 * (ا د ذ ر ز و) "başta" hâli müstakille aynıdır, onu göstermek soruyu
 * tautolojiye çevirirdi ("ر hangi harf?" → ر).
 *
 * Şekli olmayan öğe için `null` döner (harekeli/cezimli heceler, Ekstralar);
 * çağıran taraf o soruyu klasik yönteme düşürür.
 */
export function baskaSekil(target: ContentItem): { glif: string; etiket: string } | null {
  const n = letterNumOf(target.id);
  if (n == null) return null;
  const adaylar = (tablo().get(n) ?? []).filter(
    (x) => x.glif && x.glif !== target.emoji,
  );
  if (!adaylar.length) return null;
  const s = adaylar[Math.floor(Math.random() * adaylar.length)];
  return { glif: s.glif, etiket: SEKIL_AD[s.form] ?? "" };
}

/** Test/HUD için: kaç harfin kaç şekli var? */
export function sekilSayisi(): { harf: number; sekil: number } {
  const t = tablo();
  let sekil = 0;
  for (const v of t.values()) sekil += v.length;
  return { harf: t.size, sekil };
}
