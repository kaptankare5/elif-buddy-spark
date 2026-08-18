// 3B OYUN MALİYETİ — cihazdan BAĞIMSIZ ölçüm.
//
// ⚠️ BU SANDBOXTA GPU YOK (swiftshader = yazılım rasterleştirici). fps ölçmek
// yanıltıcı: profilde %83 `(program)` çıkıyor, yani yazılım rasterleştirme.
// Gerçek telefonda GPU var. Bu yüzden fps yerine GPU'dan bağımsız büyüklükler
// ölçülür: kare başına ÇİZİM ÇAĞRISI, ÜÇGEN, doku belleği ve JS kare süresi.
// Mobil GPU'da asıl darboğaz bunlar (özellikle çizim çağrısı sayısı).
import { chromium } from 'playwright';

const B = 'http://127.0.0.1:4173';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });

const SAY = () => {
  const w = (proto) => {
    if (!proto) return;
    for (const ad of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']) {
      const o = proto[ad]; if (!o) continue;
      proto[ad] = function (mode, a, b2, c) {
        window.__cizim = (window.__cizim||0) + 1;
        const n = ad.startsWith('drawElements') ? a : b2;
        window.__ucgen = (window.__ucgen||0) + (mode === 4 ? n/3 : n);   // TRIANGLES
        return o.apply(this, arguments);
      };
    }
  };
  w(window.WebGL2RenderingContext?.prototype); w(window.WebGLRenderingContext?.prototype);
  const t = window.WebGLRenderingContext?.prototype?.texImage2D;
  window.__kare = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t2) => { window.__kare++; cb(t2); });
};

console.log('oyun      çizim/kare  üçgen/kare   ms/kare   canvas piksel (uyarlanır çözünürlük)');
console.log('─'.repeat(60));
for (const g of ['subway','party','kart']) {
  const ctx = await b.newContext({ viewport:{width:412,height:880}, deviceScaleFactor:2 });
  const p = await ctx.newPage();
  await p.route('**://*.supabase.co/**', r => r.abort());
  await p.addInitScript(SAY);
  // Uyarlanır çözünürlük GERÇEKTEN devreye giriyor mu: canvas'ın backing
  // store boyutu düşmeli. Yarışı bir dönem 824×1760'ta ÇAKILI kalıyordu.
  await p.addInitScript(() => { window.__ol = []; setInterval(() => {
    const c = document.querySelector('canvas'); if (c) window.__ol.push(c.width + '×' + c.height);
  }, 500); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(`${B}/oyunlar/${g}`, { waitUntil:'domcontentloaded', timeout:45000 });
  await p.waitForTimeout(3000);
  for (const ad of ['1. Bölümü Oyna','1. Pistte Yarış','Başla']) {
    const d = p.getByRole('button', { name: ad, exact:false }).first();
    if (await d.count() && await d.isVisible().catch(()=>false)) { await d.click(); await p.waitForTimeout(2500); break; }
  }
  await p.mouse.click(206, 520).catch(()=>{}); await p.keyboard.press('Space').catch(()=>{});
  await p.waitForTimeout(2000);

  const m = await p.evaluate(() => new Promise(res => {
    const c0 = window.__cizim||0, u0 = window.__ucgen||0, k0 = window.__kare||0;
    setTimeout(() => res({ cizim: (window.__cizim||0)-c0, ucgen: (window.__ucgen||0)-u0, kare: (window.__kare||0)-k0 }), 5000);
  }));
  if (!m.kare) { console.log(`${g.padEnd(9)} rAF dönmedi`); await ctx.close(); continue; }
  const ol = [...new Set(await p.evaluate(() => window.__ol))];
  console.log(`${g.padEnd(9)} ${(m.cizim/m.kare).toFixed(0).padStart(9)}  ${(m.ucgen/m.kare/1000).toFixed(1).padStart(9)}k  ${(5000/m.kare).toFixed(1).padStart(10)}   ${ol.join(' → ')}`);
  await ctx.close();
}
await b.close();
