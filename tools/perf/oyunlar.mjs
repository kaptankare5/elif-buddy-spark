// OYUN KARE HIZI ÖLÇÜMÜ — her oyunu açar, oynatır, FPS ve hata toplar.
//
// ⚠️ CPU 4x yavaşlatılır: geliştirme makinesinde her oyun 60 fps veriyor,
// çocuğun telefonunda vermiyor. Play Store hedefi orta sınıf Android.
// ⚠️ Ölçüm oyun BAŞLADIKTAN sonra: çoğu oyun "dokun ve başla" duraklamasıyla
// açılıyor, duraklamadayken rAF dönmüyor ve fps 0 okunuyor.
import { chromium } from 'playwright';

const B = process.env.BASE || 'http://127.0.0.1:4173';
// OYUN=subway,kart ile daralt; CPU=1 ile yavaşlatmayı kapat.
const OYUNLAR = (process.env.OYUN || 'quiz,memory,balloon,sorter,match3,triple,snake,flappy,puzzle,runner,subway,platform,party,kart').split(',');

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

console.log('oyun        fps(med)  min   kare>50ms  yükleme  hata');
console.log('─'.repeat(62));
const rapor = [];
for (const g of OYUNLAR) {
  const ctx = await b.newContext({ viewport:{width:412,height:880}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  const hata = [];
  p.on('pageerror', e => hata.push(String(e).split('\n')[0].slice(0,90)));
  p.on('console', m => { if (m.type()==='error' && !/supabase|net::/i.test(m.text())) hata.push(m.text().slice(0,90)); });
  await p.route('**://*.supabase.co/**', r => r.abort());
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });

  const t0 = Date.now();
  try {
    await p.goto(`${B}/oyunlar/${g}`, { waitUntil:'domcontentloaded', timeout:45000 });
    await p.waitForFunction(() => !document.body.innerText.includes('Yükleniyor…'), { timeout:30000 }).catch(()=>{});
    await p.waitForTimeout(2500);                       // sahne kurulsun
    const yukleme = Date.now() - t0;

    // ⚠️ OYUNU GERÇEKTEN BAŞLAT. Partisi ve Yarışı bölüm/pist SEÇME ekranıyla
    // açılıyor; orada rAF boşta döndüğü için ölçüm "60 fps, min 60" veriyordu
    // — oyun hiç çalışmamıştı. Menü düğmesine basılmazsa ölçüm YALANDIR.
    for (const ad of ['1. Bölümü Oyna', '1. Pistte Yarış', 'Başla']) {
      const d = p.getByRole('button', { name: ad, exact: false }).first();
      if (await d.count() && await d.isVisible().catch(()=>false)) {
        await d.click().catch(()=>{}); await p.waitForTimeout(2500); break;
      }
    }
    // Macera: 1. bölüm karosu
    const kilitsiz = p.getByRole('button', { name: /^🌼/ }).first();
    if (await kilitsiz.count()) { await kilitsiz.click().catch(()=>{}); await p.waitForTimeout(2500); }

    const box = p.viewportSize();
    await p.mouse.click(box.width/2, box.height*0.6).catch(()=>{});
    await p.keyboard.press('Space').catch(()=>{});
    await p.keyboard.press('ArrowRight').catch(()=>{});
    await p.waitForTimeout(1500);

    // 3B oyunlarda canvas ŞART — yoksa hâlâ menüdeyiz, ölçümü işaretle
    const canvasVar = await p.locator('canvas').count();
    const menudeMi = ['subway','platform','party','kart'].includes(g) && canvasVar === 0;

    const m = await p.evaluate(() => new Promise(res => {
      const kare = []; let son = performance.now(); const bit = son + 6000;
      const tik = t => { kare.push(t - son); son = t; t < bit ? requestAnimationFrame(tik) : res(kare); };
      requestAnimationFrame(tik);
    }));
    const d = m.slice(2).filter(x => x > 0).sort((a,b)=>a-b);
    if (!d.length) { console.log(`${g.padEnd(11)} —  rAF dönmüyor (durakta)`); await ctx.close(); continue; }
    const med = d[Math.floor(d.length/2)], enKotu = d[d.length-1];
    const takilma = d.filter(x => x > 50).length;
    const satir = `${g.padEnd(11)} ${(1000/med).toFixed(0).padStart(5)}  ${(1000/enKotu).toFixed(0).padStart(4)}  ${String(takilma).padStart(8)}  ${String(yukleme+'ms').padStart(7)}  ${menudeMi?'⚠ MENÜDE':(hata.length?'⚠ '+hata.length:'✓')}`;
    console.log(satir);
    rapor.push({ g, fps: +(1000/med).toFixed(0), takilma, yukleme, hata: [...new Set(hata)] });
  } catch (e) {
    console.log(`${g.padEnd(11)} HATA: ${String(e).split('\n')[0].slice(0,60)}`);
    rapor.push({ g, fps: 0, hata:[String(e).slice(0,90)] });
  }
  await ctx.close();
}
console.log('\n— HATALAR —');
let v = false;
for (const r of rapor) if (r.hata?.length) { v = true; console.log(`  ${r.g}: ${r.hata.join(' | ')}`); }
if (!v) console.log('  YOK ✓');
const yavas = rapor.filter(r => r.fps && r.fps < 30);
console.log('\n— 30 fps ALTI —');
console.log(yavas.length ? yavas.map(r=>`  ${r.g}: ${r.fps} fps`).join('\n') : '  YOK ✓');
await b.close();
