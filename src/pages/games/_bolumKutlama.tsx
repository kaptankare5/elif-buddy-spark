// BÖLÜM KUTLAMASI — Macera / Parti / Yarışı için ortak katman.
//
// ⚠️ NEDEN ORTAK: üç oyunun da bölüm bitişi vardı ama hepsinde çalan ses
// `playFeedback(true)` idi — yani BİR SORUYU doğru bilmekle BİR BÖLÜMÜ
// bitirmek kulakta AYNI şeydi. Kullanıcı istedi: "bir bölümü bitirirse
// alkış sesi falan olsun". Kutlamayı üç yerde ayrı ayrı kurmak, üçünde
// farklı süre/ses/kapatma davranışı demekti (juice katmanında tam olarak bu
// hata yaşanmıştı: 15 oyunun 12'sinde ses yoktu).
//
// ⚠️ ALKIŞ DEĞİL ÇAN + KIVILCIM — gerekçesi `juice.ts`'teki "kutlama"
// notunda: hazır ses dosyası yok, sentetik alkış telefonda parazite
// benziyor, üstelik alkış bir KALABALIK sesi ve uygulamanın "kendi rekorun,
// kıyas yok" ilkesiyle çelişiyor.
//
// ⚠️ KİLİT AÇILDIYSA AYRI HABER: aynı kutlamanın alt satırında yazılır ve
// 650 ms sonra MEKANİK bir kilit sesi çalar. İki ayrı kutlama açmak 4+
// saniye sürerdi — kullanıcı şartı "geçmek zorda olmasın".
import { useCallback, useState } from "react";
import { UnlockCelebration } from "@/components/UnlockCelebration";

export interface BolumKutlamaBilgi {
  /** Bitirilen bölüm numarası. */
  bolum: number;
  /** Bu bölümü bitirmek YENİ bir bölüm açtı mı (zaten açıksa haber verme). */
  yeniAcilan?: number | null;
  /** Son bölüm bitirildiyse başlık değişir. */
  sonBolum?: boolean;
  /** Oyunun bölümlere verdiği ad ("3. Pist" gibi); varsayılan "Bölüm". */
  ad?: string;
}

export function useBolumKutlama() {
  const [bilgi, setBilgi] = useState<BolumKutlamaBilgi | null>(null);
  const kutla = useCallback((b: BolumKutlamaBilgi) => setBilgi(b), []);

  const katman = bilgi ? (
    <UnlockCelebration
      title={bilgi.sonBolum ? "🏆 Hepsini bitirdin!" : `🎉 ${bilgi.bolum}. ${bilgi.ad ?? "Bölüm"} tamam!`}
      subtitle={
        bilgi.yeniAcilan
          ? `🔓 ${bilgi.yeniAcilan}. ${bilgi.ad ?? "Bölüm"} açıldı`
          : bilgi.sonBolum
            ? "Son bölümü de geçtin, aferin!"
            : undefined
      }
      kilitSesi={!!bilgi.yeniAcilan}
      onDone={() => setBilgi(null)}
    />
  ) : null;

  return { kutla, katman };
}
