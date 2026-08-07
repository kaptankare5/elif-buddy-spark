// HATA ORANI + MÜFREDAT SİMÜLASYONU — "çocuk yüzde kaç yanlış yapar?"
//
// Sentetik bir çocuğu GERÇEK kod üzerinden sürer: gerçek seçici
// (pickNextLetterFromTopic / pickNextGameItem), gerçek SRS (recordSrsAnswer /
// recordGameAnswer), gerçek BÖLÜM ve KONU KİLİDİ (getUnlockedItemsOf,
// isTopicCompleted), gerçek çeldirici seçimi (pickWrongs / pickDistractors) ve
// her yüzeyin gerçek şık sayısı. Yani çıkan sayı "kodun bugünkü hâlinin"
// tahminidir, elle uydurulmuş bir eğri değil.
//
// MÜFREDAT KAPISI MODELDE (kullanıcı sorusu: "o 4 harfi doğru cevaplamadan
// yeni harflere geçilmiyor, hesaba kattın mı?"). Üç kapı da gerçek koddan gelir:
//   1) Öğrenme seti (srs.ts LEARNING_SET_K=3): aynı anda en fazla 3 harf
//      "öğrenilmekte" (görülmüş ama L3 altı) olabilir; set doluyken YENİ harf
//      tanıtılmaz, eldeki pekişene kadar sorular onlardan gelir.
//   2) Bölüm kilidi (unlock.ts): bir sonraki bölüm ancak bölümdeki TÜM öğeler
//      L3+ iken VE bölüm içinde sıcak karışıklık kalmamışken açılır.
//   3) Konu kilidi: konudaki tüm öğeler L3+ olmadan sonraki konu açılmaz.
// L3 = 2 doğru (L1→L2→L3, her biri tek doğru), L4 = üstüne ÜST ÜSTE 2 hızlı
// doğru. Yanlış = 2 seviye düşer. Simülasyon bu sayıları ölçüp raporlar.
//
// ÇOCUK MODELİ — literatüre göre kalibre edildi (kaynaklar):
//  * Rawson & Dunlosky 2022 (Current Directions in Psych. Sci.), "successive
//    relearning": kalıcı bilgi için reçete = başlangıçta 3 doğru geri getirme,
//    sonra GENİŞ ARALIKLI 3 tekrar. Ayrı 3 oturumda 1'er doğru, tek oturumda
//    3 doğrudan İKİ KATINDAN fazla tutulum sağlıyor → aralık şart.
//  * Harf-ses müdahale çalışmalarında ustalık ölçütü: iki ayrı oturumda %80
//    doğruluk.
//  * Önerilen tanıtım hızı: haftada 2-4 harf-ses ilişkisi (okul öncesi için
//    kimi kaynaklar haftada 1-2 diyor).
// Buna göre: hatırlama r = 2^(-geçenGün / H). Yeni harfte H≈0.2 gün (birkaç
// saatte unutulur). ARALIKLI ve BAŞARILI her geri getirme H'yi büyütür; büyüme
// zor geri getirmede (düşük r) daha fazladır. Kalibrasyon hedefi: 3-4 aralıklı
// doğrudan sonra bir hafta sonraki hatırlama ~%80-90 (yukarıdaki reçete).
// Yanlış H'yi yarılar; TAHMİNLE bulunan doğru neredeyse hiç öğretmez (SRS
// şişmesi buradan doğar ve raporda ayrıca görünür).
//
// Çalıştırmak için:  SIM=1 npx vitest run src/test/errorRate.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { pickNextLetterFromTopic, recordSrsAnswer, getTopicSrs, __resetSelectorState } from "@/data/srs";
import { clearRecentAsked, pickNextGameItem, recordGameAnswer } from "@/lib/gameProgress";
import { getAllTopics } from "@/data/subjects";
import { getUnlockedItemsOf, isTopicCompleted, getUnlockedTopicIds, getUnlockedSections } from "@/lib/unlock";
import { gamePool, pickWrongs } from "@/pages/games/_shared";
import {
  pickDistractors, recordConfusionPick, recordDiscrimination,
  resetConfusion, __resetConfusionCache,
} from "@/lib/confusion";
import { setGameMode } from "@/lib/gameMode";
import { blameTarget, pickItemForSkill, skillIdsOf, skillOf } from "@/lib/skills";
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
// Kalibrasyon: H *= (2.2 + 2.5·(1−r)). Yeni harf H=0.2'den başlar; günlük
// aralıklı doğrularla H ≈ 0.9 → 3.2 → 8.6 → 21 gün olur, yani 4. doğrudan
// sonra bir hafta sonraki hatırlama ≈ %80. Rawson & Dunlosky'nin "3 doğru +
// aralıklı 3 tekrar" reçetesiyle aynı büyüklük sırası.
function updateMem(m: Mem, retrieved: boolean, reported: boolean, r: number, day: number, hiz: number) {
  m.studied = true;
  if (retrieved) m.H = Math.min(400, m.H * (1 + (1.2 + 2.5 * (1 - r)) * hiz));
  else if (reported) m.H = m.H * (1 + 0.05 * hiz) + 0.1 * hiz;  // tahminle doğru: neredeyse hiç öğrenme
  else m.H = Math.max(0.35, m.H * 0.5);                          // yanlış: düzeltici, kısmi
  m.last = day;
}

// GERÇEK yüzeyler ve şık sayıları (koddan okundu):
//   Topic testi 4 şık (pickDistractors ...,3) · Flashcard kendi puanlar
//   Parti/Yarış/Tren/Macera 3 şık · Balon 5 şık · Yılan/Şerit 2 şık
type Surface = { ad: string; n: number; oyun: boolean };
const S_TEST: Surface = { ad: "Test (4 şık)", n: 4, oyun: false };
const S_FLASH: Surface = { ad: "Flashcard (kendi)", n: 0, oyun: false };
const S_G3: Surface = { ad: "Parti/Yarış (3 şık)", n: 3, oyun: true };
const S_G5: Surface = { ad: "Balon (5 şık)", n: 5, oyun: true };
const S_G2: Surface = { ad: "Yılan (2 şık)", n: 2, oyun: true };

type Senaryo = "test" | "flashcard" | "oyun" | "karisik";
function yuzeySec(sen: Senaryo, u: number): Surface {
  if (sen === "test") return S_TEST;
  if (sen === "flashcard") return S_FLASH;
  if (sen === "oyun") return u < 0.62 ? S_G3 : u < 0.84 ? S_G5 : S_G2;
  // karışık: %35 test · %20 flashcard · %45 oyun
  return u < 0.35 ? S_TEST : u < 0.55 ? S_FLASH : u < 0.80 ? S_G3 : u < 0.90 ? S_G5 : S_G2;
}

const SESSIONS = 40;      // her gün bir oturum
const Q_PER = 30;         // oturum başına soru
const FLUENT_MS = 5000;   // srs.ts ile aynı eşik

interface Log { yuzey: string; dogru: boolean; tahmin: boolean; ilkGorus: boolean; gun: number }
interface Sonuc {
  log: Log[];
  tanitilan: number; l3: number; l4: number;
  kaliciBilgi: number;             // model gerçeği: +7 gün hatırlama ≥ 0.85
  sahteUstalik: number;            // L3+ ama +7 gün hatırlama < 0.5
  /**
   * ⚠️ ASIL SORU BU: ⭐⭐⭐⭐ rozeti YALAN SÖYLÜYOR MU? sahteUstalik L3'ü de
   * saydığı için kanıt kuralını ölçemez — L4'ü zorlaştırmak öğeleri L3'te
   * park ettiriyor ve o metrik kıpırdamıyor. Bu ayrı sayaç yalnız L4'e
   * bakar: "ezberledi" dediğimiz hâlde 7 gün sonra unutulmuş olanlar.
   */
  sahteL4: number;
  acilanBolum: number; acilanKonu: number;
  dogruylaL3: number[]; dogruylaL4: number[];
}

function runSim(seed: number, sen: Senaryo, profil: "orta" | "hizli" | "yavas" = "orta"): Sonuc {
  localStorage.clear();
  // ⚠️ confusion.ts karışıklık ısısını MODÜL DÜZEYİNDE önbelleğe alır;
  // localStorage.clear() onu temizlemez. Sıfırlanmazsa bir senaryonun ısısı
  // sonrakine sızar ve konular "sıcak ikili" yüzünden hiç tamamlanmaz
  // (ilk ölçümde yalnız-Flashcard bu yüzden 1. konuda takılı kalmıştı).
  __resetConfusionCache();
  resetConfusion();
  __resetSelectorState();
  clearRecentAsked();
  setGameMode("super");
  const rnd = mulberry32(seed);
  Math.random = rnd;

  const hiz = profil === "hizli" ? 1.5 : profil === "yavas" ? 0.55 : 1;
  const P_KNOWN = 0.1;

  // ⚠️ BELLEK ARTIK BECERİ BAZINDA (yeni müfredat). Çocuk "fetha = e"yi bir
  // kez öğrenir ve bu 28 harfe birden taşınır — 3. konunun bütün tasarım
  // bahsi budur ("öğrendiyse tüm harfleri görmesine gerek yok"). Bellek öğe
  // bazında tutulsaydı bu varsayımı hiç sınamamış olurduk. skill'i olmayan
  // konularda beceri = öğe id'si, yani eski model aynen korunur.
  const mem = new Map<string, Mem>();
  for (const t of practiceTopics) {
    for (const sk of skillIdsOf(t.items.filter((i) => i.practice !== false))) {
      const known = rnd() < P_KNOWN;
      mem.set(sk, { H: known ? 40 : 0.2, last: 0, studied: false, known0: known ? 1 : 0.05 });
    }
  }
  const gorulmus = new Set<string>();
  const dogruSayaci = new Map<string, number>();   // öğe → o ana kadarki doğru
  const l3De = new Map<string, number>();
  const l4De = new Map<string, number>();
  const log: Log[] = [];

  const frontierTopic = () =>
    practiceTopics.find((t) => getUnlockedTopicIds().has(t.id) && !isTopicCompleted(t)) || null;

  for (let day = 0; day < SESSIONS; day++) {
    Date.now = () => day * DAYMS + 1;
    for (let q = 0; q < Q_PER; q++) {
      const s = yuzeySec(sen, rnd());

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
        const pickSk = pickNextLetterFromTopic(getTopicSrs("quiz", ct.id), skillIdsOf(items));
        hedef = pickItemForSkill(items, pickSk) ?? null;
        if (!hedef) continue;
        siklar = s.n > 0 ? [hedef, ...pickDistractors(items, hedef, s.n - 1)] : [hedef];
        recTopic = ct.id;
      }
      // Ölçülen beceri (soruda görünen öğe değil).
      const id = skillOf(hedef);
      const m = mem.get(id);
      if (!m) continue;
      const r = recall(m, day);
      const ilkGorus = !gorulmus.has(id);
      gorulmus.add(id);

      const retrieved = rnd() < r;
      const secilen = retrieved ? hedef : (siklar[Math.floor(rnd() * siklar.length)] ?? hedef);
      // ⚠️ BECERİ ile KARŞILAŞTIR, öğe id'siyle değil. `id` artık skillOf(hedef)
      // (örn. "hrk-fetha") ama `secilen` bir ÖĞE ("l3-02-fetha") — doğrudan
      // kıyaslanınca hiçbir zaman eşleşmiyor ve testteki her cevap yanlış
      // sayılıyordu (%100 hata). Aynı beceriyi taşıyan başka bir şık da
      // DOĞRU sayılmalı: harekede şıklar aynı harfin üç harekesi, çocuk
      // doğru harekeyi seçtiyse beceriyi göstermiştir.
      const reported = s.n > 0 ? skillOf(secilen) === id : retrieved;
      const tahmin = reported && !retrieved;   // bilmeden tuttu → SRS şişmesi
      // Tepki süresi: kolay hatırlayan hızlı, zorlanan yavaş. L4 mandalı
      // (srs.ts) akıcılık ister — bu yüzden modellenmesi gerekiyor.
      const responseMs = Math.round(900 + 5200 * (1 - r) + rnd() * 800);

      if (s.oyun) {
        recordGameAnswer(hedef, reported, {
          responseMs, gameId: "party", chosenId: secilen.id, shownIds: siklar.map((o) => o.id),
        });
      } else {
        // Topic.tsx/Flashcard ile aynı kural: yanlışta ön koşul kontrolü.
        const hedefKayit = reported
          ? { topicId: recTopic, skillId: id }
          : blameTarget(hedef, recTopic);
        void recordSrsAnswer("quiz", hedefKayit.topicId, hedefKayit.skillId, reported, {
          responseMs, selfReport: s.n === 0,
        });
        if (s.n > 0) {
          if (reported) recordDiscrimination(id, siklar.map((o) => skillOf(o)));
          else recordConfusionPick(id, skillOf(secilen));
        }
      }
      if (reported) dogruSayaci.set(id, (dogruSayaci.get(id) ?? 0) + 1);
      const e = getTopicSrs("quiz", recTopic)[id];
      if (e) {
        if (e.level >= 3 && !l3De.has(id)) l3De.set(id, dogruSayaci.get(id) ?? 0);
        if (e.level >= 5 && !l4De.has(id)) l4De.set(id, dogruSayaci.get(id) ?? 0);
      }
      updateMem(m, retrieved, reported, r, day, hiz);
      log.push({ yuzey: s.ad, dogru: reported, tahmin, ilkGorus, gun: day });
    }
  }

  // --- müfredat ve gerçek bilgi metrikleri (son gün + 7) ---
  const son = SESSIONS + 7;
  let tanitilan = 0, l3 = 0, l4 = 0, kaliciBilgi = 0, sahteUstalik = 0, sahteL4 = 0, acilanBolum = 0, acilanKonu = 0;
  const acikKonular = getUnlockedTopicIds();
  for (const t of practiceTopics) {
    // Bölüm yalnız AÇIK konularda sayılır: getUnlockedSections kilitli bir
    // konuda da ilk bölümü "açık" döndürür, hepsi toplanınca sayı şişiyordu.
    if (acikKonular.has(t.id)) { acilanKonu++; acilanBolum += getUnlockedSections(t).size; }
    const srs = getTopicSrs("quiz", t.id);
    for (const sk of skillIdsOf(t.items.filter((i) => i.practice !== false))) {
      const e = srs[sk];
      const m = mem.get(sk);
      if (!m) continue;
      const rr = recall(m, son);
      if (e && (e.seen ?? 0) > 0) tanitilan++;
      if (e && e.level >= 3) { l3++; if (rr < 0.5) sahteUstalik++; }
      if (e && e.level >= 5) { l4++; if (rr < 0.5) sahteL4++; }
      if (rr >= 0.85) kaliciBilgi++;
    }
  }
  if (process.env.DBG === "1") {
    console.log(`[DBG ${sen}] açıkKonu=${[...acikKonular].join(",")}`);
    for (const t of practiceTopics.slice(0, 3)) {
      const srs = getTopicSrs("quiz", t.id);
      const n3 = t.items.filter((i) => (srs[i.id]?.level ?? 1) >= 3).length;
      const gor = t.items.filter((i) => (srs[i.id]?.seen ?? 0) > 0).length;
      console.log(`   ${t.id}: görülen ${gor}/${t.items.length} L3+ ${n3} tamam=${isTopicCompleted(t)} açıkÖğe=${getUnlockedItemsOf(t).length}`);
    }
  }
  return {
    log, tanitilan, l3, l4, kaliciBilgi, sahteUstalik, sahteL4, acilanBolum, acilanKonu,
    dogruylaL3: [...l3De.values()], dogruylaL4: [...l4De.values()],
  };
}

const yanlisPct = (log: Log[]) =>
  log.length === 0 ? "—" : `%${(100 * (1 - log.filter((l) => l.dogru).length / log.length)).toFixed(0)}`;
const ort = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const RUN_SIM = process.env.SIM === "1";
describe("hata oranı + müfredat simülasyonu", () => {
  (RUN_SIM ? it : it.skip)("4 senaryo: yalnız test / yalnız flashcard / yalnız oyun / karışık",
    { timeout: 900_000 }, () => {
    const seeds = [1, 2, 3, 4, 5, 6];
    const senaryolar: Senaryo[] = ["test", "flashcard", "oyun", "karisik"];
    const ad: Record<Senaryo, string> = {
      test: "YALNIZ TEST", flashcard: "YALNIZ FLASHCARD", oyun: "YALNIZ OYUN", karisik: "KARIŞIK",
    };
    const R: Record<string, Sonuc[]> = {};
    for (const sen of senaryolar) R[sen] = seeds.map((s) => runSim(s, sen));

    console.log(`\n===== HATA ORANI + MÜFREDAT SİMÜLASYONU =====`);
    console.log(`${SESSIONS} gün × ${Q_PER} soru × ${seeds.length} çocuk · süper mod`);
    console.log(`Model kalibrasyonu: Rawson & Dunlosky 2022 (3 doğru + aralıklı 3 tekrar),`);
    console.log(`harf-ses ustalık ölçütü %80×2 oturum, tanıtım hızı haftada 2-4 harf.\n`);

    const kol = (sen: Senaryo) => R[sen].flatMap((x) => x.log);
    const say = (sen: Senaryo, f: (s: Sonuc) => number) => ort(R[sen].map(f));

    console.log("GENEL YANLIŞ ORANI");
    for (const sen of senaryolar) {
      const l = kol(sen);
      console.log(`  ${ad[sen].padEnd(20)} ${yanlisPct(l).padStart(5)}   (n=${l.length})`);
    }

    console.log("\nZAMANA GÖRE YANLIŞ");
    const bloklar: Array<[string, number, number]> = [
      ["1-3. gün", 0, 3], ["4-10. gün", 3, 10], ["11-20. gün", 10, 20], ["21-40. gün", 20, 40],
    ];
    console.log(`  ${"".padEnd(14)}${senaryolar.map((s) => ad[s].slice(0, 9).padStart(11)).join("")}`);
    for (const [b, a, z] of bloklar) {
      const hucre = senaryolar.map((sen) =>
        yanlisPct(kol(sen).filter((l) => l.gun >= a && l.gun < z)).padStart(11)).join("");
      console.log(`  ${b.padEnd(14)}${hucre}`);
    }

    console.log("\nİLK KARŞILAŞMA / TEKRAR");
    console.log(`  ${"".padEnd(14)}${senaryolar.map((s) => ad[s].slice(0, 9).padStart(11)).join("")}`);
    console.log(`  ${"ilk kez".padEnd(14)}${senaryolar.map((sen) => yanlisPct(kol(sen).filter((l) => l.ilkGorus)).padStart(11)).join("")}`);
    console.log(`  ${"tekrar".padEnd(14)}${senaryolar.map((sen) => yanlisPct(kol(sen).filter((l) => !l.ilkGorus)).padStart(11)).join("")}`);

    console.log("\nMÜFREDAT İLERLEMESİ (40 günün sonunda, çocuk başına ort.)");
    const sat = (etiket: string, f: (s: Sonuc) => number, ondalik = 0) =>
      console.log(`  ${etiket.padEnd(30)}${senaryolar.map((sen) => say(sen, f).toFixed(ondalik).padStart(11)).join("")}`);
    console.log(`  ${"".padEnd(30)}${senaryolar.map((s) => ad[s].slice(0, 9).padStart(11)).join("")}`);
    sat("Tanıtılan harf", (s) => s.tanitilan);
    sat("SRS'e göre öğrenilmiş (L3+)", (s) => s.l3);
    sat("Ustalaşmış (L5)", (s) => s.l4);
    sat("Açılan bölüm", (s) => s.acilanBolum);
    sat("Açılan konu", (s) => s.acilanKonu);
    sat("Haftada tanıtılan harf", (s) => (s.tanitilan / SESSIONS) * 7, 1);
    sat("GERÇEKTEN kalıcı (+7g ≥%85)", (s) => s.kaliciBilgi);
    sat("Sahte ustalık (L3+ ama unutmuş)", (s) => s.sahteUstalik);
    sat("⭐ YALAN (L5 ama unutmuş)", (s) => s.sahteL4);
    sat("⭐ yalan oranı %", (s) => (s.l4 ? (100 * s.sahteL4) / s.l4 : 0), 1);

    console.log("\nKAÇ DOĞRU CEVAPTA ÖĞRENİYOR (ort.)");
    console.log(`  ${"".padEnd(30)}${senaryolar.map((s) => ad[s].slice(0, 9).padStart(11)).join("")}`);
    sat("L3'e (öğrenildi) kadar doğru", (s) => ort(s.dogruylaL3), 1);
    sat("L5'e (ustalık) kadar doğru", (s) => ort(s.dogruylaL4), 1);
    const tahminOrani = (sen: Senaryo) => {
      const l = kol(sen).filter((x) => x.dogru);
      return l.length ? `%${(100 * l.filter((x) => x.tahmin).length / l.length).toFixed(0)}` : "—";
    };
    console.log(`  ${"Doğruların tahminle olanı".padEnd(30)}${senaryolar.map((s) => tahminOrani(s).padStart(11)).join("")}`);

    console.log("\nOTURUM DOĞRULUK DAĞILIMI — akış kanalı (%85 hedefi)");
    console.log(`  ${"".padEnd(24)}${senaryolar.map((s) => ad[s].slice(0, 9).padStart(11)).join("")}`);
    const bantlar: Array<[string, number, number]> = [
      ["çok zor (<%60)", 0, 0.6], ["zorlanıyor (%60-75)", 0.6, 0.75],
      ["ideal (%75-92)", 0.75, 0.92], ["çok kolay (>%92)", 0.92, 1.01],
    ];
    const oturumDog = (sen: Senaryo) => {
      const out: number[] = [];
      for (const k of R[sen]) {
        for (let g = 0; g < SESSIONS; g++) {
          const o = k.log.filter((l) => l.gun === g);
          if (o.length >= 10) out.push(o.filter((l) => l.dogru).length / o.length);
        }
      }
      return out;
    };
    const od: Record<string, number[]> = {};
    for (const sen of senaryolar) od[sen] = oturumDog(sen);
    for (const [b, a, z] of bantlar) {
      const hucre = senaryolar.map((sen) => {
        const d = od[sen];
        return (d.length ? `%${((100 * d.filter((x) => x >= a && x < z).length) / d.length).toFixed(0)}` : "—").padStart(11);
      }).join("");
      console.log(`  ${b.padEnd(24)}${hucre}`);
    }
    console.log(`  ${"ortalama doğruluk".padEnd(24)}${senaryolar.map((sen) => `%${(100 * ort(od[sen])).toFixed(0)}`.padStart(11)).join("")}`);

    // Uyarlanır zorluğun imzası: hızlı çocuk DAHA AZ yanlış yapmaz, DAHA
    // HIZLI ilerler. Hata oranı sabit kalır, fark müfredat hızına yansır.
    console.log("\nÖĞRENME HIZI PROFİLİ (karışık senaryo)");
    console.log(`  ${"".padEnd(12)}${"yanlış".padStart(9)}${"öğrenilen".padStart(11)}${"otomatik".padStart(10)}${"kalıcı".padStart(9)}`);
    for (const p of ["hizli", "orta", "yavas"] as const) {
      const rs = seeds.slice(0, 4).map((s) => runSim(s, "karisik", p));
      const l = rs.flatMap((x) => x.log);
      console.log(`  ${p.padEnd(12)}${yanlisPct(l).padStart(9)}` +
        `${ort(rs.map((x) => x.l3)).toFixed(0).padStart(11)}` +
        `${ort(rs.map((x) => x.l4)).toFixed(0).padStart(10)}` +
        `${ort(rs.map((x) => x.kaliciBilgi)).toFixed(0).padStart(9)}`);
    }
    console.log();

    expect(kol("karisik").length).toBeGreaterThan(1000);
    // Müfredat kapısı gerçekten iş görüyor mu: tanıtılan harf, tüm havuzun
    // çok altında kalmalı (çocuk 40 günde her şeye maruz kalamaz).
    const toplamOge = practiceTopics.reduce((a, t) => a + t.items.length, 0);
    expect(say("karisik", (s) => s.tanitilan)).toBeLessThan(toplamOge * 0.6);
  });
});
