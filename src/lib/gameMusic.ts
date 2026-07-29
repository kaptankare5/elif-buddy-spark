// 🎵 Üretken oyun ambiyansı — dosyasız, tamamen WebAudio sentezi.
// Pentatonik dizi + yumuşak üçgen "pluck" + derin sine dron = nazik ninni
// hissi. ÇOK KISIK tutulur: gerçek hoca seslerinin/soruların ÜZERİNE binmez
// (payload kutsal; bu yalnız paket/atmosfer katmanı). Bölüm numarası kök
// notayı seçer → her bölüm hafifçe farklı tınlar.
// Kapatma kalıcıdır (localStorage) — çocuk/veli tercihi korunur.

const MUTE_KEY = "elifba-game-music-muted-v1";

// Majör pentatonik aralıklar (yarım ton) — hangi sırayla çalınırsa çalınsın
// yanlış nota yoktur; çocuk müziği için güvenli seçim.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const ROOTS = [220, 196, 233.08, 207.65, 246.94]; // A3 G3 A#3 G#3 B3 — bölüme göre

class GameMusic {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private root = 220;
  private step = 0;

  isMuted(): boolean {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
  }

  setMuted(m: boolean) {
    try {
      if (m) localStorage.setItem(MUTE_KEY, "1");
      else localStorage.removeItem(MUTE_KEY);
    } catch { /* */ }
    if (this.master) this.master.gain.value = m ? 0 : 1;
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.isMuted() ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private note(freq: number, dur: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + 0.02;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private tick = () => {
    if (!this.running) return;
    this.step++;
    // Melodi: her vuruşta %65 ihtimalle yumuşak pluck (sessizlik de müziktir);
    // rastgele gezinme yerine küçük adımlar → sakin, öngörülebilir hat.
    if (Math.random() < 0.65) {
      const idx = Math.min(PENTA.length - 1, Math.max(0,
        (this.step * 3 + Math.floor(Math.random() * 3)) % PENTA.length));
      const semi = PENTA[idx];
      this.note(this.root * 2 * Math.pow(2, semi / 12), 0.9, 0.028, "triangle");
    }
    // Dron: her 8 vuruşta bir derin, uzun sine — zemin hissi.
    if (this.step % 8 === 1) this.note(this.root / 2, 3.2, 0.02, "sine");
    this.timer = setTimeout(this.tick, 640 + Math.random() * 240);
  };

  start(levelSeed = 1) {
    if (!this.ensureCtx()) return;
    this.root = ROOTS[(levelSeed - 1 + ROOTS.length) % ROOTS.length];
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.tick();
  }

  stop() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
}

export const gameMusic = new GameMusic();
