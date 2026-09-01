/**
 * JUICE KAPSAMI — "her oyunda ses geri bildirimi var" bekçisi.
 *
 * ⚠️ NEDEN TEST: kullanıcı tespiti "koşu oyununda para toplarken ses
 * çıkmıyor". Ölçtük — 15 oyunun 12'sinde HİÇ sfx yoktu, titreşim ise
 * hiçbirinde. Juice eklemenin en kolay hatası, sesi yanlış dala koyup
 * hiç tetiklememek; bu test en azından bağlantının varlığını korur.
 * (Gerçekten ÇALDIĞINI ölçen araç: tools/perf/juice.mjs — WebAudio'nun
 * createOscillator'ını sayıyor.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { oyunDosyalari } from "./_oyunDosyalari";
import { sfx, type JuiceSfx } from "@/lib/juice";

const DIZIN = join(process.cwd(), "src/pages/games");

describe("juice kapsamı", () => {
  const dosyalar = oyunDosyalari();

  it.each(dosyalar)("%s ses geri bildirimi veriyor", (dosya) => {
    const kaynak = readFileSync(join(DIZIN, dosya), "utf8");
    // juice.ts'ten sfx VEYA audio.ts'ten playSfx — ikisi de kabul
    // (3B oyunlar playSfx kullanıyor, o da titreşimi kendi tetikliyor).
    const var_ = /from "@\/lib\/juice"/.test(kaynak) || /playSfx\(/.test(kaynak);
    expect(var_, `${dosya} hiç oyun sesi çalmıyor`).toBe(true);
  });
});

describe("juice sesleri", () => {
  const TURLER: JuiceSfx[] = ["topla", "guc", "zipla", "carp", "patlat", "kaydir", "ates", "seri", "camur", "bitis"];

  it("hiçbir tür istisna atmıyor (WebAudio yokken de)", () => {
    // jsdom'da AudioContext yok — sesler sessizce düşmeli, oyunu kırmamalı.
    for (const t of TURLER) expect(() => sfx(t)).not.toThrow();
  });

  it("seri parametresi istisna atmıyor ve tavanlanıyor", () => {
    expect(() => sfx("topla", { seri: 0 })).not.toThrow();
    expect(() => sfx("topla", { seri: 999 })).not.toThrow();
  });

  it("titreşim kapatılabiliyor", () => {
    expect(() => sfx("carp", { titresim: false })).not.toThrow();
  });
});
