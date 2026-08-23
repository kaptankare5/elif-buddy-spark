// SES ZAMAN ÇİZELGESİ — bir rotada HANGİ ses, NE ZAMAN, HANGİ PERDEDE çaldı.
//
// ⚠️ NEDEN: `juice.mjs` yalnız "ses çıktı mı" diye sayıyor. Bir SIRA
// tasarlarken (yarış geri sayımı: 3-2-1 aynı perde, sonra farklı bir
// "BAŞLA") bu yetmiyor — sesin doğru ANDA ve doğru PERDEDE çaldığı
// görülmeli. Ses duyulamaz ama WebAudio çizelgesi OKUNABİLİR: osilatörün
// frekans çağrıları ve `start(t)` zamanı sarmalanıp kaydediliyor.
//
// Kullanım:
//   npx vite build && npx vite preview --port 4173 --host 127.0.0.1 &
//   node tools/perf/sesZaman.mjs /oyunlar/kart "1. Pistte Yarış" 7000
import { chromium } from "playwright";

const [rota = "/oyunlar/kart", dugme = "1. Pistte Yarış", sure = "7000"] = process.argv.slice(2);
const B = process.env.BASE || "http://127.0.0.1:4173";

const SAR = () => {
  window.__ses = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const co = AC.prototype.createOscillator;
  AC.prototype.createOscillator = function () {
    const o = co.apply(this, arguments);
    const k = { tur: "ton", tip: "", f: [], t: 0 };
    const sv = o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime = (v, t) => { k.f.push(Math.round(v)); return sv(v, t); };
    const er = o.frequency.exponentialRampToValueAtTime.bind(o.frequency);
    o.frequency.exponentialRampToValueAtTime = (v, t) => { k.f.push(Math.round(v)); return er(v, t); };
    // ⚠️ SÜREKLİ SESLER `setTargetAtTime` ile sürülür (fermuar gürültüsü
    // olmasın diye). Bu yakalanmazsa motor/rüzgâr katmanı çizelgede tek bir
    // sabit perde gibi görünür — hızla değiştiği hiç görünmez.
    const st2 = o.frequency.setTargetAtTime.bind(o.frequency);
    o.frequency.setTargetAtTime = (v, t, c) => { k.surekli = (k.surekli || 0) + 1; k.enAz = Math.min(k.enAz ?? 1e9, v); k.enCok = Math.max(k.enCok ?? 0, v); return st2(v, t, c); };
    const st = o.start.bind(o);
    o.start = (t) => { k.tip = o.type; k.t = t ?? 0; window.__ses.push(k); return st(t); };
    return o;
  };
  const cb = AC.prototype.createBufferSource;
  AC.prototype.createBufferSource = function () {
    const s = cb.apply(this, arguments);
    const st = s.start.bind(s);
    s.start = (t) => { window.__ses.push({ tur: "gürültü", tip: "-", f: [], t: t ?? 0 }); return st(t); };
    return s;
  };
};

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
         "--autoplay-policy=no-user-gesture-required"],
});
const ctx = await b.newContext({ viewport: { width: 412, height: 880 } });
const p = await ctx.newPage();
await p.route("**://*.supabase.co/**", (r) => r.abort());
await p.addInitScript(() => {
  localStorage.setItem("elifba-test-panel-v1", "1");
  localStorage.setItem("elifba-test-unlock-v1", "1");
});
await p.addInitScript(SAR);
await p.goto(`${B}${rota}`, { waitUntil: "domcontentloaded", timeout: 45000 });
await p.waitForTimeout(2500);
if (dugme && dugme !== "-") {
  const d = p.getByRole("button", { name: dugme, exact: false }).first();
  if (await d.count()) await d.click().catch(() => {});
  else await p.getByText(dugme, { exact: false }).first().click().catch(() => {});
}
await p.waitForTimeout(Number(sure));

const ses = await p.evaluate(() => window.__ses);
if (!ses.length) { console.log("hiç ses çalınmadı"); await b.close(); process.exit(0); }
const t0 = Math.min(...ses.map((s) => s.t));
ses.sort((a, c) => a.t - c.t);
console.log(`${rota} — ${ses.length} ses olayı (t = ilk sesten itibaren sn)\n`);
console.log("   t      tür       dalga      perde (Hz)");
console.log("─".repeat(52));
for (const s of ses) {
  const f = s.f.length ? (s.f.length > 1 ? `${s.f[0]} → ${s.f[s.f.length - 1]}` : `${s.f[0]}`) : "—";
  const sur = s.surekli ? `   SÜREKLİ (${s.surekli} güncelleme, ${Math.round(s.enAz)}-${Math.round(s.enCok)} Hz)` : "";
  console.log(`${(s.t - t0).toFixed(2).padStart(6)}   ${s.tur.padEnd(9)} ${s.tip.padEnd(10)} ${f}${sur}`);
}
await b.close();
