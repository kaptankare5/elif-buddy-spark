// JUICE ÖLÇÜMÜ — oyunlarda gerçekten ses/titreşim çıkıyor mu.
//
// ⚠️ SESİ "DUYAMAYIZ", ama ÜRETİMİNİ SAYABİLİRİZ: WebAudio'nun
// createOscillator'ı ve navigator.vibrate sarmalanıp çağrı sayılıyor.
// Böylece "kod eklendi ama hiç çalışmıyor" durumu yakalanır — juice
// eklerken en kolay hata, sesin yanlış dala konup hiç tetiklenmemesi.
//
// ⚠️ addInitScript ŞART: sarmalama sayfa açılmadan kurulmalı, yoksa oyunun
// ilk sesleri kaçar.
//
// Kullanım:
//   npx vite build && npx vite preview --port 4173 --host 127.0.0.1 &
//   node tools/perf/juice.mjs
//   OYUN=subway,snake node tools/perf/juice.mjs
import { chromium } from 'playwright';

const B = process.env.BASE || 'http://127.0.0.1:4173';
const OYUNLAR = (process.env.OYUN ||
  'quiz,memory,balloon,sorter,match3,triple,snake,flappy,puzzle,runner,lane,subway,platform,party,kart'
).split(',');

const SAR = () => {
  window.__osc = 0; window.__vib = 0;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const o = AC.prototype.createOscillator;
    AC.prototype.createOscillator = function () { window.__osc++; return o.apply(this, arguments); };
  }
  const v = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
  Object.defineProperty(navigator, 'vibrate', {
    value: (...a) => { window.__vib++; return v ? v(...a) : true; },
    configurable: true,
  });
};

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
});

console.log('oyun          ton  titreşim   hata');
console.log('─'.repeat(44));
const sessiz = [];
for (const g of OYUNLAR) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true });
  const p = await ctx.newPage();
  const hata = [];
  p.on('pageerror', (e) => hata.push(String(e).split('\n')[0].slice(0, 60)));
  await p.route('**://*.supabase.co/**', (r) => r.abort());
  await p.addInitScript(SAR);
  await p.goto(`${B}/oyunlar/${g}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(2500);

  // menüsü olan oyunları gerçekten başlat
  for (const ad of ['1. Bölümü Oyna', '1. Pistte Yarış', 'Başla']) {
    const d = p.getByRole('button', { name: ad, exact: false }).first();
    if (await d.count() && await d.isVisible().catch(() => false)) {
      await d.click().catch(() => {}); await p.waitForTimeout(2200); break;
    }
  }
  const kilitsiz = p.getByRole('button', { name: /^🌼/ }).first();
  if (await kilitsiz.count()) { await kilitsiz.click().catch(() => {}); await p.waitForTimeout(2200); }

  // rastgele oyna
  for (let i = 0; i < 26; i++) {
    await p.mouse.click(60 + (i * 57) % 320, 300 + (i * 83) % 420).catch(() => {});
    await p.keyboard.press(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Digit1', 'Digit2'][i % 6]).catch(() => {});
    await p.waitForTimeout(230);
  }

  const m = await p.evaluate(() => ({ osc: window.__osc || 0, vib: window.__vib || 0 }));
  if (m.osc === 0) sessiz.push(g);
  console.log(`${g.padEnd(12)} ${String(m.osc).padStart(4)} ${String(m.vib).padStart(9)}   ${hata.length ? '⚠ ' + hata[0] : '✓'}`);
  await ctx.close();
}
console.log('\nHİÇ SES ÇIKMAYAN:', sessiz.length ? sessiz.join(', ') : 'YOK ✓');
await b.close();
