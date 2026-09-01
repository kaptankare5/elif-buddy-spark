// GLİF KART DENETİMİ — Arapça harf, içinde durduğu KUTUNUN dışına taşıyor mu?
//
// ⚠️ NEDEN: kullanıcı ekran görüntüsüyle bildirdi — Flashcard'ın denetim
// kartında ح beyaz kutunun altından taşıp şıkkın üstüne biniyordu.
// `glifKutu.mjs` DAİREYİ (oyun düşmanı) ölçer, bu araç sayfadaki GERÇEK
// kutuyu ölçer: uygulamayı açar, denetim kartını tetikler, mürekkebi sayar.
//
// ⚠️ İKİ AYRAÇ TUZAĞI (ikisine de yakalandım):
//  1. Komşu yazılar da koyu yeşil — başlık ve şıkkın yazısı ayraca giriyordu.
//     Ölçümden önce glif dışındaki her şey `visibility:hidden` yapılır.
//  2. "Aynı sayı her harfte" çıkıyorsa ayraç kırpma KENARINI ölçüyordur,
//     glifi değil. Sayı ile görüntü çelişirse görüntü haklıdır.
//
// Çalıştırma (önce: npx vite --host 127.0.0.1 --port 5199 &)
//   node tools/perf/glifKart.mjs cikti.png        # kart ölçümü (HARF=06 ile harf seç)
//   node tools/perf/glifKart.mjs --kelepce        # glifOlcu kelepçesi ne kadar bağlıyor
import { chromium } from "playwright";
import fs from "fs";

const KOK = "http://127.0.0.1:5199";
const HARF = process.env.HARF || "06";   // 06 = ح (çanağı tabanın çok altına iner)
const cikti = process.argv[2] || "denetim.png";

if (process.argv.includes("--kelepce")) {
  // KELEPÇE RAPORU: glifOlcu.ts'in ±kelepçesi gerçek ölçümü kesiyor mu?
  // (0.5 em iken 36 glifin 14'ünü kesiyordu — ج ح خ م ع ي dahil.)
  const b0 = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const p0 = await b0.newPage({ viewport: { width: 412, height: 880 } });
  await p0.goto(KOK + "/", { waitUntil: "networkidle" });
  const SINIR = Number(process.env.SINIR || 1);
  const r = await p0.evaluate(async () => {
  await document.fonts.ready;
  const el = document.createElement("span");
  el.className = "font-arabic";
  el.style.cssText = "position:absolute;visibility:hidden;left:-9999px";
  document.body.appendChild(el);
  const aile = getComputedStyle(el).fontFamily;
  el.remove();
  const c = document.createElement("canvas").getContext("2d");
  c.font = `100px ${aile}`; c.direction = "rtl";
  const gerek = (g) => {
    const m = c.measureText(g);
    return (((m.fontBoundingBoxDescent - m.fontBoundingBoxAscent)
           - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent)) / 2) / 100 - 0.05;
  };
  const harfler = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");
  const diziler = ["بَ", "بِ", "بُ", "اَبَّ", "ب۪ي", "رَبِّ", "كَانَ", "الضَّٓالّٖينَ"];
  const say = (l) => l.map((g) => ({ g, k: +gerek(g).toFixed(3) }));
  return { aile, harfler: say(harfler), diziler: say(diziler) };
});
const hepsi = [...r.harfler, ...r.diziler];
const kelepceli = hepsi.filter((x) => Math.abs(x.k) > SINIR);
console.log("font:", r.aile);
console.log("gereken kaydırma aralığı:", Math.min(...hepsi.map(x=>x.k)).toFixed(3), "..", Math.max(...hepsi.map(x=>x.k)).toFixed(3));
console.log(`${SINIR} em KELEPÇESİNE TAKILAN: ${kelepceli.length}/${hepsi.length}`);
for (const x of kelepceli) console.log(`  ${x.g}  gereken ${x.k}  →  kelepçe ${x.k < 0 ? -SINIR : SINIR}  (kayıp ${(Math.abs(x.k)-SINIR).toFixed(3)} em)`);

  await b0.close();
  process.exit(0);
}

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });

await page.addInitScript((harf) => {
  try {
    localStorage.setItem("elifba-test-panel-v1", "1");
    localStorage.setItem("elifba-test-unlock-v1", "1");
    // YALNIZ hedef harf L4 → denetim hedefi belirli olsun (şıklar havuzdan gelir)
    const srs = { harfler: {} };
    srs.harfler["l1-" + harf] = { level: 4, correct: 5, total: 5, seen: 5, lastSeen: Date.now(), totalMs: 4000 };
    localStorage.setItem("elifba-srs-quiz-guest-v1", JSON.stringify(srs));
    localStorage.setItem("elifba-audit-v1-guest", JSON.stringify({ sayac: 99, dogru: 0, toplam: 0 }));
  } catch { /* yoksay */ }
}, HARF);

await page.goto(KOK + "/konu/elifba/harfler/flashcard", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
if (await page.locator("text=KONTROL SORUSU").count() === 0) {
  console.log("denetim kartı çıkmadı"); await b.close(); process.exit(1);
}

// ⚠️ ÖLÇÜT BEYAZ KUTU, glif span'ı değil: EmojiView'den sonra mürekkep bir
// <span>, kutu ise onun ana ögesi. Taşma "span kutudan çıkıyor mu" sorusudur.
const kutu = await page.evaluate(() => {
  const g = [...document.querySelectorAll("*")].find(
    (x) => typeof x.className === "string" && x.className.includes("font-arabic")
      && x.children.length === 0 && x.textContent.trim(),
  );
  if (!g) return null;
  const kap = g.closest("div.bg-card") || g.parentElement;
  const r = kap.getBoundingClientRect();
  return { glif: g.textContent.trim(), x: r.left, y: r.top, w: r.width, h: r.height };
});
if (!kutu) { console.log("glif kutusu yok"); await b.close(); process.exit(1); }

// ⚠️ KOMŞU YAZILAR AYRACA GİRİYOR (iki kez yakalandı: başlık ve şıkkın "Bu"
// yazısı da koyu yeşil). Ölçümden önce glif kutusu DIŞINDAKİ her şey
// `visibility:hidden` yapılır — yerleşim aynı kalır, mürekkep yalnız glifin
// olur. "Aynı sayı her harfte" görünce ayraca şüphelen.
await page.evaluate(() => {
  const d = [...document.querySelectorAll("*")].find(
    (x) => typeof x.className === "string" && x.className.includes("font-arabic")
      && x.children.length === 0 && x.textContent.trim(),
  );
  for (const el of document.querySelectorAll("body *")) {
    if (el === d || el.contains(d)) continue;
    el.style.visibility = "hidden";
  }
  d.style.visibility = "visible";
});
await page.waitForTimeout(200);

// Kutunun etrafında 40px pay bırakarak kırp — taşma da kareye girsin.
const PAY = 40, UST_PAY = 6, SC = 2;
const buf = await page.screenshot({ clip: {
  x: kutu.x, y: Math.max(0, kutu.y - UST_PAY),
  width: kutu.w, height: kutu.h + UST_PAY + PAY,
} });
// ⚠️ Piksel sayımı SAYFANIN İÇİNDE yapılır (glifKutu.mjs deseni): görüntüyü
// canvas'a geri yükleyip getImageData ile okuruz — ek npm paketi gerekmez.
const veri = "data:image/png;base64," + buf.toString("base64");
const olcum = await page.evaluate(async ({ veri, PAY, SC, kh, kw }) => {
  const im = new Image();
  await new Promise((ok) => { im.onload = ok; im.src = veri; });
  const cv = document.createElement("canvas");
  cv.width = im.width; cv.height = im.height;
  const k = cv.getContext("2d");
  k.drawImage(im, 0, 0);
  const d = k.getImageData(0, 0, cv.width, cv.height).data;
  let ust = Infinity, alt = -Infinity, sol = Infinity, sag = -Infinity, n = 0;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const i = (cv.width * y + x) << 2;
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (r < 140 && g < 160 && b < 140 && g >= r) {   // koyu yeşil mürekkep
        n++; if (y < ust) ust = y; if (y > alt) alt = y;
        if (x < sol) sol = x; if (x > sag) sag = x;
      }
    }
  }
  const kUst = PAY * SC, kAlt = (PAY + kh) * SC, kSol = 0, kSag = kw * SC;
  const r2 = (v) => +(v / SC).toFixed(1);
  return n === 0 ? { hata: "mürekkep bulunamadı" } : {
    murekkepPiksel: n,
    tasmaAlt: r2(alt - kAlt),
    tasmaUst: r2(kUst - ust),
    tasmaSol: r2(kSol - sol),
    tasmaSag: r2(sag - kSag),
    merkezSapmasi: r2((ust + alt) / 2 - (kUst + kAlt) / 2),
  };
}, { veri, PAY: UST_PAY, SC, kh: kutu.h, kw: kutu.w });
console.log(JSON.stringify({ glif: kutu.glif, kutuCss: { w: +kutu.w.toFixed(1), h: +kutu.h.toFixed(1) }, ...olcum }, null, 2));
await page.screenshot({ path: cikti });
fs.writeFileSync(cikti.replace(/\.png$/, "-kirp.png"), buf);
console.log("kaydedildi:", cikti);
await b.close();
