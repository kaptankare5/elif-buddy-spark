// GLİF TAŞMA DENETİMİ — harf beyaz dairenin dışına çıkıyor mu?
//
// ⚠️ NEDEN: kullanıcı "uzay oyununda ayın, ha gibi harflerin alt kısımları
// beyaz yuvarlağın dışına çıkıyor" dedi. Bu `glifOlcu.ts`'in çözdüğü sorunun
// aynısı — ama Uzay Savaşı (ve Yılan, Balon, Kutu Boşalt) o modülü
// KULLANMIYOR: glif kutusuna `line-height` ile ortalanıyor, oysa line-height
// SATIR KUTUSUNU ortalar, MÜREKKEBİ değil.
//
// YÖNTEM: tahmin yok. Gerçek Chromium'da, oyundaki geometrinin birebir aynısı
// kurulur (56px daire, 34px punto, line-height:1, flex ortalama) ve her glifin
// GERÇEK mürekkep kutusu canvas `actualBoundingBox*` ile ölçülür. Taban
// çizgisinin nerede oturduğu font metriğinden (fontBoundingBox*) hesaplanır.
// Ayrıca `--resim` ile aynı geometrinin ekran görüntüsü kaydedilir.
//
// Çalıştırma: node tools/perf/glifKutu.mjs [--resim cikti.png]
import { chromium } from "playwright";

const DAIRE = 56;      // ENEMY_PX
const PUNTO = 34;      // RunnerGame fontSize
const PUNTO_OZEL = process.argv.includes("--punto")
  ? Number(process.argv[process.argv.indexOf("--punto") + 1]) : 0;

const HARFLER = [
  "ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ",
  "ع","غ","ف","ق","ك","ل","م","ن","و","ه","ي",
  "جَ","حِ","خُ","عَ","عِ","غُ","مَ","بِ","لُ",
];

/**
 * ⚠️ FONT SAYFA İÇİNDEN İNMİYOR (sandbox): `<link>` ile Google Fonts
 * çağrısı sessizce yedek fonta düşüyor ve ölçüm ANLAMSIZ oluyor —
 * yedek sans Arapçada hiçbir glif taşmıyor, oysa sorun Amiri Quran'ın
 * derin çanaklarında. Bu yüzden woff2 NODE tarafında indirilip sayfaya
 * data URL olarak GÖMÜLÜYOR; böylece cihazdaki fontun ta kendisi ölçülüyor.
 */
async function fontGom(aile, cssUrl) {
  const css = await (await fetch(cssUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
  })).text();
  const url = css.match(/https:\/\/fonts\.gstatic\.com[^)]+/)?.[0];
  if (!url) throw new Error(`${aile}: woff2 adresi bulunamadı`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return `@font-face{font-family:'${aile}';src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');}`;
}

const GOMULU = await fontGom("Amiri Quran",
  "https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap");

const SAYFA = `<!doctype html><html><head><meta charset="utf-8">
<style>
${GOMULU}
  /* ⚠️ ARKA PLAN DOYGUN RENK: ilk denemede lacivert (#1b1b2e) kullandım ve
     piksel ayracı onu SİYAH MÜREKKEP sandı — 37/37 "taşıyor" çıktı. Mürekkep
     nötr koyu; arka plan ondan olabildiğince uzak olmalı. */
  body { margin:0; background:#e11d48; font-family:system-ui; }
  .izgara { display:grid; grid-template-columns:repeat(9, 86px); gap:6px; padding:14px; }
  .kap { position:relative; width:86px; height:86px; display:flex; align-items:center; justify-content:center; }
  .daire {
    width:${DAIRE}px; height:${DAIRE}px; border-radius:9999px; background:#fff;
    display:flex; align-items:center; justify-content:center;
    line-height:1; font-size:${PUNTO}px; overflow:visible;
    font-family:"Amiri Quran","Scheherazade New","Traditional Arabic","Amiri",serif;
  }
  /* EmojiView'in Arapça dalı: font-arabic + geniş leading. Oyunda glif
     bu sarmalayıcının içinde çiziliyor; ölçüm de öyle olmalı. */
  .glif { display:inline-block; color:#111; line-height:1.6;
          font-family:"Amiri Quran","Scheherazade New","Traditional Arabic","Amiri",serif; }
</style></head><body><div class="izgara" id="iz"></div></body></html>`;

/** --duzelt: EmojiView'in mürekkep ortalamasını ve kısa salınımı uygular. */
const DUZELT = process.argv.includes("--duzelt");
const resimYolu = process.argv.includes("--resim")
  ? process.argv[process.argv.indexOf("--resim") + 1] : null;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 840, height: 460 }, deviceScaleFactor: 2 });
await page.setContent(SAYFA);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);
// ⚠️ HANGİ FONT GERÇEKTEN ÇİZDİ? Yedek fonta düşmüş bir ölçüm hiçbir şey
// söylemez — Amiri Quran'ın derin çanakları sorunun ta kendisi.
const fontDurum = await page.evaluate(() => ({
  amiriQuran: document.fonts.check('34px "Amiri Quran"'),
  scheherazade: document.fonts.check('34px "Scheherazade New"'),
  yuzler: [...document.fonts].map((f) => `${f.family}:${f.status}`),
}));
console.log("font durumu:", JSON.stringify(fontDurum));
if (!fontDurum.amiriQuran) {
  console.log("⚠️ Amiri Quran YÜKLENEMEDİ — ölçüm yedek fontla yapılıyor, sayılar cihazı TEMSİL ETMEZ.\n");
}

/**
 * ⚠️ ÖLÇÜM = EKRANIN KENDİSİ. Önce mürekkep kutusunu (`actualBoundingBox*`)
 * diskle kıyasladım — rtl metinde genişlik ölçüsü yanıltıcı çıktı ve ekran
 * görüntüsüyle ÇELİŞEN sayılar verdi. Sonra glifi canvas'ta yeniden çizmeyi
 * denedim — taban çizgisini CSS'in koyduğu yere oturtmak güvenilmez oldu.
 * Doğrusu: sayfanın GERÇEK ekran görüntüsünü al, tarayıcıya geri ver ve
 * diskin dışında kalan koyu pikselleri say. Tahmin yok.
 */
await page.evaluate(([harfler, duzelt, punto]) => {
  const iz = document.getElementById("iz");
  const cc = document.createElement("canvas").getContext("2d");
  cc.font = `100px "Amiri Quran", serif`;
  cc.direction = "rtl";
  for (const h of harfler) {
    const kap = document.createElement("div"); kap.className = "kap";
    const d = document.createElement("div"); d.className = "daire";
    if (punto) d.style.fontSize = `${punto}px`;
    const g = document.createElement("span"); g.className = "glif"; g.textContent = h;
    if (duzelt) {
      // Formül `glifOlcu.ts`'ten BİREBİR: ((fDesc−fAsc) − (desc−asc))/2 − 0.05
      const m = cc.measureText(h);
      const k = (((m.fontBoundingBoxDescent - m.fontBoundingBoxAscent)
                - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent)) / 2) / 100 - 0.05;
      g.style.transform = `translateY(${Math.max(-0.5, Math.min(0.5, k)).toFixed(4)}em)`;
    }
    d.appendChild(g); kap.appendChild(d); iz.appendChild(kap);
  }
}, [HARFLER, DUZELT, PUNTO_OZEL]);

const daireKutulari = await page.evaluate(() =>
  [...document.querySelectorAll(".daire")].map((d) => {
    const r = d.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }));

const sot = await page.screenshot({ type: "png" });
const dataUrl = `data:image/png;base64,${sot.toString("base64")}`;

const sonuc = await page.evaluate(async ([url, kutular, harfler, dpr]) => {
  const img = await createImageBitmap(await (await fetch(url)).blob());
  const cv = document.createElement("canvas");
  cv.width = img.width; cv.height = img.height;
  const k = cv.getContext("2d");
  k.drawImage(img, 0, 0);
  return kutular.map((b, i) => {
    const x0 = Math.floor(b.x * dpr), y0 = Math.floor(b.y * dpr);
    const w = Math.round(b.w * dpr), h = Math.round(b.h * dpr);
    const pay = Math.round(14 * dpr);          // dairenin çevresindeki tarama payı
    const sx = Math.max(0, x0 - pay), sy = Math.max(0, y0 - pay);
    const sw = Math.min(cv.width - sx, w + pay * 2), sh = Math.min(cv.height - sy, h + pay * 2);
    const im = k.getImageData(sx, sy, sw, sh).data;
    const cx = x0 - sx + w / 2, cy = y0 - sy + h / 2, r = w / 2;
    let disari = 0, enDerin = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const p = (sw * y + x) << 2;
        const R = im[p], G = im[p + 1], B = im[p + 2];
        // Koyu MÜREKKEP: üç kanal da düşük. Arka plan doygun kırmızı
        // (#e11d48 → R=225), disk beyaz — ikisi de bu eşiğin dışında.
        if (!(R < 90 && G < 90 && B < 90)) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 0.8) continue;
        disari++;
        enDerin = Math.max(enDerin, (d - r) / dpr);
      }
    }
    return { harf: harfler[i], disari: Math.round(disari / (dpr * dpr)), enDerin };
  });
}, [dataUrl, daireKutulari, HARFLER, 2]);

console.log(`daire ${DAIRE}px · punto ${PUNTO_OZEL || PUNTO}px · ${DUZELT ? "mürekkep ORTALANMIŞ" : "mevcut hâl"}\n`);
console.log(`${"harf".padEnd(5)} ${"taşan piksel".padStart(13)} ${"en derin px".padStart(12)}`);
let tasan = 0, enDerinTop = 0, toplamPiksel = 0;
for (const o of sonuc) {
  if (o.disari > 3) { tasan++; enDerinTop = Math.max(enDerinTop, o.enDerin); }
  toplamPiksel += o.disari;
  const bayrak = o.disari > 3 ? " ✗" : "";
  console.log(`${o.harf.padEnd(5)} ${String(o.disari).padStart(13)} ${o.enDerin.toFixed(1).padStart(12)}${bayrak}`);
}
console.log(`\nDAİRE DIŞINA TAŞAN HARF: ${tasan}/${sonuc.length}`);
console.log(`en derin taşma: ${enDerinTop.toFixed(1)} px · toplam taşan alan: ${toplamPiksel} px²`);

if (resimYolu) {
  await page.locator("#iz").screenshot({ path: resimYolu });
  console.log(`\ngörüntü: ${resimYolu}`);
}
await b.close();
