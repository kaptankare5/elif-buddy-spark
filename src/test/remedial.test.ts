// TELAFİ POLİTİKASI testleri.
//
// Kullanıcı şartı iki taraflı: (a) başta/ortada/sonda hâlinde hata yapınca
// o harfin hafıza yöntemi önüne gelsin, (b) AMA her yanlışta değil —
// "çocuğu sürekli karşısına çıkartıp da sıkmasın".
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  considerRemedy, showRemedy, queueRemedy, releaseRemedy, hasQueuedRemedy,
  __resetRemedial, REMEDY_LIMITS, REMEDY_EVENT,
} from "@/lib/remedial";
import {
  recordConfusionPick, resetConfusion, __resetConfusionCache,
} from "@/lib/confusion";

// Ayn (18) kuyruklu, Be (2) nokta ailesi, Elif (1) değişmeyen 6'dan
const AYN_MED = "l2-18-med", AYN_INIT = "l2-18-init", AYN_FIN = "l2-18-fin";
const GAYN_MED = "l2-19-med";
const BE_INIT = "l2-02-init", NUN_INIT = "l2-25-init";
const ELIF_FIN = "l2-01-fin", LEM_FIN = "l2-23-fin";

/** İkiliyi eşiğin üstüne ısıt (iki ısrarlı hata = 0.68 > 0.5) */
const heatUp = (a: string, b: string) => {
  recordConfusionPick(a, b);
  recordConfusionPick(a, b);
};

beforeEach(() => {
  localStorage.clear();
  __resetConfusionCache();
  resetConfusion();
  __resetRemedial();
});

describe("ne zaman telafi ÇIKMAZ", () => {
  it("tek şanssız hatada çıkmaz (ısrar şartı)", () => {
    recordConfusionPick(AYN_MED, GAYN_MED);           // ısı 0.34 < 0.5
    expect(considerRemedy(AYN_MED, GAYN_MED)).toBeNull();
  });

  it("başta/ortada/sonda konusu dışındaki hatalarda çıkmaz", () => {
    heatUp("l1-18", "l1-19");                          // düz harf konusu
    expect(considerRemedy("l1-18", "l1-19")).toBeNull();
    heatUp("l3-18-fetha", "l3-19-fetha");              // hareke konusu
    expect(considerRemedy("l3-18-fetha", "l3-19-fetha")).toBeNull();
  });

  it("aynı harf için arka arkaya çıkmaz (harf soğuması)", () => {
    heatUp(AYN_MED, GAYN_MED);
    const first = considerRemedy(AYN_MED, GAYN_MED);
    expect(first).not.toBeNull();
    showRemedy(first!);
    // aynı harfin BAŞKA hâlinde bile hemen tekrar çıkmaz
    heatUp(AYN_INIT, GAYN_MED);
    expect(considerRemedy(AYN_INIT, GAYN_MED)).toBeNull();
  });

  it("farklı harf olsa da genel soğuma dolmadan çıkmaz", () => {
    heatUp(AYN_MED, GAYN_MED);
    showRemedy(considerRemedy(AYN_MED, GAYN_MED)!);
    heatUp(BE_INIT, NUN_INIT);
    expect(considerRemedy(BE_INIT, NUN_INIT)).toBeNull();
  });

  it("bir seansta en fazla 3 telafi", () => {
    vi.useFakeTimers();
    try {
      const pairs: [string, string][] = [
        [AYN_MED, GAYN_MED], [BE_INIT, NUN_INIT], [ELIF_FIN, LEM_FIN], [AYN_FIN, GAYN_MED],
      ];
      let shown = 0;
      for (const [a, b] of pairs) {
        vi.advanceTimersByTime(REMEDY_LIMITS.LETTER_COOLDOWN_MS + 1000);
        heatUp(a, b);
        const r = considerRemedy(a, b);
        if (r) { showRemedy(r); shown++; }
      }
      expect(shown).toBe(REMEDY_LIMITS.SESSION_MAX);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ne zaman telafi ÇIKAR ve hangi yöntem", () => {
  it("Ayn'ın ortadaki hâlini kendi başta hâliyle karıştırdı → bacağını sildirir", () => {
    heatUp(AYN_MED, AYN_INIT);
    const r = considerRemedy(AYN_MED, AYN_INIT);
    expect(r).toMatchObject({ itemId: AYN_MED, letter: 18, kind: "kuyruk" });
  });

  it("Ayn'ı Gayn'la karıştırdı → aradaki tek fark NOKTA olduğu için nokta yöntemi", () => {
    heatUp(AYN_MED, GAYN_MED);
    expect(considerRemedy(AYN_MED, GAYN_MED)?.kind).toBe("nokta");
  });

  it("BAŞKA HARFLE karıştırdıysa → nokta yöntemi (ayırt edici işaret nokta)", () => {
    heatUp(BE_INIT, NUN_INIT);
    expect(considerRemedy(BE_INIT, NUN_INIT)?.kind).toBe("nokta");
  });

  it("AYNI harfin başka hâliyle karıştırdıysa → kuyruk yöntemi", () => {
    // Be'nin hem kuyruk kuralı hem nokta ailesi var; ders karıştırdığı eksene bağlı
    heatUp(BE_INIT, "l2-02-fin");
    expect(considerRemedy(BE_INIT, "l2-02-fin")?.kind).toBe("kuyruk");
  });

  it("değişmeyen 6 harften birinde → 'hiç değişmez' hatırlatması", () => {
    heatUp(ELIF_FIN, LEM_FIN);
    expect(considerRemedy(ELIF_FIN, LEM_FIN)?.kind).toBe("sabit");
  });

  it("soğuma dolunca aynı harf için tekrar çıkar", () => {
    vi.useFakeTimers();
    try {
      heatUp(AYN_MED, GAYN_MED);
      showRemedy(considerRemedy(AYN_MED, GAYN_MED)!);
      vi.advanceTimersByTime(REMEDY_LIMITS.LETTER_COOLDOWN_MS + 1000);
      expect(considerRemedy(AYN_MED, GAYN_MED)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("oyun akışı: ortada değil, SONUNDA", () => {
  afterEach(() => { __resetRemedial(); });

  it("kuyruğa alınır, oyun bitene kadar olay yayınlanmaz", () => {
    const seen: unknown[] = [];
    const h = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(REMEDY_EVENT, h);
    try {
      heatUp(AYN_MED, GAYN_MED);
      queueRemedy(considerRemedy(AYN_MED, GAYN_MED));
      expect(hasQueuedRemedy()).toBe(true);
      expect(seen).toHaveLength(0);        // oyun sürerken hiçbir şey açılmaz

      releaseRemedy();                     // oyun bitti
      expect(seen).toHaveLength(1);
      expect(hasQueuedRemedy()).toBe(false);
      releaseRemedy();                     // ikinci kez bir şey çıkmaz
      expect(seen).toHaveLength(1);
    } finally {
      window.removeEventListener(REMEDY_EVENT, h);
    }
  });
});
