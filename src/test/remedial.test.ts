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
import { DOT_GROUPS, STROKE_PAIRS } from "@/data/writingMnemonics";
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

  it("Ayn'ı Ğayn'la karıştırdı → aradaki tek fark NOKTA olduğu için nokta yöntemi", () => {
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

  it("Elif'i Lem'in SONDA hâliyle karıştırdı → çizgi dersi DEĞİL, 'hiç değişmez'", () => {
    // Lem'in sonda hâlinde derin çanak var; bu ikili karışan sayılmaz, o
    // yüzden çizgi karşılaştırması açılmamalı (form körlüğü hatasının bekçisi).
    heatUp(ELIF_FIN, LEM_FIN);
    expect(considerRemedy(ELIF_FIN, LEM_FIN)?.kind).toBe("sabit");
  });

  it("Elif'i Lem'in BAŞTA hâliyle karıştırdı → ÇİZGİ dersi", () => {
    // Elif ا ile Lem'in başta hâli ﻟ ikisi de düz dikey çizgi; noktası olmayan
    // tek karışan ikili. Nokta yöntemi burada işe yaramaz.
    const ELIF_INIT = "l2-01-init", LEM_INIT = "l2-23-init";
    heatUp(ELIF_INIT, LEM_INIT);
    const r = considerRemedy(ELIF_INIT, LEM_INIT);
    expect(r?.kind).toBe("cizgi");
    expect(r?.partner).toBe(23);
  });

  it("Elif'i Lem'in ORTADA hâliyle karıştırdı → ÇİZGİ dersi", () => {
    const ELIF_MED = "l2-01-med", LEM_MED = "l2-23-med";
    heatUp(ELIF_MED, LEM_MED);
    expect(considerRemedy(ELIF_MED, LEM_MED)?.kind).toBe("cizgi");
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

// NOKTA GRUPLARI ikişerli oldu (Nun–Be 1 nokta, Ye–Te 2 nokta,
// Şın–Peltek Se 3 nokta). Şın artık İKİ grupta: "Sin · Şin" (aynı iskelet)
// ve "Şın ile Peltek Se" (aynı nokta sayısı). Telafi ekranı doğru
// karşılaştırmayı seçebilsin diye karıştırılan harf Remedy'ye taşınır.
describe("nokta grupları ve telafi partneri", () => {
  afterEach(() => { __resetRemedial(); });

  it("her nokta grubu en fazla 2 harf ve grup içi nokta sayısı aynı", () => {
    for (const g of DOT_GROUPS) {
      expect(g.letters.length).toBeLessThanOrEqual(3);
    }
    const nokta = DOT_GROUPS.filter((g) => g.id.startsWith("nokta-"));
    expect(nokta.map((g) => g.id)).toEqual(["nokta-1", "nokta-2", "nokta-3"]);
    for (const g of nokta) {
      expect(g.letters).toHaveLength(2);
      const [a, b] = g.letters;
      expect(a.dots).toBe(b.dots);          // ikili AYNI nokta sayısında
    }
    // 1 ve 2 noktalı ikililerde nokta YERİ farklı olmalı (ayırt edici bu)
    const bir = nokta[0].letters, iki = nokta[1].letters;
    expect(bir[0].where).not.toBe(bir[1].where);
    expect(iki[0].where).not.toBe(iki[1].where);
    // 3 noktalıda ikisi de üstte — ayrım DİŞ sayısında, o yüzden sharedNote var
    expect(nokta[2].letters.every((l) => l.where === "ust")).toBe(true);
    expect(nokta[2].sharedNote).toBeTruthy();
  });

  it("considerRemedy karıştırılan harfi partner olarak taşır", () => {
    heatUp(BE_INIT, NUN_INIT);
    const r = considerRemedy(BE_INIT, NUN_INIT);
    expect(r?.letter).toBe(2);              // Be
    expect(r?.partner).toBe(25);            // Nun
  });

  it("Şın için partner, hangi grubun gösterileceğini belirler", () => {
    // RemedyOverlay'in yaptığı aramanın aynısı
    const grupFor = (letter: number, partner?: number) =>
      (partner != null
        ? DOT_GROUPS.find((g) =>
            g.letters.some((l) => l.n === letter) && g.letters.some((l) => l.n === partner))
        : undefined)
      ?? DOT_GROUPS.find((g) => g.letters.some((l) => l.n === letter));

    expect(grupFor(13, 12)?.id).toBe("sin");        // Şın'ı Sin'le karıştırdı
    expect(grupFor(13, 4)?.id).toBe("nokta-3");     // Şın'ı Peltek Se'yle karıştırdı
    expect(grupFor(4)?.id).toBe("nokta-3");         // Peltek Se tek grupta
  });
});

// ÇİZGİ KARTININ KUR'AN ÖRNEKLERİ — iki bekçi:
//  (1) Harekeler yalnız fetha/esre/ötre. Cezm ve şedde konusuna daha
//      gelinmedi; tanımadığı işaret çocuğun dikkatini kuraldan kaçırır.
//  (2) Lem'den HEMEN SONRA Elif gelmesin. "ل + ا" ekranda zorunlu olarak tek
//      bir "لا" bitişik harfine dönüşür — kartın öğrettiği "Lem'in ortadaki
//      hâli" o kelimede hiç görünmez. (كَلَامَ bu yüzden elendi.)
describe("çizgi kartı — Kur'an örneği kısıtları", () => {
  const FETHA = "َ", ESRE = "ِ", OTRE = "ُ";
  const IZINLI = new Set([FETHA, ESRE, OTRE]);
  // Arapça birleşen işaretler bloğu: 064B-065F + 0670 (küçük elif)
  const isaretMi = (c: string) => {
    const cp = c.codePointAt(0)!;
    return (cp >= 0x064b && cp <= 0x065f) || cp === 0x0670;
  };
  const LEM = "ل", ELIF = "ا";

  const ornekler = STROKE_PAIRS.flatMap((p) =>
    Object.entries(p.quran ?? {}).map(([form, q]) => ({ id: `${p.id}/${form}`, ...q })));

  it("en az bir örnek var ve her hâl için ayrı", () => {
    expect(ornekler.length).toBeGreaterThanOrEqual(2);
    for (const o of ornekler) expect(o.okunus && o.kaynak && o.not).toBeTruthy();
  });

  it("yalnız fetha/esre/ötre — cezm, şedde, tenvin, med yok", () => {
    for (const o of ornekler) {
      const yasak = [...o.ar].filter((c) => isaretMi(c) && !IZINLI.has(c));
      expect(yasak, `${o.id} → ${o.ar}`).toEqual([]);
    }
  });

  it("Lem'in hemen ardından Elif gelmez (لا bitişik harfi kuralı gizler)", () => {
    for (const o of ornekler) {
      const harfler = [...o.ar].filter((c) => !isaretMi(c));   // harekeleri at
      for (let i = 0; i < harfler.length - 1; i++) {
        expect(
          harfler[i] === LEM && harfler[i + 1] === ELIF,
          `${o.id} → ${o.ar} içinde لا var`,
        ).toBe(false);
      }
    }
  });

  it("her örnekte hem Elif hem Lem geçer (kural iki taraflı gösterilsin)", () => {
    for (const o of ornekler) {
      expect([...o.ar], `${o.id}`).toContain(ELIF);
      expect([...o.ar], `${o.id}`).toContain(LEM);
    }
  });
});
