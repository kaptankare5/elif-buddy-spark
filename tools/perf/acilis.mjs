// Açılış hızı ölçümü — ESKİ paket ile YENİ paketi yan yana koyar.
//
// ⚠️ NEDEN: Capacitor/Play Store'da uygulama YEREL diskten açılıyor, ağ
// beklemesi yok; darboğaz JS'in AYRIŞTIRILMASI ve ÇALIŞTIRILMASI. Bu yüzden
// CPU 4x yavaşlatılır (orta sınıf Android taklidi) — hızlı sunucuda ölçüm
// yanıltıcı çıkar.
//
// ⚠️ FCP'yi PerformanceObserver'a SAYFA AÇILMADAN bağla (addInitScript):
// goto'dan sonra getEntriesByName ile bakmak 0 döndürüyordu, boyanma çoktan
// olmuştu. buffered:true tek başına yetmiyor.
// ⚠️ Supabase istekleri kesilmeli: sandboxta ağ yok, networkidle 13 sn şişiyor.
//
// Kullanım:
//   npx vite build && npx vite preview --port 4173 &     # yeni
//   git stash && npx vite build --outDir /tmp/eski/dist  # eski
//   npx vite preview --outDir /tmp/eski/dist --port 4174 &
//   node tools/perf/acilis.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });

async function olc(port, ad, tur=5) {
  const r = [];
  for (let i=0;i<tur;i++) {
    const ctx = await b.newContext({ viewport:{width:412,height:880}, deviceScaleFactor:2 });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.route('**://*.supabase.co/**', x => x.abort());
    // FCP'yi sayfa AÇILMADAN önce gözlemciye bağla
    await p.addInitScript(() => {
      window.__fcp = new Promise(res => {
        new PerformanceObserver(l => { for (const e of l.getEntries())
          if (e.name === 'first-contentful-paint') res(Math.round(e.startTime)); }).observe({type:'paint', buffered:true});
      });
    });
    await p.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded', timeout:60000 });
    const m = await p.evaluate(async () => ({
      fcp: await Promise.race([window.__fcp, new Promise(r=>setTimeout(()=>r(-1),15000))]),
      dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
      jsBayt: performance.getEntriesByType('resource').filter(x=>x.name.endsWith('.js')).reduce((a,x)=>a+(x.decodedBodySize||0),0),
    }));
    r.push(m); await ctx.close();
  }
  const med = k => r.map(x=>x[k]).sort((a,b)=>a-b)[Math.floor(tur/2)];
  console.log(`${ad.padEnd(6)} FCP ${String(med('fcp')).padStart(5)} ms · DOMContentLoaded ${String(med('dcl')).padStart(5)} ms · JS ${(r[0].jsBayt/1024).toFixed(0).padStart(4)} kB`);
  return [med('fcp'), med('dcl')];
}
console.log('— CPU 4x yavaşlatılmış (orta sınıf Android), 5 tur medyanı —\n');
const [af, ad_] = await olc(4174, 'ESKİ');
const [yf, yd] = await olc(4173, 'YENİ');
const y = (a,b) => a>0&&b>0 ? `%${Math.round((1-b/a)*100)} hızlandı` : 'ölçülemedi';
console.log(`\nİlk boyanma      : ${af} → ${yf} ms   (${y(af,yf)})`);
console.log(`DOMContentLoaded : ${ad_} → ${yd} ms   (${y(ad_,yd)})`);
await b.close();
