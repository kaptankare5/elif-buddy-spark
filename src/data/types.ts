// Elifbâ – Ortak içerik tipleri ve veri katmanı

export type Lang = "tr" | "en" | "ar";

// Eski Age tipi bazı komponentlerde hâlâ kullanılıyor (AgePicker). Elifbâda
// yaş filtresi kullanılmıyor ama tipi kırmıyoruz.
export type Age = 2 | 3 | 4 | 5 | 6 | 7;
export const ALL_AGES: Age[] = [2, 3, 4, 5, 6, 7];

export interface ContentItem {
  id: string;
  label: string;
  subLabel?: string;
  speech: string;          // TTS için okunuş (Türkçe)
  lang: Lang;
  emoji?: string;          // Arapça harf/kelime buraya konur (oyunlar bu alanı gösterir)
  translit?: string;       // Kart arka yüzü için Türkçe transliterasyon
  audio?: string;          // /audio/elifba/... URL'i varsa doğrudan çalınır
  image?: string;
  value?: number;
  colorKey?: string;
  audioGain?: number;
  // Konu sayfasında ayrı başlık altında gösterilecek grup (örn. "Ekstralar")
  section?: string;
  /**
   * ÖLÇÜLEN BECERİ — bu soru neyin seviyesini değiştirir?
   *
   * Varsayılan: öğenin kendisi (`skill` boşsa `id` kullanılır). Ama bazı
   * konularda soru bir şey GÖSTERİR, başka bir şeyi ÖLÇER:
   *
   *  • "3. Harekeler": 84 hece sorulur ama ölçülen 3 şeydir — üstün, esre,
   *    ötre (`hrk-fetha` / `hrk-esre` / `hrk-otre`). Çocuk harekeyi
   *    anladıysa 28 harfin hepsini görmesine gerek yok; konu biter.
   *  • "4. Harf + Hareke": "şe" sorulur (şın ortada + fetha), ölçülen
   *    ŞIN'IN ORTADAKİ HÂLİ'dir (`l2-13-med`). Hareke zaten bilindiği
   *    varsayılır, hata harfin şekline yazılır.
   *
   * Bu sayede 2. konuda (Yazılışlar) alıştırma yapmadan geçilen şekiller,
   * burada harekeyle birlikte gerçekten ölçülür.
   *
   * ⚠️ Cevaptan SONRAKİ her şey (SRS seviyesi, karışıklık ısısı, telafi)
   * bu anahtar üzerinden çalışır — bkz. `src/lib/skills.ts`.
   */
  skill?: string;
  /**
   * ÇELDİRİCİ KISITI — şıklar bu anahtarı PAYLAŞMAK zorunda.
   *
   * Soru neyi ölçüyorsa, şıklar yalnız o eksende farklılaşmalı; başka bir
   * eksende de farklılaşırlarsa çocuk ölçtüğümüz şeye hiç bakmadan eleyebilir:
   *
   *  • "3. Harekeler" — ölçülen HAREKE. Şıklar AYNI HARF olmalı
   *    (بَ بِ بُ). Farklı harfler koyulsaydı çocuk harften tanır, harekeye
   *    hiç bakmazdı. Anahtar = harf numarası.
   *  • "4. Harf + Hareke" — ölçülen harfin ŞEKLİ. Şıklar AYNI HAREKELİ
   *    olmalı (hepsi fethalı). Harekeler karışsaydı çocuk sesteki ünlüden
   *    eler, şekle bakmazdı. Anahtar = hareke sesi.
   *
   * Boşsa kısıt yok — bütün havuz aday (eski davranış).
   */
  distractorKey?: string;
  /**
   * ALIŞTIRMA HAVUZUNA GİRSİN Mİ? (varsayılan: evet)
   *
   * `false` = öğe konu sayfasında GÖRÜNÜR ve dinlenebilir ama test/flashcard/
   * oyunlarda hiç SORULMAZ, konu tamamlanma sayımına da girmez.
   *
   * Şedde/Med/Tenvin konularında 28 harfin hepsini tek tek sormak gereksiz:
   * kural üçtür (fetha/esre/ötre), harfler 1. konuda zaten öğrenildi. Bu
   * konularda ÖĞRETME AMAÇLI küçük bir örneklem (4 harf) sorulur, gerisi
   * yalnız görülür; asıl alıştırma "Ekstralar"daki gerçek Kur'an
   * ibareleridir. (Cezm İSTİSNA — orada eb/ib/üb yeni bir alfabe gibidir,
   * bütün harfler sorulur. Kullanıcı kararı.)
   */
  practice?: boolean;
  /**
   * ÖN KOŞUL BECERİSİ — bu soru başka bir beceriyi BİLDİĞİNİ varsayar.
   *
   * "4. Harf + Hareke"de "şe" sorusu şın'ın ortadaki hâlini ölçer AMA bu
   * ancak çocuk fethayı gerçekten biliyorsa geçerli bir çıkarımdır. Fetha
   * henüz sağlam değilse hatayı harfin şekline yazmak YANLIŞ teşhis olur —
   * çocuk aslında harekeyi bilmiyordur.
   *
   * Bu yüzden yanlış cevapta ön koşul kontrol edilir: ön koşul L4 ise hata
   * `skill`'e (şekle) yazılır, değilse ÖN KOŞULA yazılır. Eşik L4'tür
   * (kullanıcı kararı: "emin ol o konuyu bildiğine").
   */
  prereqSkill?: string;
  // Kur'an sıklığı ağırlığı (SRS bilet çarpanı): 3 = çok sık (varsayılan —
  // çekirdek müfredatın tamamı yüksek ve eşit), 2 = sık, 1 = normal.
  // Yalnız Ekstralar öğelerinde 1-2 kullanılır; seviye seçimini değiştirmez,
  // aynı seviyedeki adaylar arasında bilet sayısını belirler.
  weight?: number;
}

export interface ContentTopic {
  id: string;
  parent: SubjectId;
  title: string;
  description: string;
  emoji: string;
  items: ContentItem[];
  practiceMode?: "visual" | "audio" | "math";
  ages?: Age[];
  interactiveGame?: "neck" | "size" | "position" | "opposite" | "emotion";
  // Alıştırma yoksa (sadece konu içeriği) — kilit için de item sayılmaz
  noPractice?: boolean;
  // Konu sayfasında grid kaç kolon olsun (varsayılan 4)
  gridCols?: 2 | 3 | 4;
  /**
   * Testte kaç şık gösterilsin? (varsayılan 4)
   *
   * "3. Harekeler"de 3'tür: soru بِ ise şıklar بَ بِ بُ — aynı harfin üç
   * harekesi. Dördüncü şık için başka bir harf koymak gerekirdi, o da
   * soruyu harekeyi ölçmekten çıkarırdı (çocuk harften eler).
   */
  optionCount?: number;
  // Konu videosu (YouTube izleme linki) — konu sayfasında gömülü oynatılır
  video?: string;
  /**
   * Konunun içeriği AYRI BİR SAYFADAYSA o sayfanın yolu.
   *
   * ⚠️ Konu sayfası (`Topic.tsx`) öğe ızgarası çizer; anlatım konularının
   * (Yazılış Hafıza Yöntemi) içeriği ise animasyonlu bir derstir, öğe
   * listesi değil. Bu alan verilince konu açıldığında doğrudan o sayfaya
   * gidilir — içerik iki yerde KOPYALANMAZ, tek kaynak sayfanın kendisi.
   */
  page?: string;
}

export type SubjectId = "elifba";

export interface Subject {
  id: SubjectId;
  title: string;
  emoji: string;
  description: string;
  bgVar: string;
  topics: ContentTopic[];
}
