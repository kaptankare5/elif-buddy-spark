// ROTA TARAMASI — bütün sayfaları tek tek açar, KONSOL HATASI toplar ve
// ekran görüntüsü alır.
//
// ⚠️ NEDEN: birim testleri mantığı denetler, ekran görüntüsü görünüşü; ama
// "sayfa açılınca patlıyor mu" ikisinin arasında kalıyor. React'te bir
// render hatası testlerde görünmez (bileşen test edilmiyorsa) ve ekran
// görüntüsünde de yalnız boş bir alan olarak çıkar. Bu araç konsolu dinler:
// `pageerror` (yakalanmamış istisna) ve `console.error` ayrı sayılır.
//
// Kullanım:
//   npx vite --host 127.0.0.1 --port 5199 &
//   node tools/perf/tarama.mjs [cikti-dizini]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const KOK = process.env.KOK || "http://127.0.0.1:5199";
const DIZIN = process.argv[2] || "tarama";

// Dinamik rotalar gerçek bir id ile denenir — parametreli hâli 404 verir.
const ROTALAR = [
  ["/", "ana"],
  ["/oyunlar", "oyunlar"],
  ["/ilerleme", "ilerleme"],
  ["/ayarlar", "ayarlar"],
  ["/bahce", "bahce"],
  ["/koleksiyon", "koleksiyon"],
  ["/ezber", "ezber"],
  ["/veli", "veli"],
  ["/olcum", "olcum"],
  ["/yazilis-hafiza", "yazilis-hafiza"],
  ["/prova", "prova"],
  ["/giris", "giris"],
  ["/abonelik", "abonelik"],
  ["/gizlilik", "gizlilik"],
  ["/konu/elifba/harfler", "konu-harfler"],
  ["/konu/elifba/yazilislar", "konu-yazilislar"],
  ["/konu/elifba/yazilis-hafiza", "konu-hafiza"],
  ["/konu/elifba/harekeler", "konu-harekeler"],
  ["/konu/elifba/harf-hareke", "konu-harf-hareke"],
  ["/konu/elifba/cezm", "konu-cezm"],
  ["/konu/elifba/sedde", "konu-sedde"],
  ["/konu/elifba/med", "konu-med"],
  ["/konu/elifba/asar-med-kasr", "konu-asar"],
  ["/konu/elifba/tenvin", "konu-tenvin"],
  ["/konu/elifba/zamir-lafzatullah", "konu-zamir"],
  ["/konu/elifba/elif-lam-ra", "konu-elif-lam"],
  ["/konu/elifba/harfler/flashcard", "flashcard"],
];
const OYUNLAR = ["memory", "balloon", "sorter", "match3", "triple", "quiz", "snake",
  "flappy", "puzzle", "runner", "subway", "platform", "party", "kart"];
for (const g of OYUNLAR) ROTALAR.push([`/oyunlar/${g}`, `oyun-${g}`]);

await mkdir(DIZIN, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, deviceScaleFactor: 2 });
/**
 * ⚠️ INIT SCRIPT try/catch İÇİNDE OLMALI — yoksa ARACIN KENDİSİ sahte hata
 * üretir. Playwright bu betiği HER ÇERÇEVEYE enjekte ediyor; video'lu
 * konularda YouTube iframe'i bu ortamda yüklenemiyor ve
 * `chrome-error://chromewebdata/` çerçevesine düşüyor. O çerçevenin origin'i
 * opak olduğu için `localStorage` erişimi `SecurityError` atıyor ve tarama
 * bunu UYGULAMA hatası sanıyordu (ölçüldü: 3 konu, hepsi `video` alanı olan).
 * Uygulamanın kendi kodu zaten her yerde try/catch kullanıyor.
 */
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("elifba-test-panel-v1", "1");
    localStorage.setItem("elifba-test-unlock-v1", "1");
  } catch { /* opak origin (yüklenemeyen iframe) — sorun değil */ }
});
await ctx.route("**://*.supabase.co/**", (r) => r.abort());

let toplamHata = 0;
console.log("rota".padEnd(34) + "hata  boş?  not");
console.log("─".repeat(72));
for (const [yol, ad] of ROTALAR) {
  const p = await ctx.newPage();
  const hatalar = [];
  p.on("pageerror", (e) => hatalar.push("EXC: " + String(e).slice(0, 110)));
  p.on("console", (m) => { if (m.type() === "error") hatalar.push("ERR: " + m.text().slice(0, 110)); });
  try {
    await p.goto(KOK + yol, { waitUntil: "domcontentloaded", timeout: 30000 });
    await p.waitForTimeout(2600);
    // "Boş sayfa" denetimi: gövdede görünür metin var mı (404 hariç).
    const bilgi = await p.evaluate(() => ({
      metin: (document.body.innerText || "").trim().length,
      dortYuzDort: /404/.test(document.body.innerText || ""),
    }));
    await p.screenshot({ path: `${DIZIN}/${ad}.png` });
    // Ağ/kaynak hataları gürültü: yalnız uygulama hatalarını say.
    const gercek = hatalar.filter((h) => !/ERR_CONNECTION|Failed to load resource|net::/.test(h));
    toplamHata += gercek.length;
    const not = bilgi.dortYuzDort ? "404!" : bilgi.metin < 40 ? "İÇERİK YOK" : "";
    console.log(ad.padEnd(34) + String(gercek.length).padStart(4) + "  " +
      (bilgi.metin < 40 ? "EVET" : "hayır").padEnd(6) + not);
    for (const h of gercek.slice(0, 3)) console.log("      " + h);
  } catch (e) {
    toplamHata++;
    console.log(ad.padEnd(34) + "  AÇILAMADI  " + String(e).slice(0, 60));
  }
  await p.close();
}
console.log("─".repeat(72));
console.log(`toplam uygulama hatası: ${toplamHata}`);
await b.close();
