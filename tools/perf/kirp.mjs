// KIRP — bir ekran görüntüsünün küçük bir bölgesini kesip BÜYÜTÜR.
//
// ⚠️ NEDEN: telefon ölçüsünde (412×880) çekilen kareyi olduğu gibi
// incelemek yetmiyor; tekerlek göbeği, harf işareti gibi küçük şeyler
// birkaç piksel kalıyor ve "düzeldi mi" sorusu göz kararına düşüyor.
//
// Kullanım:
//   node tools/perf/kirp.mjs kaynak.png cikti.png X Y GENİŞLİK YÜKSEKLİK [ZOOM]
//   (koordinatlar KAYNAK dosyanın kendi pikselinde — ekran.mjs
//    deviceScaleFactor 2 ile çektiği için 412×880 ekran 824×1760 olur.)
import { chromium } from "playwright";
const [src, out, x, y, w, h, zoom = "3"] = process.argv.slice(2);
const fs = await import("node:fs/promises");
const b64 = (await fs.readFile(src)).toString("base64");
const z = +zoom;
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await br.newPage({ viewport: { width: Math.round(+w * z), height: Math.round(+h * z) } });
await p.setContent(`<style>*{margin:0}body{overflow:hidden}img{position:absolute;left:0;top:0;transform-origin:0 0;transform:scale(${z}) translate(${-x}px,${-y}px);image-rendering:pixelated}</style><img src="data:image/png;base64,${b64}">`);
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await br.close();
console.log("kırpıldı →", out);
