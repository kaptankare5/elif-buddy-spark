// SİPARİŞ KATMANI — eşleştirme oyunlarını "harf gerektiren" hâle getirir.
//
// ⚠️ NEDEN VAR: ölçüldü — Üçlü Eşleştir ve Üçlü Eşle eşleşmeyi `item.id`
// eşitliğiyle buluyor. Yani aynı ŞEKLİ üçlemek yeterli; tek harf bilmeyen
// çocuk iki oyunu da kusursuz oynayabiliyor. Harflerin yerine şeker koysanız
// oyun bire bir aynı kalır. Eğitim oyunu tasarımında bunun adı "çikolata
// kaplı brokoli": öğrenme, oyunun yanına iliştirilmiş.
//
// ⚠️ SİPARİŞ **KAPI DEĞİL BONUS** — bu en kritik karar (kullanıcı sorusu:
// "sadece 1 tane varsa çocuk onu 2 saat arayacak mı, sıkılmaz mı?"). Haklı bir
// endişe: sipariş bir ŞART olsaydı ve o harf tahtada seyrek olsaydı, oyun iğne
// aramaya dönerdi. Bu yüzden:
//   · Her eşleşme her zaman sayılır ve oyunu ilerletir. Sipariş yalnız EK ödül.
//   · Sipariş aktifken o harfin doğma olasılığı ARTAR (`agirlik`) — tahta
//     çocuğa istediği şeyi aktif olarak besler. Match-3 türünün kendi çözümü:
//     "hedef rengin doğma ağırlığını yükselt, imkânsız durumu denetle."
//   · Sipariş `SABIR` hamlede tutulmazsa KENDİLİĞİNDEN başka harfe döner.
//     Çıkmaz sokak yok.
//   · Hedef KÜÇÜK (`ADET` = 2-3). "20 tane topla" 6 yaşındaki için av,
//     "2 tane" ritim.
import type { ContentItem } from "@/data/types";

/** Bir siparişte kaç tane isteniyor. Küçük tutulur — av değil ritim. */
export const SIPARIS_ADET = 2;
/** Bu kadar hamlede tutmazsa sipariş başka harfe döner (çıkmaz sokak yok). */
export const SIPARIS_SABIR = 12;
/** Sipariş edilen harfin doğma ağırlığı (ötekiler 1). */
export const SIPARIS_AGIRLIK = 2.5;

export interface Siparis {
  hedef: ContentItem;
  kalan: number;
  /** Sipariş verildiğinden beri geçen hamle. */
  hamle: number;
}

export function siparisAc(adaylar: ContentItem[], oncekiId?: string): Siparis | null {
  const havuz = adaylar.filter((x) => x.id !== oncekiId);
  const liste = havuz.length > 0 ? havuz : adaylar;
  if (liste.length === 0) return null;
  return { hedef: liste[Math.floor(Math.random() * liste.length)], kalan: SIPARIS_ADET, hamle: 0 };
}

/**
 * Ağırlıklı seçim: sipariş edilen harf daha sık doğar.
 *
 * ⚠️ AĞIRLIK 2.5, "hep o gelsin" DEĞİL. Tahtayı tek harfle doldurmak oyunu
 * bozar (üçlüler kendiliğinden oluşur, düşünmek kalmaz). Amaç aramayı
 * kolaylaştırmak, aramayı ortadan kaldırmak değil.
 */
export function agirlikliSec(adaylar: ContentItem[], siparis: Siparis | null): ContentItem {
  if (adaylar.length === 0) throw new Error("agirlikliSec: boş aday listesi");
  if (!siparis) return adaylar[Math.floor(Math.random() * adaylar.length)];
  const toplam = adaylar.reduce((a, x) => a + (x.id === siparis.hedef.id ? SIPARIS_AGIRLIK : 1), 0);
  let r = Math.random() * toplam;
  for (const x of adaylar) {
    r -= x.id === siparis.hedef.id ? SIPARIS_AGIRLIK : 1;
    if (r <= 0) return x;
  }
  return adaylar[adaylar.length - 1];
}

export interface SiparisSonuc {
  siparis: Siparis | null;
  /** Bu eşleşme siparişi karşıladı mı (bonus + kutlama). */
  isabet: boolean;
  /** Sipariş TAMAMLANDI mı. */
  tamam: boolean;
}

/** Bir eşleşme olduğunda çağrılır. */
export function siparisIsle(
  siparis: Siparis | null,
  eslesenId: string,
  adaylar: ContentItem[],
): SiparisSonuc {
  if (!siparis) return { siparis: null, isabet: false, tamam: false };
  const isabet = eslesenId === siparis.hedef.id;
  const kalan = isabet ? siparis.kalan - 1 : siparis.kalan;
  const hamle = siparis.hamle + 1;

  if (isabet && kalan <= 0) {
    return { siparis: siparisAc(adaylar, siparis.hedef.id), isabet: true, tamam: true };
  }
  // ⚠️ SABIR: tutmazsa kendiliğinden döner. Çocuk asla tek bir harfi
  // kovalamakta sıkışıp kalmaz.
  if (hamle >= SIPARIS_SABIR) {
    return { siparis: siparisAc(adaylar, siparis.hedef.id), isabet, tamam: false };
  }
  return { siparis: { ...siparis, kalan, hamle }, isabet, tamam: false };
}
