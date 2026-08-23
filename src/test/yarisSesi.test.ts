/**
 * YARIŞ BAŞLANGIÇ SESİ — davranış testi (metin eşleştirmesi DEĞİL).
 *
 * ⚠️ Bu paketteki öteki juice testleri kaynak dosyada dizgi arıyor; ses için
 * bu yetmez, çünkü mesele "çağrı var mı" değil ÇIKAN SESİN KENDİSİ: 3-2-1
 * tiklerinin AYNI perdede olması, "BAŞLA"nın daha TİZ olması. Bu yüzden
 * sahte bir AudioContext kurulup gerçekten hangi osilatörlerin hangi
 * frekansta açıldığı ölçülüyor.
 *
 * Desen motor sporlarının (ve atletizmin) evrensel işareti: aynı perdede N
 * kısa tik, sonra daha tiz ve daha uzun bir "başla". Sayımda perdenin
 * DEĞİŞMEMESİ kasıtlı — yükselen bir sayım son notayı sıradanlaştırır.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type OscKayit = { tip: string; frekanslar: number[] };
let OSC: OscKayit[] = [];
let GURULTU = 0;

function bosParam() {
  return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
}

class SahteCtx {
  currentTime = 0;
  sampleRate = 44100;
  state = "running";
  destination = {};
  resume() { return Promise.resolve(); }
  createOscillator() {
    const k: OscKayit = { tip: "sine", frekanslar: [] };
    OSC.push(k);
    return {
      get type() { return k.tip; },
      set type(v: string) { k.tip = v; },
      detune: { value: 0 },
      frequency: {
        setValueAtTime: (v: number) => k.frekanslar.push(v),
        exponentialRampToValueAtTime: (v: number) => k.frekanslar.push(v),
      },
      connect: (t: unknown) => t,
      start() {}, stop() {},
    };
  }
  createGain() { return { gain: bosParam(), connect: (t: unknown) => t }; }
  createBiquadFilter() {
    return { type: "", Q: { value: 0 }, frequency: bosParam(), connect: (t: unknown) => t };
  }
  createBufferSource() {
    GURULTU++;
    return { buffer: null, loop: false, connect: (t: unknown) => t, start() {}, stop() {} };
  }
  createBuffer(_ch: number, n: number) {
    return { sampleRate: 44100, getChannelData: () => new Float32Array(n) };
  }
}

// ⚠️ AudioContext MODÜL YÜKLENMEDEN ÖNCE kurulmalı: audio.ts bağlamı bir kez
// yaratıp saklıyor, sonradan kurulan sahte hiç kullanılmaz.
(globalThis as unknown as { AudioContext: unknown }).AudioContext = SahteCtx;
(globalThis as unknown as { window: { AudioContext: unknown } }).window ??= { AudioContext: SahteCtx };
(globalThis as unknown as { window: { AudioContext: unknown } }).window.AudioContext = SahteCtx;

const { sfx } = await import("@/lib/juice");

/** En yüksek perdeli osilatörün başlangıç frekansı. */
const enTiz = () => Math.max(...OSC.map((o) => o.frekanslar[0] ?? 0));

describe("yarış başlangıç sesi", () => {
  beforeEach(() => { OSC = []; GURULTU = 0; });

  it("sayım tiki gerçekten ses üretiyor", () => {
    sfx("sayim", { titresim: false });
    expect(OSC.length, "hiç osilatör açılmadı — ses kod yolunda kayboluyor").toBeGreaterThan(0);
  });

  /**
   * ⚠️ ÜÇ TİK BİRBİRİNİN AYNI OLMALI. "Başla"nın farklı olduğu ancak
   * öncekiler tekdüze olunca anlaşılır.
   */
  it("3-2-1 tikleri AYNI perdede", () => {
    sfx("sayim", { titresim: false });
    const bir = OSC.map((o) => o.frekanslar.join(","));
    OSC = [];
    sfx("sayim", { titresim: false });
    const iki = OSC.map((o) => o.frekanslar.join(","));
    expect(iki, "tikler arasında perde değişiyor — sayım yükseliyor").toEqual(bir);
  });

  it("BAŞLA sesi sayım tikinden BELİRGİN tiz", () => {
    sfx("sayim", { titresim: false });
    const tik = enTiz();
    OSC = [];
    sfx("start", { titresim: false });
    const bas = enTiz();
    expect(bas, "başlangıç sesi tikten tiz değil — ikisi ayırt edilemez").toBeGreaterThan(tik * 1.5);
  });

  /**
   * Sesi "geri sayım" değil "YARIŞ geri sayımı" yapan şey motor: perdesi
   * KAYAN testere dalgası. Sabit perdeli bir ton düdük olur.
   */
  it("hem tikte hem başlangıçta motor sesi var (perdesi kayan testere)", () => {
    for (const k of ["sayim", "start"] as const) {
      OSC = [];
      sfx(k, { titresim: false });
      const testere = OSC.filter((o) => o.tip === "sawtooth");
      expect(testere.length, `${k}: motor sesi yok`).toBeGreaterThan(0);
      const kayan = testere.filter((o) => o.frekanslar.length > 1 && o.frekanslar[0] !== o.frekanslar[1]);
      expect(kayan.length, `${k}: motorun perdesi kaymıyor — düdük gibi duyulur`).toBeGreaterThan(0);
    }
  });

  it("başlangıçta gaz AÇILIYOR (perde yükseliyor), tikte yalnız blip", () => {
    sfx("start", { titresim: false });
    const m = OSC.find((o) => o.tip === "sawtooth")!;
    expect(m.frekanslar[m.frekanslar.length - 1]).toBeGreaterThan(m.frekanslar[0] * 3);
  });

  /** Lastik cıyaklaması periyodik değildir — süzülmüş gürültü olmalı. */
  it("başlangıçta lastik cıyaklaması (gürültü) var", () => {
    sfx("start", { titresim: false });
    expect(GURULTU, "gürültü kaynağı açılmadı").toBeGreaterThan(0);
    OSC = []; GURULTU = 0;
    sfx("sayim", { titresim: false });
    expect(GURULTU, "sayım tikinde de cıyaklama var — başlangıç ayırt edilemez").toBe(0);
  });
});

describe("yarış geri sayımı (Yarışı)", () => {
  const kart = readFileSync(join(process.cwd(), "src/pages/games/KartGame.tsx"), "utf8");

  it("sayım sesi SAYI DEĞİŞİNCE çalıyor, her karede değil", () => {
    expect(/let sonSayi = /.test(kart), "sayı takibi yok").toBe(true);
    expect(/if \(shown !== sonSayi\)/.test(kart),
      "ses `shown` hesabının yanında — saniyede 60 bip demek").toBe(true);
    expect(/sfx\(shown > 0 \? "sayim" : "start"\)/.test(kart),
      "tik ve başlangıç sesi ayrılmamış").toBe(true);
  });

  /**
   * ⚠️ ÖLÇÜLDÜ (`tools/perf/sesZaman.mjs`, ~10 fps): sayaç fizik dt'siyle
   * beslendiğinde tikler 1.0 sn yerine 2.0 sn arayla çalıyor, "3-2-1"
   * 3.2 sn yerine 5.8 sn sürüyordu — çünkü `DT_MAX` (0.05) 20 fps'in
   * altındaki her kareyi kırpıyor. Sayaç kelepçesiz süreyi kullanmalı.
   */
  it("sayaç kelepçesiz gerçek süreyi kullanıyor", () => {
    expect(/cd -= Math\.min\(0\.5, dtRaw\)/.test(kart),
      "sayaç DT_MAX ile kelepçeli — yavaş cihazda geri sayım uzuyor").toBe(true);
  });
});
