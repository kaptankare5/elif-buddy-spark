/**
 * SADE ÇALIŞMA (Flashcard) — kullanıcı isteği: "flashcard kısmında bir de
 * motivasyonsuz fulle öğrenme modu ekle, ayarlara da seçme hakkı koy."
 *
 * ⚠️ NE KAPANIR, NE KAPANMAZ: kapanan şey MOTİVASYON ögeleri (seviye rozeti +
 * yıldızlar, oturum sayacı, kart üstündeki seviye) ve SRS'in sürpriz sırası
 * (kurtarma kartı, karışan partner, serpiştirilmiş bakım, denetim kartı).
 * KAPANMAYAN şey ÖĞRENME KAYDI: cevaplar yine SRS'e yazılır — yoksa mod
 * "çalıştım ama hiçbir şey sayılmadı" demek olurdu.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSettings, setSettings } from "@/lib/settings";

const oku = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("sade flashcard modu", () => {
  beforeEach(() => localStorage.clear());

  it("varsayılan KAPALI", () => {
    // Normal mod (SRS sırası + rozet) çoğu çocuk için daha iyi öğretiyor;
    // sade mod "bu konuyu bir baştan geçelim" diyen veli/hoca içindir.
    expect(getSettings().flashcardSade).toBe(false);
  });

  it("ayar kalıcı ve okunabilir", () => {
    setSettings({ flashcardSade: true });
    expect(getSettings().flashcardSade).toBe(true);
    setSettings({ flashcardSade: false });
    expect(getSettings().flashcardSade).toBe(false);
  });

  it("Ayarlar'da seçme hakkı var", () => {
    const src = oku("src/pages/Settings.tsx");
    expect(/checked=\{s\.flashcardSade\}/.test(src), "Ayarlar'da anahtar yok").toBe(true);
    expect(/set\(\{ flashcardSade: v \}\)/.test(src), "anahtar ayarı yazmıyor").toBe(true);
  });

  it("sade modda seçici devre dışı — deste SIRAYLA dönülür", () => {
    const src = oku("src/pages/Flashcard.tsx");
    // Erken dönüş, seçicinin (denetim/kurtarma/partner/bakım) ÖNÜNDE olmalı.
    const sadeDal = src.indexOf("if (sade) {");
    const denetim = src.indexOf("if (auditDue())");
    expect(sadeDal, "sade dalı yok").toBeGreaterThan(-1);
    expect(sadeDal, "sade dalı seçicinin ardında — denetim kartı yine çıkar")
      .toBeLessThan(denetim);
    expect(/sadeIdx\.current = \(sadeIdx\.current \+ 1\) % itemIds\.length/.test(src),
      "deste sırayla ilerlemiyor").toBe(true);
  });

  it("motivasyon ögeleri gizli, ama SRS kaydı duruyor", () => {
    const src = oku("src/pages/Flashcard.tsx");
    expect(/\{!sade && \(/.test(src) || /\{!sade &&/.test(src),
      "seviye rozeti/sayaç sade modda da görünüyor").toBe(true);
    expect(/\{!sade && <LevelBadge/.test(src), "kart üstü seviye rozeti gizlenmiyor").toBe(true);
    // ⚠️ Kayıt kapatılmamalı: `recordSrsAnswer` çağrısı sade moda bağlanmamış olmalı.
    expect(/if \(sade\)[\s\S]{0,200}recordSrsAnswer/.test(src),
      "sade modda SRS kaydı atlanıyor — çalışma boşa gider").toBe(false);
  });
});
