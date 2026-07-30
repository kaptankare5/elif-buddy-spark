// HATA ORANI SİMÜLASYONU — "çocuk yüzde kaç yanlış yapar?"
//
// Sentetik bir çocuğu (her öğe için hafıza gücü H + unutma eğrisi) modeller ve
// GERÇEK kodu sürer: gerçek seçici (pickNextLetterFromTopic / pickNextGameItem),
// gerçek SRS (recordSrsAnswer / recordGameAnswer), gerçek kilit mantığı,
// gerçek şık sayıları. Yani çıkan sayı "kodun bugünkü hâlinin" tahminidir.
//
// ÇOCUK MODELİ (varsayımlar açık):
//  - hatırlama r = 2^(-geçenGün / H); hiç görülmemişse önbilgi (çoğu 0.05).
//  - Çoktan seçmelide: r olasılıkla hatırlar → doğru. Hatırlamazsa şıklardan
//    RASTGELE seçer (1/N). Çeldiriciler KARIŞAN harflerden geldiği için yarım
//    bilgi kurtarmaz — bu yüzden düzgün tahmin doğru modeldir.
//  - Flashcard'da çocuk kendi puanlar → tahmin yok, yalnız gerçekten bilirse doğru.
//  - Doğru geri-getirme H'yi büyütür (aralık bonuslu), yanlış H'yi yarılar,
//    tahminle "doğru" çok az öğretir.
//  - Oturumlar arası +1 gün → unutma işler.
//
// Çalıştırmak için:  SIM=1 npx vitest run src/test/errorRate.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { pickNextLetterFromTopic, recordSrsAnswer, getTopicSrs, __resetSelectorState } from "@/data/srs";
import { clearRecentAsked, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { getAllTopics } from "@/data/subjects";
import { getUnlockedItemsOf, isTopicCompleted, getUnlockedTopicIds } from "@/lib/unlock";
import { gamePool, pickWrongs } from "@/pages/games/_shared";
import { pickDistractors, recordConfusionPick, recordDiscrimination } from "@/lib/confusion";
import { setGameMode } from "@/lib/gameMode";
import type { ContentItem } from "@/data/types";

const DAYMS = 86_400_000;
const realNow = Date.now;
const realRandom = Math.random;
afterAll(() => { Date.now = realNow; Math.random = realRandom; });

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const topics = getAllTopics();
const practiceTopics = topics.filter((t) => !t.noPractice);
const idToTopic = new Map<string, string>();
for (const t of topics) for (const it of t.items) idToTopic.set(it.id, t.id);

interface Mem { H: number; last: number; studied: boolean; known0: number }
function recall(m: Mem, day: number): number {
  if (!m.studied) return m.known0;
  const r = Math.pow(2, -(day - m.last) / m.H);
  return r < 0 ? 0 : r > 1 ? 1 : r;
}
function updateMem(m: Mem, retrieved: boolean, reported: boolean, r: number, day: number, hiz: number) {
  m.studied = true;
  // hiz: öğrenme hızı profili — doğru geri-getirmenin hafızayı ne kadar
  // güçlendirdiğini ölçekler (yavaş çocuk aynı tekrardan daha az kazanır).
  if (retrieved) m.H = Math.min(400, m.H * (1 + (0.5 + 0.8 * (1 - r)) * hiz));
  else if (reported) m.H = m.H * (1 + 0.05 * hiz) + 0.15 * hiz;   // tahminle doğru — az öğrenme
  else m.H = Math.max(0.4, m.H * 0.5);                            // yanlış — düzeltici
  m.last = day;
}

// GERÇEK yüzeyler ve şık sayıları (koddan):
//   Topic testi 4 şık · Flashcard kendi puanlar · Parti/Yarış/Tren/Macera 3 şık
//   Balon 5 şık · Uzay 4 şık · Yılan/Şerit 2 şık
type Surface = { ad: string; n: number; oyun: boolean };
const SURFACES: Surface[] = [
  { ad: "Test (4 şık)", n: 4, oyun: false },
  { ad: "Flashcard (kendi)", n: 0, oyun: false },
  { ad: "Parti/Yarış (3 şık)", n: 3, oyun: true },
  { ad: "Balon (5 şık)", n: 5, oyun: true },
  { ad: "Yılan (2 şık)", n: 2, oyun: true },
];

const SESSIONS = 40;
const Q_PER = 30;

interface Log { yuzey: string; dogru: boolean; ilkGorus: boolean; gun: number }

function runSim(seed: number, mode: "super" | "normal", profil: "orta" | "hizli" | "yavas") {
  localStorage.clear();
  __resetSelectorState();
  clearRecentAsked();
  setGameMode(mode);
  const rnd = mulberry32(seed);
  Math.random = rnd;

  // Öğrenme hızı profili: doğru cevabın H'yi ne kadar büyüttüğü.
  const hiz = profil === "hizli" ? 1.6 : profil === "yavas" ? 0.5 : 1;
  const P_KNOWN = 0.1;   // acemi çocuk öğelerin ~%10'unu zaten biliyor

  const mem = new Map<string, Mem>();
  for (const t of practiceTopics) {
    for (const it of t.items) {
      const known = rnd() < P_KNOWN;
      mem.set(it.id, { H: known ? 40 : 0.2, last: 0, studied: false, known0: known ? 1 : 0.05 });
    }
  }
  const gorulmus = new Set<string>();
  const log: Log[] = [];

  const frontierTopic = () =>
    practiceTopics.find((t) => getUnlockedTopicIds().has(t.id) && !isTopicCompleted(t)) || null;

  for (let day = 0; day < SESSIONS; day++) {
    Date.now = () => day * DAYMS + 1;
    for (let q = 0; q < Q_PER; q++) {
      // Gerçekçi karışım: %35 test, %20 flashcard, %45 oyun
      const u = rnd();
      const s: Surface =
        u < 0.35 ? SURFACES[0] :
        u < 0.55 ? SURFACES[1] :
        u < 0.80 ? SURFACES[2] :
        u < 0.90 ? SURFACES[3] : SURFACES[4];

      // Hedef + ŞIKLAR gerçek seçicilerden gelir: çeldiriciler karışan
      // harflerden kurulduğu için tahminin gerçek zorluğu modellenmiş olur
      // ve karışıklık motoru (ısı → sıklık) simülasyon boyunca gerçekten işler.
      let hedef: ContentItem | null = null;
      let siklar: ContentItem[] = [];
      let recTopic = "";
      if (s.oyun) {
        const pool = gamePool();
        if (pool.length < 3) continue;
        hedef = pickNextGameItem(pool) ?? null;
        if (!hedef) continue;
        siklar = [hedef, ...pickWrongs(pool, hedef, s.n - 1)];
        recTopic = idToTopic.get(hedef.id)!;
      } else {
        const ct = frontierTopic();
        if (!ct) break;
        const items = getUnlockedItemsOf(ct);
        if (items.length === 0) break;
        const pickId = pickNextLetterFromTopic(getTopicSrs("quiz", ct.id), items.map((i) => i.id));
        hedef = items.find((i) => i.id === pickId) ?? null;
        if (!hedef) continue;
        siklar = s.n > 0 ? [hedef, ...pickDistractors(items, hedef, s.n - 1)] : [hedef];
        recTopic = ct.id;
      }
      const id = hedef.id;

      const m = mem.get(id)!;
      const r = recall(m, day);
      const ilkGorus = !gorulmus.has(id);
      gorulmus.add(id);

      const retrieved = rnd() < r;
      // Hatırlamazsa ekrandaki şıklardan rastgele birini seçer.
      const secilen = retrieved ? hedef : siklar[Math.floor(rnd() * siklar.length)] ?? hedef;
      const reported = s.n > 0 ? secilen.id === id : retrieved;

      if (s.oyun) {
        recordGameAnswer(hedef, reported, {
          gameId: "party", chosenId: secilen.id, shownIds: siklar.map((o) => o.id),
        });
      } else {
        void recordSrsAnswer("quiz", recTopic, id, reported);
        if (s.n > 0) {
          if (reported) recordDiscrimination(id, siklar.map((o) => o.id));
          else recordConfusionPick(id, secilen.id);
        }
      }
      updateMem(m, retrieved, reported, r, day, hiz);
      log.push({ yuzey: s.ad, dogru: reported, ilkGorus, gun: day });
    }
  }
  return log;
}

const pct = (dogru: number, top: number) => (top === 0 ? "—" : `%${(100 * (1 - dogru / top)).toFixed(0)}`);

function ozet(log: Log[]) {
  const grup = (f: (l: Log) => boolean) => {
    const g = log.filter(f);
    return { n: g.length, d: g.filter((l) => l.dogru).length };
  };
  return { grup, toplam: grup(() => true) };
}

const RUN_SIM = process.env.SIM === "1";
describe("hata oranı simülasyonu", () => {
  (RUN_SIM ? it : it.skip)("yüzeye ve zamana göre yanlış yüzdesi", { timeout: 300_000 }, () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const kosular = seeds.map((s) => runSim(s, "super", "orta"));
    const hepsi = kosular.flat();
    const { grup, toplam } = ozet(hepsi);

    console.log(`\n===== HATA ORANI SİMÜLASYONU =====`);
    console.log(`${SESSIONS} oturum × ${Q_PER} soru × ${seeds.length} çocuk = ${hepsi.length} cevap · süper mod`);
    console.log(`Karışım: %35 Test · %20 Flashcard · %45 oyun\n`);
    console.log(`GENEL YANLIŞ ORANI: ${pct(toplam.d, toplam.n)}\n`);

    console.log("YÜZEYE GÖRE");
    for (const s of SURFACES) {
      const g = grup((l) => l.yuzey === s.ad);
      const sans = s.n > 0 ? ` (rastgele tahminin tabanı %${(100 * (1 - 1 / s.n)).toFixed(0)})` : " (tahmin yok)";
      console.log(`  ${s.ad.padEnd(22)} yanlış ${pct(g.d, g.n).padStart(5)}  n=${g.n}${sans}`);
    }

    console.log("\nZAMANA GÖRE (oturum aralığı)");
    const bloklar: Array<[string, number, number]> = [
      ["1-3 (ilk günler)", 0, 3], ["4-10", 3, 10], ["11-20", 10, 20], ["21-40", 20, 40],
    ];
    for (const [ad, a, b] of bloklar) {
      const g = grup((l) => l.gun >= a && l.gun < b);
      console.log(`  ${ad.padEnd(22)} yanlış ${pct(g.d, g.n).padStart(5)}  n=${g.n}`);
    }

    console.log("\nİLK KARŞILAŞMA / TEKRAR");
    const ilk = grup((l) => l.ilkGorus);
    const tekrar = grup((l) => !l.ilkGorus);
    console.log(`  İlk kez görülen harf     yanlış ${pct(ilk.d, ilk.n).padStart(5)}  n=${ilk.n}`);
    console.log(`  Daha önce görülmüş       yanlış ${pct(tekrar.d, tekrar.n).padStart(5)}  n=${tekrar.n}`);

    // Akış kanalı: sistem ~%85 doğruluğu hedefler (ne sıkıcı ne bunaltıcı).
    // Oturum başına doğruluk dağılımı bunun tutup tutmadığını gösterir.
    console.log("\nOTURUM BAŞINA DOĞRULUK DAĞILIMI (akış kanalı %85 hedefi)");
    const oturumlar: number[] = [];
    for (const k of kosular) {
      for (let g = 0; g < SESSIONS; g++) {
        const o = k.filter((l) => l.gun === g);
        if (o.length >= 10) oturumlar.push(o.filter((l) => l.dogru).length / o.length);
      }
    }
    const bant = (a: number, b: number) => oturumlar.filter((x) => x >= a && x < b).length;
    const yuz = (n: number) => `%${((100 * n) / oturumlar.length).toFixed(0)}`;
    console.log(`  çok zor    (<%60 doğru)   ${yuz(bant(0, 0.6)).padStart(5)}`);
    console.log(`  zorlanıyor (%60-75)       ${yuz(bant(0.6, 0.75)).padStart(5)}`);
    console.log(`  ideal      (%75-92)       ${yuz(bant(0.75, 0.92)).padStart(5)}  ← hedef bant`);
    console.log(`  çok kolay  (>%92)         ${yuz(bant(0.92, 1.01)).padStart(5)}`);
    const ort = oturumlar.reduce((a, b) => a + b, 0) / oturumlar.length;
    console.log(`  ortalama oturum doğruluğu %${(100 * ort).toFixed(0)}`);

    console.log("\nÖĞRENME HIZI PROFİLİ (genel yanlış)");
    for (const p of ["hizli", "orta", "yavas"] as const) {
      const l = seeds.slice(0, 4).map((s) => runSim(s, "super", p)).flat();
      console.log(`  ${p.padEnd(22)} ${pct(l.filter((x) => x.dogru).length, l.length).padStart(5)}`);
    }

    console.log("\nMOD KARŞILAŞTIRMASI (genel yanlış)");
    for (const md of ["super", "normal"] as const) {
      const l = seeds.slice(0, 4).map((s) => runSim(s, md, "orta")).flat();
      console.log(`  ${md.padEnd(22)} ${pct(l.filter((x) => x.dogru).length, l.length).padStart(5)}`);
    }
    console.log();

    expect(hepsi.length).toBeGreaterThan(1000);
  });
});
