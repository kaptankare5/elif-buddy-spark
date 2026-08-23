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
