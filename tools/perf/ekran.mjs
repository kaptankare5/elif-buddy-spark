// EKRAN GÖRÜNTÜSÜ ARACI — bir rotayı gerçek tarayıcıda açıp görüntü alır.
//
// ⚠️ NEDEN: "şurası okunmuyor" türü bildirimler koddan tahmin edilerek
// çözülmemeli; katman sırası (z-index), saydamlık ve örtüşme ancak EKRANDA
// görülür. Bu araç dev sunucusundaki bir rotayı açar, gerekirse
// localStorage'ı hazırlar ve PNG kaydeder.
//
// Kullanım:
//   npx vite --host 127.0.0.1 --port 5199 &
//   node tools/perf/ekran.mjs /oyunlar/subway cikti.png [--bekle 3000]
import { chromium } from "playwright";

const [rota = "/", cikti = "ekran.png"] = process.argv.slice(2);
// (--tikla / --bekle bayrakları aşağıda okunuyor)
const bekle = process.argv.includes("--bekle")
  ? Number(process.argv[process.argv.indexOf("--bekle") + 1]) : 3500;
const KOK = process.env.EKRAN_KOK || "http://127.0.0.1:5199";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
// Telefon ölçüsü: sorunlar en çok dar ekranda görünüyor.
const page = await b.newPage({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") console.log("konsol:", m.text()); });

// ⚠️ TEST PANELİ AÇIK BAŞLASIN: kilitli konularda oyun havuzu boş kalıyor ve
// ekran "oyun yok" hâline düşüyor. Görsel denetim için bütün konular açık.
await page.addInitScript(() => {
  localStorage.setItem("elifba-test-panel-v1", "1");
  localStorage.setItem("elifba-test-unlock-v1", "1");
});

await page.goto(KOK + rota, { waitUntil: "networkidle" });
await page.waitForTimeout(bekle);

// --tikla "metin" : ekranda o metni taşıyan öğeye tıkla (bölüm seç, başlat…)
// Birden çok kez verilebilir; sırayla uygulanır.
const tiklamalar = process.argv.reduce((a, v, i, arr) =>
  (v === "--tikla" ? [...a, arr[i + 1]] : a), []);
for (const t of tiklamalar) {
  // "aria:Duraklat" → erişilebilirlik etiketiyle; yoksa görünen metinle.
  const etiket = t.startsWith("aria:");
  const hedef = etiket ? t.slice(5) : t;
  try {
    const loc = etiket ? page.getByLabel(hedef) : page.getByText(hedef, { exact: false });
    await loc.first().click({ timeout: 4000 });
    await page.waitForTimeout(1800);
  } catch { console.log(`tıklanamadı: ${t}`); }
}
// --sonBekle: tıklamalardan SONRA beklenecek süre (oyun ilerlesin diye).
const sonBekle = process.argv.includes("--sonBekle")
  ? Number(process.argv[process.argv.indexOf("--sonBekle") + 1]) : 0;
if (sonBekle) await page.waitForTimeout(sonBekle);
await page.screenshot({ path: cikti });
console.log("kaydedildi:", cikti);
await b.close();
