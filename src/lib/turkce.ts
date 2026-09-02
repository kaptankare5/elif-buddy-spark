// 🇹🇷 TÜRKÇE EK ÜRETİMİ — arayüz metinleri elle yazılmış eklerle bozuluyordu.
//
// ⚠️ NEDEN GEREKLİ: Kuyruk Atölyesi'nde etiket `${rule.tailName}ı sil` diye
// kuruluyordu ve ekranda **"çanakı sil"** yazıyordu — doğrusu "çanağı sil".
// Türkçede iki kural birden işliyor:
//   1. ÜNLÜ UYUMU: ek, kelimenin son ünlüsüne göre değişir (a/ı→ı, e/i→i,
//      o/u→u, ö/ü→ü). "çanak"→çanağ-I ama "kuyruk"→kuyruğ-U.
//   2. ÜNSÜZ YUMUŞAMASI: çok heceli kelimenin sonundaki sert ünsüz, ünlüyle
//      başlayan ek gelince yumuşar (k→ğ, p→b, t→d, ç→c).
// İkisini elle yazmak, veri her değiştiğinde yeni bir yazım hatası demek.
//
// ⚠️ TEK HECELİLERDE YUMUŞAMA GENELDE OLMAZ ("ok→oku" değil "ok→oku"… ama
// "kök→kökü"): kural tek heceli sözcüklerin çoğunda işlemez, bu yüzden
// yumuşatma yalnız ÇOK HECELİ kelimelere uygulanır. Uygulamadaki bütün
// kuyruk adları çok heceli (çanak, kuyruk).

const UNLULER = "aeıioöuü";
const KALIN_DUZ = "aı", INCE_DUZ = "ei", KALIN_YUVARLAK = "ou", INCE_YUVARLAK = "öü";

/** Kelimenin son ünlüsü. */
function sonUnlu(k: string): string {
  for (let i = k.length - 1; i >= 0; i--) {
    const c = k[i].toLocaleLowerCase("tr");
    if (UNLULER.includes(c)) return c;
  }
  return "a";
}

/** Dört biçimli ek ünlüsü (ı/i/u/ü) — büyük ünlü + düzlük-yuvarlaklık uyumu. */
export function ekUnlusu(kelime: string): "ı" | "i" | "u" | "ü" {
  const v = sonUnlu(kelime);
  if (KALIN_DUZ.includes(v)) return "ı";
  if (INCE_DUZ.includes(v)) return "i";
  if (KALIN_YUVARLAK.includes(v)) return "u";
  if (INCE_YUVARLAK.includes(v)) return "ü";
  return "ı";
}

const YUMUSAMA: Record<string, string> = { k: "ğ", p: "b", t: "d", ç: "c" };

/** Heceleri say (ünlü sayısı). */
const heceSayisi = (k: string) =>
  [...k.toLocaleLowerCase("tr")].filter((c) => UNLULER.includes(c)).length;

/** Ünlüyle başlayan ek gelmeden önce kök: çok hecelide son sert ünsüz yumuşar. */
export function yumusat(kelime: string): string {
  if (heceSayisi(kelime) < 2) return kelime;
  const son = kelime[kelime.length - 1].toLocaleLowerCase("tr");
  const yeni = YUMUSAMA[son];
  return yeni ? kelime.slice(0, -1) + yeni : kelime;
}

/** Belirtme hâli: "çanak" → "çanağı", "kuyruk" → "kuyruğu", "baş" → "başı". */
export function belirtmeHali(kelime: string): string {
  const v = ekUnlusu(kelime);
  const son = kelime[kelime.length - 1].toLocaleLowerCase("tr");
  if (UNLULER.includes(son)) return `${kelime}y${v}`;   // ünlüyle bitiyorsa kaynaştırma
  return `${yumusat(kelime)}${v}`;
}

/** İyelik + belirtme: "çanak" → "çanağını", "kuyruk" → "kuyruğunu". */
export function iyelikBelirtme(kelime: string): string {
  const v = ekUnlusu(kelime);
  const son = kelime[kelime.length - 1].toLocaleLowerCase("tr");
  if (UNLULER.includes(son)) return `${kelime}s${v}n${v}`;
  return `${yumusat(kelime)}${v}n${v}`;
}
