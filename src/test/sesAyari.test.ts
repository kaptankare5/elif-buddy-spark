/**
 * SES AYARI — "Ses Efektleri" anahtarı gerçekten susturuyor mu?
 *
 * ⚠️ SUSTURMUYORDU. `getSettings().sound` yalnız Ayarlar sayfasının kendi
 * `checked` değerinde okunuyordu (grep: bütün kod tabanında TEK yer);
 * `tone`/`gurultu`/`sfx`/`playFeedback` ona hiç bakmıyordu. Yani anahtar
 * aylardır süsten ibaretti — kapatan veli hiçbir fark duymuyordu.
 *
 * ⚠️ KAPI YALNIZ EFEKTLERE OLMALI: `playItem`/`playSpeech` gerçek hoca
 * kayıtlarını çalar ve oyunların sorusu SESLE sorulur. Onları da susturmak
 * uygulamayı oynanamaz yapardı ("soru sormadı, sadece cevaplar vardı").
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let OSC = 0;
let KAYNAK = 0;

function bosParam() {
  return { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {},
           linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} };
}

class SahteCtx {
  currentTime = 0;
  sampleRate = 44100;
  state = "running";
  destination = {};
  resume() { return Promise.resolve(); }
  createOscillator() {
    OSC++;
    return { type: "sine", detune: { value: 0 }, frequency: bosParam(),
             connect: (t: unknown) => t, start() {}, stop() {} };
  }
  createGain() { return { gain: bosParam(), connect: (t: unknown) => t }; }
  createBiquadFilter() {
    return { type: "", Q: { value: 0 }, frequency: bosParam(), connect: (t: unknown) => t };
  }
  createBufferSource() {
    KAYNAK++;
    return { buffer: null, loop: false, connect: (t: unknown) => t, start() {}, stop() {} };
  }
  createBuffer(_c: number, n: number) {
    return { sampleRate: 44100, getChannelData: () => new Float32Array(n) };
  }
}

(globalThis as unknown as { AudioContext: unknown }).AudioContext = SahteCtx;
(globalThis as unknown as { window: { AudioContext: unknown } }).window.AudioContext = SahteCtx;

const { tone, gurultu, motorDongusu, gurultuDongusu, playFeedback } = await import("@/lib/audio");
const { sfx } = await import("@/lib/juice");

function sesAyari(acik: boolean) {
  localStorage.setItem("elifba-settings-v1", JSON.stringify({ sound: acik, vibrate: false }));
}

describe("ses efektleri anahtarı", () => {
  beforeEach(() => { OSC = 0; KAYNAK = 0; });

  it("AÇIKKEN sesler çalıyor", () => {
    sesAyari(true);
    tone(440, 0.1, "sine");
    sfx("topla", { titresim: false });
    expect(OSC).toBeGreaterThan(0);
  });

  it("KAPALIYKEN tek bir osilatör bile açılmıyor", () => {
    sesAyari(false);
    tone(440, 0.1, "sine");
    sfx("topla", { titresim: false });
    sfx("start", { titresim: false });
    void playFeedback(true);
    void playFeedback(false);
    gurultu({ dur: 0.2, bas: 300, tepe: 900, son: 200 });
    expect(OSC, "kapalıyken ton çaldı").toBe(0);
    expect(KAYNAK, "kapalıyken gürültü çaldı").toBe(0);
  });

  /** Sürekli katmanlar da kapıya bağlı — kapatılamayan arka plan sesi olmaz. */
  it("KAPALIYKEN sürekli katmanlar da sessiz ve çağrıları güvenli", () => {
    sesAyari(false);
    const m = motorDongusu();
    const g = gurultuDongusu({ bas: 300, tepe: 1200, gain: 0.05 });
    expect(OSC + KAYNAK, "kapalıyken sürekli katman kuruldu").toBe(0);
    // Sessiz nesne de aynı arayüzü taşımalı: oyun kodu dallanma yapmasın.
    expect(() => { m.ayarla(0.5); m.dur(); g.ayarla(0.5); g.dur(); }).not.toThrow();
  });

  it("AÇIKKEN sürekli motor katmanı gerçekten kuruluyor", () => {
    sesAyari(true);
    const m = motorDongusu();
    expect(OSC, "motor döngüsü osilatör açmadı").toBeGreaterThan(0);
    m.dur();
  });

  /**
   * ⚠️ HARF KAYITLARI KAPIYA BAĞLANMAZ. Bu bir kod okuma testi çünkü
   * `playItem` bir <audio> öğesi çalıyor, osilatör değil.
   */
  it("gerçek harf kayıtları (playItem/playSpeech) kapıdan MUAF", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/audio.ts"), "utf8");
    const govde = (ad: string) => {
      const i = src.indexOf(`export function ${ad}(`);
      const j = src.indexOf("\nexport ", i + 10);
      return src.slice(i, j === -1 ? undefined : j);
    };
    expect(/sfxAcik\(\)/.test(govde("playItem")), "playItem susturuluyor — soru sorulamaz").toBe(false);
    expect(/sfxAcik\(\)/.test(govde("playSpeech")), "playSpeech susturuluyor").toBe(false);
  });
});

/**
 * ⚠️ OYUN MÜZİĞİ VARSAYILAN **KAPALI** (kullanıcı kararı, dinî hassasiyet:
 * "elifbâ harfiyle müzik iyi olmayabilir, kutsal olduğunu düşünenler var").
 * `gameMusic` uygulamanın tek MELODİK katmanıydı ve Macera'da varsayılan
 * AÇIK çalıyordu — yani "müzik yok" kuralının dışında kalmış tek yer.
 * Kod ve düğme duruyor; müzik ancak bilerek açılırsa çalıyor.
 */
describe("oyun müziği (Macera)", () => {
  beforeEach(() => { OSC = 0; localStorage.removeItem("elifba-game-music-muted-v1"); });

  it("hiç dokunulmamışsa SESSİZ", async () => {
    const { gameMusic } = await import("@/lib/gameMusic");
    expect(gameMusic.isMuted(), "müzik varsayılan olarak açık geliyor").toBe(true);
  });

  it("eskiden bilerek kapatanın kararı korunuyor", async () => {
    const { gameMusic } = await import("@/lib/gameMusic");
    localStorage.setItem("elifba-game-music-muted-v1", "1");
    expect(gameMusic.isMuted()).toBe(true);
  });

  it("bilerek açılırsa çalıyor", async () => {
    const { gameMusic } = await import("@/lib/gameMusic");
    localStorage.setItem("elifba-game-music-muted-v1", "0");
    expect(gameMusic.isMuted()).toBe(false);
  });

  /** Sessizken AudioContext bile açılmamalı — duyulmayan iş boşa dönmesin. */
  it("sessizken start() hiçbir ses üretmiyor", async () => {
    const { gameMusic } = await import("@/lib/gameMusic");
    sesAyari(true);
    gameMusic.start(1);
    expect(OSC, "sessizken osilatör açıldı").toBe(0);
    gameMusic.stop();
  });

  /** Ayarlar'dan ses tamamen kapatıldıysa müzik de çalmaz. */
  it("ses efektleri kapalıyken müzik de çalmıyor", async () => {
    const { gameMusic } = await import("@/lib/gameMusic");
    localStorage.setItem("elifba-game-music-muted-v1", "0");
    sesAyari(false);
    gameMusic.start(1);
    expect(OSC).toBe(0);
    gameMusic.stop();
  });
});
