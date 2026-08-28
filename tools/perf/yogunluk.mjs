// OYUN YOĞUNLUĞU — "dakikada kaç harf soruluyor, ne kadar sürede ölünüyor".
//
// Kalıcılık analizinin çekirdek ölçüsü. İki şey birden söyler:
//   · ÖĞRENME VERİMİ  — dakikada kaç soru (harf mp3'ü çalınması = soru)
//   · OYUN YOĞUNLUĞU  — boş geçen süre, ölüme kadar geçen süre
//
// ⚠️ SORU SAYIMI ses dosyasından: `/audio/elifba/*.mp3` çalınması bir sorunun
// sorulduğu andır. HTMLAudioElement.play sarmalanıp sayılıyor; harf sesiyle
// geri bildirim sesi (WebAudio ile üretiliyor) böylece karışmıyor.
//
// ⚠️ BOT TEMSİLİ DEĞİL: rastgele dokunuyor, çocuk gibi oynamıyor. Ölüm
// süreleri ALT SINIRDIR (gerçek çocuk daha uzun yaşar); soru sıklığı ise
// oyunun kendi ritmini yansıtır çünkü soruyu oyun sorar, oyuncu değil.
import { chromium } from 'playwright';

const B = process.env.BASE || 'http://127.0.0.1:4173';
const SURE = +(process.env.SURE || 60);        // saniye
const OYUNLAR = (process.env.OYUN ||
  'quiz,memory,balloon,sorter,match3,triple,snake,flappy,puzzle,runner,subway,platform,party,kart'
).split(',');

const SAR = () => {
  window.__soru = 0; window.__ilkSoru = null; window.__bitis = null;
  const p = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function () {
    if ((this.src || '').includes('/audio/elifba/')) {
      window.__soru++;
      if (window.__ilkSoru === null) window.__ilkSoru = Math.round(performance.now());
    }
    return p.apply(this, arguments);
  };
  // "oyun bitti" ekranını yakala
  const gozle = () => {
    if (window.__bitis !== null) return;
    const t = document.body.innerText || '';
    if (/Oyun Bitti|Tekrar Oyna|Yeniden Başla|Tebrikler|Bitti!/i.test(t))
      window.__bitis = Math.round(performance.now());
  };
  setInterval(gozle, 300);
};

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
});

console.log(`— ${SURE} sn rastgele oynama, CPU normal —\n`);
console.log('oyun         soru  soru/dk  ilk soru   ilk bitiş');
console.log('─'.repeat(52));
for (const g of OYUNLAR) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.route('**://*.supabase.co/**', (r) => r.abort());
  await p.addInitScript(SAR);
  await p.goto(`${B}/oyunlar/${g}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(2500);
  for (const ad of ['1. Bölümü Oyna', '1. Pistte Yarış', 'Başla']) {
    const d = p.getByRole('button', { name: ad, exact: false }).first();
    if (await d.count() && await d.isVisible().catch(() => false)) {
      await d.click().catch(() => {}); await p.waitForTimeout(2000); break;
    }
  }
  const k = p.getByRole('button', { name: /^🌼/ }).first();
  if (await k.count()) { await k.click().catch(() => {}); await p.waitForTimeout(2000); }

  const t0 = Date.now();
  await p.evaluate(() => { window.__soru = 0; window.__ilkSoru = null; window.__bitis = null; });
  while (Date.now() - t0 < SURE * 1000) {
    const i = Math.floor((Date.now() - t0) / 250);
    await p.mouse.click(50 + (i * 61) % 330, 260 + (i * 97) % 460).catch(() => {});
    if (i % 3 === 0) await p.keyboard.press(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'Digit1', 'Digit2', 'Digit3'][i % 7]).catch(() => {});
    await p.waitForTimeout(250);
  }
  const m = await p.evaluate(() => ({ soru: window.__soru, ilk: window.__ilkSoru, bitis: window.__bitis }));
  const dk = (m.soru / SURE * 60).toFixed(1);
  console.log(`${g.padEnd(11)} ${String(m.soru).padStart(5)} ${dk.padStart(8)} ${(m.ilk === null ? '—' : (m.ilk / 1000).toFixed(1) + ' sn').padStart(10)} ${(m.bitis === null ? 'BİTMEDİ' : (m.bitis / 1000).toFixed(0) + ' sn').padStart(11)}`);
  await ctx.close();
}
await b.close();
