# Elifbâ (elif-buddy-spark)

Çocuklara Kur'an harflerini öğreten React uygulaması. Vite + React 18 + TS +
Tailwind + shadcn + Supabase (Lovable ile oluşturuldu). Dev: `npm run dev`
(port 8080, `.claude/launch.json` var).

**DOĞRULAMA — dikkat:** `npx tsc --noEmit` HİÇBİR ŞEYİ denetlemez! Kök
`tsconfig.json` `"files": []` + yalnız project reference içeriyor, o yüzden
sessizce boş geçer. Doğrusu: **`npx tsc -p tsconfig.app.json --noEmit`**
(+ `npx eslint src/` + `npx vitest run`). Şu anki taban:
**tsc 0 hata · vitest 416 geçti / 2 atlandı · eslint 38 sorun (15 hata,
23 uyarı)** — bu sayıların ÜSTÜNE çıkan her şey senin getirdiğin yeni
hatadır. (Eskiden `src/lib/mcp/` yüzünden 4 tsc hatası vardı, artık yok.)

## Mimari — kritik kurallar

### Ses (EN ÖNEMLİSİ — geçmişte bozuldu)
- Harf/hece sesleri GERÇEK hoca kayıtları: `public/audio/elifba/*.mp3`
  (basic/hareke/cezm/sedde/med/tenvin — 600+ dosya, item.audio alanında).
- ⚠️ **Oyun havuzu YALNIZ sesi olan öğeleri alır** (`gamePool`, `_shared.ts`):
  oyunların sorusu SESLE sorulur, kaydı olmayan öğe `playItem`'da tarayıcı
  TTS'ine düşer ve çoğu cihazda hiç ses çıkmaz → çocuk kapıyı sessizce görür
  ("soru sormadı, sadece cevaplar vardı"). Test kilidi 1234 bütün konuları
  açınca kayıtsız öğeler havuza giriyordu. Kayıtsız öğeler konu sayfasında
  ve Flashcard'da durur (orada soru görseldir). Bekçi: `audioFiles.test.ts`.
  ✅ **ARTIK KAYDI OLMAYAN KART YOK — 667/667 öğe sesli** (bekçi:
  `audioFiles.test.ts`). Çekirdek: basic 28, hareke 84, med 84, tenvin 84,
  sedde 81, cezm 81. Ekstralar (`tools/ses/ekstra.py`, 66 dosya): cezm 14,
  şedde 14, med 14, tenvin 8, `zamir-*` 8, `eliflam-*` 8.
  8. konu (`asar-med-kasr`) bir dönem BOŞTU (0 öğe); "asar med kasr" kaydı
  gelince 8 kartla dolduruldu (`asar-01..08`).
- ⚠️ **EKSTRA KAYITLARINDA PARÇA SAYISI TEK BAŞINA KANIT DEĞİL**: şeddede
  -28 dB/d=0.8 de 14 parça veriyordu ama YANLIŞ 14 — şeddeli kelimeyi
  ortadan bölüp SON kelimeyi tamamen kaçırıyordu (kayıt 31.6 sn, kesim
  28.7'de bitiyor). Hiza **kayma denetimiyle** doğrulanır: ekstranın bir
  hecesi zaten çekirdekte var, ofset 0 ile ±1 arasında uçurum olmalı
  (cezm 6.6 ↔ 36-39, şedde 7.7 ↔ 31-34, med 14.4 ↔ 32-37; rastgele 40).
  Çekirdek karşılığı olmayan Zamir/Elif-Lâm'da HECE↔SÜRE korelasyonu
  kullanıldı (0.953 ve 0.890). Ekstra çekimi çekirdekten 7-19 dB KISIKTI;
  her aile kendi çekirdeğinin seviyesine getirildi, pay 0.10 sn.
- ⚠️ **ÂSAR KONUSUNDA SÜRE MED TÜRÜNÜ ELE VERİR** — kartlar oradan
  doğrulandı: bedel 1.2 · tabiî 1.4 · muttasıl 3.1-3.5 · **lâzım 5.3** ·
  lâzım+şedde 4.1 sn. Kesimde 9 parça çıkıyordu; şeddeli `حَآجُّوكَ`
  duraklamadan ikiye bölünüyordu (8. ile 9. arası 0.4 sn, ötekiler 1.2-2.3).
  d=0.8 ile 8'e iniyor. Kullanıcı kaydı dinleyip kelimeleri yazdı, ölçüm
  sırayı doğruladı — kelimeler UYDURULMADI.
- ⚠️ **BÜTÜN ÇEKİRDEK KAYITLAR YENİ ÇEKİM** (kullanıcı kararı, 439 dosya):
  hocanın tek parça kayıtlarından (`kaptankare5/sound` → "Dünya 1. ses kuran")
  `tools/ses/` betikleriyle kesildi. Önce hareke/med/tenvin/cezm/şedde (411),
  sonra basic'in 28 harf adı da eklendi ("kaç aydır kullanılan eski sesleri
  sil"). ⚠️ Harf ADLARI için kesim eşiği **-40 dB** (ötekilerde -25):
  yumuşak başlangıçlı adlarda (-25 dB'de) sözün ilk hecesi kesiliyordu.
  Ayrıca **+3.8 dB kazanç** uygulandı — ham kesim -26.8 dBFS ile bütün
  ailelerin altında kalıyordu. Eşleme tahminle değil
  MFCC parmak iziyle doğrulandı (kayma denetimi: ofset 0 → ortalama sıra
  10.7, ±1 → 30-31). Kazanç: eski şedde kayıtları **11 dB kısıktı**
  (−31.9 dBFS), yeni set −20.9 ve bütün aileler 4.6 dB içinde — oyunlarda
  arka arkaya çalarken ses seviyesi artık zıplamıyor.
- **Daima `playItem(item)` kullan** (item.audio'yu çalar). `playSpeech(text)`
  metni `public/audio/manifest.json`'da arar; bulamazsa ROBOTİK tarayıcı
  TTS'ine düşer. Harf sesi için playSpeech KULLANMA. "Tebrikler!" gibi TTS
  kutlamaları kaldırıldı — `playFeedback(true/false)` (ding/buzz) kullan.

### Veri: `src/data/topics/elifba.ts`
- İki ayrı bölümleme var: `bolum()` = geleneksel 4'erli ("1. Bölüm" =
  elif be te se) — 1., 3. ve sonraki BÜTÜN konular bunu kullanır.
  `bolumYazilis()` = YALNIZ 2. konu (başta/ortada/sonda): karışabilen
  harfler aynı bölümde ama bölümler EN FAZLA 3 harf — orada bir harf ÜÇ yeni
  şekil demek, 4 harflik bölüm 12 yeni şekle çıkıyordu (13 bölüm: ا ك ل ·
  ب ت ث · ج ح خ · د ذ · ر ز · س ش · ص ض · ط ظ · ع غ · ف ق · م ه · ن ي · و).
  Bölüm ADLARI iki tarafta da sade ("N. Bölüm") — aile etiketi YOK
  (kullanıcı şartı). Harf sırası (LETTERS) hiç değişmedi.
- ⚠️ **İMLÂ TÜRKİYE (DİYANET) MUSHAFINA GÖRE — Medine imlâsı DEĞİL.**
  Kullanıcı şartı; kaynak `kuran.diyanet.gov.tr`. Dört kural:
  1. **KELİME BAŞINDA hemze ÇİZİLMEZ**: `أَ إِ أُ` değil düz elif + hareke
     `اَ اِ اُ` (`اَنْعَمْتَ` · `اُو۫تُوا` · `الْاَبْتَرُ` · `فَاِنَّ اللّٰهَ`).
     Cezm/şedde ön ekleri bu yüzden düzeltilmişti.
  2. ⚠️ **AMA KELİME İÇİNDE/SONUNDA hemze ÇİZİLİR**: `اِقْرَأْ` · `فَأْتِنَا`
     · `الْمَلَأُ` · `شَانِئَكَ` · `الْمُؤْمِنُونَ`. Kuralı "hemze hiç yok"
     diye genelleştirmek YANLIŞ — bir kez `الْمَلَأُ` → `الْمَلَاُ` yapılıp
     geri alındı. Kürsülü hemzeye (`ؤ ئ ء`) hiç dokunma.
  3. **MED İŞARETİ AYRI HARF DEĞİL**: `آ` (U+0622) kullanılmaz. Uzatma,
     önceki harfin HAREKESİNDEN SONRA gelen `ٓ` (U+0653) ile gösterilir,
     elif düz kalır: `حَٓاجُّوكَ` · `اٰبَٓاؤُ۬نَا` · `الضَّٓالّ۪ينَ`.
     Kullanıcı tespiti buydu: "uzatma var ama fethası yok" — eski `حَآ`
     yazımında fetha ile uzatma tek glife binip fetha kayboluyordu.
     Kelime başı "â" (medd-i bedel) ise elif + hançer elif: `اٰمَنَ`, `اٰ`.
  4. **MED YÂSI: NOKTALI ي + KÜÇÜK ESRE** → `بٖي` (`بِى` de `بِي` de değil).
     Noktasız `ى` yalnız kelime SONUNDA ve "â" okunurken (`وَتَعَالٰى`).
     Uzun **â** ve **û** mushafta zaten NORMAL harekeyle yazılır
     (`مَالِكِ` · `اَعُوذُ` · `يُولَدْ`), yalnız uzun **î** küçük esre alır
     (`الرَّحٖيمِ` · `اَلَّذٖي` · `الْعَالَمٖينَ`). İKİ İSTİSNA:
     · Yâ kendi harekesini taşıyorsa ÜNSÜZDÜR, normal esre doğru: `اِيَّاكَ`.
     · ⚠️ **UZATMA DÜŞÜYORSA normal esre yazılır**: med harfi sâkinle
       karşılaşınca okunmaz. Felak 4 `فِي الْعُقَدِ` (fil-ukad) NORMAL esreli,
       Nâs 6 `فٖي صُدُورِ` küçük esreli — aynı kelime, iki ayrı yazım.
       Bekçi bu yüzden yâdan sonra BOŞLUK varsa karışmaz.
  5. **LAFZATULLAH HEP HANÇER ELİFLİ**: `اللّٰهُ` · `اللّٰهُمَّ` — düz
     `اللَّهُمَّ` yazımı Türk mushafında yok (Âl-i İmrân 26 ile doğrulandı).
  6. **ZAMİR HÂ'SININ İKİ HÂLİ AYRI**: ötreli zamir SADE yazılır (`لَهُ` —
     İhlâs 4, Aʿrâf 70 `وَحْدَهُ`), esreli zamir uzun okunduğu için küçük
     esre alır (`بِه۪` · `رَبِّه۪` · `وَكُتُبِه۪`). Düz `بِهِ` "bihi" diye
     KISA okutur.
  ⚠️ **ÖĞRETME TABLOLARI DA MUSHAF YAZIMIYLA** (kullanıcı şartı: "onlar dahil
  her şey Diyanet/Hayrat Kur'an'ına göre"). Hareke/cezm/şedde/tenvin zaten
  uyuyordu; med tablosunda yalnız uzun î değişti (`بِي` → `ب۪ي`, 28 kart +
  Ekstralar `ف۪ي ذ۪ي ه۪ي`). ⚠️ Bu değişiklik `HARAKA_SUF` tablosuna `۪` da
  eklemeyi ZORUNLU kılar: `medAudio` heceyi harekeden tanıyor, eklenmezse
  28 med kartı sessiz kalır ve ses şartı yüzünden oyun havuzundan düşer.
  7. ⚠️ **ELMAS ÇİZEN İŞARETLERİ KULLANMA** — `۪` (U+06EA) · `۫` (U+06EB) ·
     `۬` (U+06EC). Diyanet sayfalarından kopyalanan metin bunları taşıyor ve
     adları küçük esreye/halkaya benziyor, AMA fontta (Amiri Quran ve
     Scheherazade New'de ölçüldü) **içi boş bir ELMAS ◊** çiziyorlar.
     Kullanıcı ekranda `الضَّٓالّ۪ينَ`in altında ◊ görüp bildirdi. Doğrusu:
     uzun î → `ٖ` (U+0656 alt elif, küçük çizgi) · yazılıp okunmayan harf →
     `۟` (U+06DF küçük yuvarlak sıfır, mushaftaki halka: `اُو۟لٰٓئِكَ`).
  8. **KART TEK BAŞINAYSA `ال` HAREKELİDİR**: mushafta `قَالَ الْمَلَأُ`
     (cümle içi, vasl elifi işaretsiz) ama kart bir başlangıç olduğu için
     `اَلْمَلَأُ` · `اَلضَّٓالّٖينَ` yazılır — `اَلْحَمْدُ`, `اَلشَّمْسُ` ile aynı
     kural. (Şemsî lâm ve lafzatullahın sâkin lâmı mushafta da işaretsizdir,
     onlara dokunma.)
  ⚠️ **FONT YIĞINI KUR'ANİ İŞARETLERE GÖRE SIRALANIR** (`src/index.css`):
  ölçüldü — "Amiri" (Kur'an sürümü DEĞİL) küçük esre/sessiz-harf işaretlerini
  taşımıyor, o fonta düşen kelimede işaret yerine kutu çıkıyor. Üstelik
  `font-arabic-naskh` listesindeki "Scheherazade New" hiçbir yerden
  YÜKLENMİYORDU (index.html'deki Google Fonts bağlantısında yoktu) — telefonda
  kurulu olmadığı için sıra doğrudan Amiri'ye düşüyordu. Şimdi yükleniyor ve
  Amiri her iki listede de EN SONA alındı.
  ⚠️ **KODLAMA DA MUSHAFLA AYNI OLMALI (NFC)**: Unicode kanonik sırası
  hareke → şedde; Diyanet metni öyle kodlanmış (`ض + fetha + şedde`). Şedde
  kartları ters sırada üretiliyordu (81 kart). Ekranda fark YOK — iki kodlama
  piksel piksel aynı çiziliyor (ölçüldü) — ama dizgiler eşit olmadığı için
  karşılaştırma/arama/tekrar-eleme sessizce tutmuyordu.
  Bekçi: `src/test/imla.test.ts` — ekrandaki BÜTÜN Arapça metni (konu
  rozetleri, kartlar, ezber parçaları; 300+ dizgi) sekiz kurala + NFC'ye karşı
  tarar ve kural motorunun kendisini de test eder.
- 28 harf `LETTERS` tablosunda: `cons` (ünsüz) + `thick` (ince/kalin/ra) →
  hareke okunuşları üretilir. Adlar: Vev (Vav değil), Lem (Lam değil), Ye.
  ⚠️ **HARF ADI, HOCANIN SÖYLEDİĞİ AD OLMAK ZORUNDA** — `docs/harf-adlari.md`.
  ط "Tı" ve ظ "Zı" yazıyordu; kullanıcı kulakla yakaladı, `tools/ses/adlar.py`
  ÖLÇTÜ: harf ADI kaydının (`basic-NN.mp3`) ünlü çekirdeği AYNI harfin
  harekeli kayıtlarıyla kıyaslanınca ط→"a" (0.084 ↔ 0.213), ظ→"a"
  (0.031 ↔ 0.167). Artık **Ta** ve **Za**. Yazı ile ses ayrı şey söylerse
  soru ölçmek istediğini ölçmez (çocuk sesi duyup yazılı şıktan seçiyor).
  Literatürde İKİ gelenek var: elifbâ cüzü "tı/zı", Arap alfabesi + DİA
  "HARF" maddesi klasik adlarla "ṭâ'/ẓâ'" — hepsi "a" ile biter; kullanıcının
  "kalınlar sonu a ile bitecek" kuralı ikincisine denk düşüyor.
  ⚠️ **خ İSTİSNA: "Hı" KALIYOR.** Kayıt orada da "ha" diyor ama ح zaten "Ha";
  iki harfe aynı adı yazmak yazılı şıkta sorunun İKİ doğru cevabı olması
  demek. Bekçi: `harfAdlari.test.ts` (tablo kilitli + ad tekrarı yasak).
  ⚠️ Ad `byName` ile ANAHTAR olarak kullanılıyor (hareke alıştırma kelimeleri,
  `writingMnemonics.ts`) — adı değiştirirken oraları da güncelle, yoksa
  kelime kartları sessizce üretilmez.
  ⚠️ **ÜÇ KOVA VAR, İKİ DEĞİL** (`harekeVowels`):
  · `kalin` خ ص ض ط ظ غ ق → **a / ı / u**
  · `ra` **ر ح ع** → **a / i / u** (üstün-ötrede kalın, esrede ince)
  · `ince` gerisi → **e / i / ü**
  ⚠️ **ح ve ع sonradan `ra` kovasına alındı**: tecvidde müsta'liye değiller
  ama Türkçe okuyuşta boğaz harfi oldukları için "e"ye inceltilmez —
  `حَمْد` "hamd" · `الرَّحٖيم` "rahîm" · `عَلَيْهِمْ` "aleyhim" · `عِنْدَ` "inde".
  Önce `ince` idiler, kartlar "he/hi/hü" ve "e/i/ü" diyordu; med tablosunu da
  bozuyordu (`عَا` "ê" çıkıyordu, doğrusu "â").
  ⚠️ **ق'ın `cons`'u "k", "g" DEĞİL**: Diyanet çeviri yazısı `قُلْ` "kul",
  `قَالَ` "kâle" der. "g" iken hem yanlıştı hem de غ ile çakışıyordu
  (ikisi de "ga" veriyordu — yazılı şıkta iki doğru cevap demek).
  ⚠️ **SÂKİN AYN APOSTROFLU**: `اَعْ` = "a'" (düz "a" değil), `اَعَّ` = "a'a".
  Ayn'ın Türkçe karşılığı olmadığı için cezimli hâli düz sesliye dönüyordu ve
  yazılı şıkta elifle ayırt edilemiyordu. Apostrof ikilenmez ("a''a" değil).
- **11 numaralı konu + 1 NUMARASIZ ders konusu** (`yazilis-hafiza`, kullanıcı
  isteği: "hafıza yöntemi... onu ayrı konu olarak al"). Video'lu olanlar
  `topic.video`. ⚠️ **DERS KONUSUNUN İÇERİĞİ AYRI SAYFADA** (`topic.page`):
  Topic.tsx öğe ızgarası çizer, oysa hafıza yöntemi animasyonlu bir derstir
  (`/yazilis-hafiza`); konu açılınca `<Navigate replace>` ile oraya gidilir,
  içerik KOPYALANMAZ. ⚠️ **NUMARASIZ BIRAKILDI**: araya numaralı konu sokmak
  sonraki dokuz başlığı ve testlerde/CLAUDE.md'de onlara yapılan bütün
  atıfları kaydırırdı. Bekçi: `skills.test.ts` → "konu sırası ve numaraları
  tutarlı" (numarasız olabilmenin şartı: `noPractice` + `page`).
- ⚠️ **ALIŞTIRMASIZ KONU "GİRİLİNCE" BİTER** (kullanıcı şartı: "en azından bir
  kere konuya girsin"). `isTopicCompleted` eskiden `noPractice` konularda
  koşulsuz `true` dönüyordu: çocuk Yazılışlar'ı hiç AÇMADAN sonraki konuya
  geçiyordu, müfredatın o adımı fiilen atlanıyordu. Ölçüt tek bir ziyaret
  (`markTopicVisited`, placement.ts — öğrenciye özel anahtarda).
- ⚠️ **İLERLEME EKRANINDA KONU ANLATIMI SATIRI SADEDİR** (kullanıcı şartı:
  "alt tarafını sil, bir sürü şey varsa sadece tamamlandı de"): alıştırmasız
  konuda ölçülen hiçbir şey yok — beş seviye rozeti hep 0 gösteriyordu ve
  açılınca 84 kart dökülüyordu. Artık tek durum rozeti (✓ Tamamlandı /
  Girilmedi) + tek satır.

### ⚠️ BECERİ KATMANI (`src/lib/skills.ts`) — yeni müfredatın çekirdeği
"Soru neyi GÖSTERİR" ile "soru neyi ÖLÇER" ayrıdır. `ContentItem.skill`
boşsa beceri = öğe id'si (eski davranış). Cevaptan sonraki HER ŞEY (SRS
seviyesi, karışıklık ısısı, telafi) beceriyle çalışır; soru üretimi
tersine: seçici BECERİ seçer, `pickItemForSkill` o beceriyi taşıyan
öğelerden birini soru yapar. İkisini karıştırmak sessiz hata üretir.
- **3. Harekeler**: 84 hece sorulur, ölçülen **3** şey (`hrk-fetha/esre/otre`).
  Konu 168 değil **6** cevapta biter. `optionCount: 3` — şıklar aynı harfin
  üç harekesi (بَ بِ بُ); 4. şık başka harf olurdu, çocuk harekeye bakmadan
  elerdi. `distractorKey` = harf numarası.
- **4. Harf + Hareke Alıştırması** (`harf-hareke`): "şe" sorulur, ölçülen
  şın'ın ORTADAKİ hâli (`skill: l2-13-med`). 2. konuda (Yazılışlar,
  `noPractice`) alıştırmasız geçilen şekiller asıl burada ölçülür.
  `distractorKey` = hareke sesi → şıklar hep aynı harekeli.
- `distractorKey` kısıtı **sessizce düşmez**: aday azsa ŞIK AZ olur. Eskiden
  düşüyordu ve soru ölçmek istediğini ölçmüyordu (testi var).
- `prereqSkill` + `blameTarget`: 4. konudaki yanlış, hareke **L4**
  (`PREREQ_LEVEL`) değilse ŞEKLE değil HAREKEYE yazılır — yanlış teşhis
  koymamak için. L3 yetmez ("biliyor ama tereddütlü").
- `practice: false` = öğe sayfada görünür ama HİÇ SORULMAZ, tamamlanma
  sayımına girmez. Şedde/Med/Tenvin'de yalnız `OGRETME_ORNEKLEMI`
  (Be, Râ, Sin, Mim) sorulur; asıl alıştırma Ekstralar'dır.
  **CEZM İSTİSNA** — orada eb/ib/üb yeni alfabe gibi, 28 harfin hepsi.
- Ekstralar bilet ağırlığı `ekstraAgirlik(f) = 3 + f*2` → L4'te bile
  çekirdekten sık gelir. ⚠️ Çarpan tek başına YETMEZ: en seyrek Ekstra
  (f=1) ×2 = 2 ile çekirdeğin altında kalıyordu, taban şart.
- ⚠️ **KONU KARTLARINDA VE ŞIKLARDA `EmojiView` KULLAN, düz `<span>` DEĞİL.**
  Kullanıcı tespiti: "esre (alt çizgi) ze harfinde gözükmüyordu". `leading`
  satır KUTUSUNU büyütür ama MÜREKKEBİ ortalamaz; ز ر س ش ص gibi taban
  çizgisinin altına inen harflerde esre daha da aşağı düşüyor ve kartın
  altındaki opak etiket bandı (`relative z-10`) üstünü boyuyordu. `EmojiView`
  mürekkebi ölçüp `translateY` ile ortalar (`glifOlcu.ts`) — aynı hata
  oyunlarda da yaşanmıştı, bu kez konu ızgarası ve test şıkları atlanmıştı.
- ⚠️ **FLASHCARD'DA SADE ÇALIŞMA** (`settings.flashcardSade`, varsayılan
  KAPALI): motivasyon ögeleri (seviye rozeti + yıldızlar, oturum sayacı,
  kart üstü seviye) ve SRS'in sürpriz sırası (kurtarma, karışan partner,
  serpiştirilmiş bakım, denetim kartı) kapanır; deste BAŞTAN SONA sırayla
  dönülür. ⚠️ Cevap YİNE SRS'e yazılır — kaldırılan şey motivasyon, kayıt
  değil. Bekçi: `sadeFlashcard.test.ts`.
- Topic testi ses şartı uygular (oyun havuzu gibi): kaydı olmayan öğe soru
  olmaz. (Şedde/Tenvin/Cezm Ekstraları bir dönem bu yüzden hiç sorulmuyordu;
  kayıtları gelince süzgeç onları kendiliğinden geri aldı.) Flashcard
  süzülmez (soru görsel).
- Maliyet: Elifbâ'yı bitirmek **1334 → 498** doğru cevap.
- ⚠️ `git update-index --cacheinfo` YENİ dosya yolu için `--add` ister;
  onsuz sessizce atlar ve main derlenmez hâlde kalır (bir kez oldu).
- `item.section` = "N. Bölüm" (yukarı bak) veya "Ekstralar"
  (Diyanet PDF alıştırmalarından). CRLF satır sonları — çok satırlı Edit
  eşleşmesi başarısız olursa nedeni bu (tek satır anchor veya node kullan).

### Öğrenme sistemi (bilimsel gerekçeli — koru)
- ⚠️ **MERDİVEN 5 BASAMAKLI ve İKİ HIZLIDIR** (`Level = 1..5`, srs.ts):
  L1→L2→L3 tek doğruyla; **L4 "ÖĞRENDİ"** üst üste 2 doğru + akıcılık (AYNI
  OTURUMDA kazanılabilir); **L5 "USTALAŞTI"** kanıt puanı + `MIN_DAYS` ayrı
  gün. L5 sonradan eklendi: katı kanıt kuralı L3→L4'e konunca çocuk günlerce
  ⭐⭐⭐'te PARK ediyordu — görünen ilerleme durunca uygulama "bir şey olmuyor"
  hissi veriyor (kullanıcı tespiti). Üstelik L3 kurada en aç kovaydı
  (`waterfallWeights`), orada biriken öğe seyrek sorulup soru bütçesi yeni
  harflere kayıyordu (ölçüm: tanıtılan harf 94 → 158 — çocuk bilmediği
  harflere doğru koşuyordu). Ağırlık tablosu bu yüzden monoton inecek şekilde
  yeniden yazıldı; hiçbir seviye açlıktan ölmemeli.
  Eşikler: kilit/bölüm açma **L3+** (değişmedi), `PREREQ_LEVEL` **L4**,
  Veli panelindeki "Ustalaşan" **L5**, Koleksiyon altın kartı ve Bahçe çiçeği
  **L4** (ödül temposu korunsun diye).
- ⚠️ **HIZLI GEÇİŞ**: harfle İLK KEZ karşılaşıp doğru bilirse doğrudan **L3**
  (öğrenmek değil "zaten biliyormuş" sayılır), ikinci doğruda L4. L5 hızlı
  geçişle VERİLMEZ —
  kanıt kuru + ayrı gün şartı (aşağı bak) her yolda geçerlidir; Flashcard'ın
  `meta.selfReport`'u yalnız "üretim kanıtı" demektir, kestirme değil. Hızlı
  geçişte SÜRE şartı YOK — ölçtük, koyunca bilen ama temkinli çocuğun geçme
  oranı %99'dan %87'ye düşüyor.
- ⚠️ **ŞIK SAYISI KANITI SULANDIRIR** (`sansPayi`/`gerekenUstUste`, srs.ts):
  4 şıkta şans %25, 2 şıkta **%50** — aynı "doğru" iki modda aynı şeyi
  kanıtlamaz. Yeni modlar (Ses Şıkları 3 şık, Şimşek 2 şık) ve Kolay zorluk
  şık sayısını düşürdüğü için ölçüm bozuluyordu. Çözüm SEVİYE CEZASI DEĞİL
  (kullanıcı "3 seviye mi düşsün" diye sordu — yanlış cevabın −2 kuralı
  DEĞİŞMEDİ), **kanıtın ağırlığı**: `sansPayi(n) = log2(n)/2` → 2 şık ½,
  3 şık 0.79, 4+ şık tam. L3→L4 için gereken üst üste doğru da şık sayısına
  bağlı: `gerekenUstUste(n) = ceil(4 / log2(n))` → 4 şıkta 2, 3 şıkta 3,
  2 şıkta 4. (Düz "hepsinde 3" demek yetmiyordu: 2 şık × 3 doğru = 1/8,
  4 şık × 2 doğrudan İKİ KAT kolay.) **Hızlı geçiş yalnız 4+ şıkta**
  (`HIZLI_GECIS_MIN_SIK`) — 2 şıkta yazı-tura ile L3 verilemez; az şıkta
  merdiven tek basamak çıkar.
- ⚠️ Şık sayısı `AnswerMeta.optionCount`; oyunlar vermezse
  `gameProgress.recordGameAnswer` `shownIds.length`'ten türetir ama **en az
  2 öğe şart** — tek elemanlı `shownIds` "1 şık" sanılıp ölçümü bozuyordu.
- ⚠️ Bunun bekçisi `gameProgress.showHintFor`: oyunda ipucu halkası yalnız L1
  VE harf DAHA ÖNCE GÖRÜLMÜŞSE yanar. İlk karşılaşmada parlarsa çocuk harfi
  tanımadan basar ve bilmediği harf L3 olur.
- **Serbest Oyun** (normal mod) havuzu YALNIZ görülmüş harflerdir ve en az
  `FREE_PLAY_MIN_SEEN` (8) harf görülmeden açılmaz — orada ipucu hep açık
  olduğu için ilk karşılaşma yaşanmamalı.
- ⚠️ `pickNextGameItem` (gameProgress.ts) **son 4 sorulanı havuzdan eler**.
  Seçici SRS durumuna bakar; normal modda cevap SRS'e yazılmadığı için durum
  hiç değişmiyor ve her çağrı aynı harfi döndürüyordu ("sürekli aynı soruyu
  soruyor"). Tampon seçimi moddan bağımsız ilerletir.
- ⚠️ **KANIT KURU** (`MASTERY`, srs.ts + `AnswerMeta.evidence`): bütün doğru
  cevaplar eşit değil ama hiçbiri DEĞERSİZ değil. **L5** bir puan eşiğidir:
  `NEEDED 3`; `"production"` (Flashcard: harfi gör → adını söyle) **1 puan**,
  `"recognition"` (varsayılan — oyun/test, şıktan seçme) **½ puan**. Ayrıca
  `MIN_DAYS 5` TABANI var: puan yetse bile 5 ayrı gün şart — üretim yolu 3
  günde eşiği geçiyor ama 3 hatırlama yarı ömrü ancak ~10 güne çıkarıyor,
  sonra takvim aralığı 21-60 güne fırlayınca harf unutuluyordu (ölçüm: yalnız
  Flashcard oynayan çocukta rozetin **%33'ü yalandı**, taban konunca **%0**).
  Rawson & Dunlosky da "3 doğru + 3 kez ARALIKLI yeniden öğrenme" diyor; puan
  eşiği tek başına onların yalnız ilk yarısıydı. Yani
  Flashcard 5 ayrı günde, oyun/test 6 ayrı günde L5 verir; karışık oynanırsa
  puanlar TOPLANIR. Yanlış cevap biriken puanı yarıya indirir (`WRONG_DECAY`).
  Kur'un gerekçesi: (1) 4 şıkta şansla %25 tutturulur ve çocuk bilmediği harfi
  ELEYEREK de bulur; (2) YÖN TERS — Elifbâ kitabı "harfi gör, söyle" der, test
  "sesi duy, harfi seç" der; bu iki yön ayrı öğrenilir. Gerçek gözlem: çocuk
  1 saatte bütün harfleri L4 yaptı, kitaptan sorulunca 2 harfi bilemedi.
  ⚠️ Önce **sert tavan** konmuştu (oyun ASLA ustalık veremez); kullanıcı itiraz
  etti — "ters yönde de olsa sürekli maruz kalırsa öğrenir, 2-3 kat zaman
  ister ama öğrenir" — literatür de doğruluyor (alımlama ve üretim pratiği
  ikisi de her yöne aktarılıyor, üretim daha az tekrarla). Tavan yerine KUR:
  oyun daha uzun yoldan aynı yere varır. Ölçüm (40 gün × 30 soru × 6 çocuk):
  ⭐ yalan oranı Karışık %16.3 → **%5.0** (MIN_DAYS tabanıyla daha da aşağı).
  ⚠️ **GÜNÜN EN İYİ KANITI SAYILIR, İLK KANITI DEĞİL** (`dayEvidence`):
  puan günde bir kez birikiyor, dolayısıyla hangi cevabın sayılacağını SIRA
  belirliyordu — sabah Şimşek'te (2 şık, ¼ puan) doğru yapan çocuk öğleden
  sonra Flashcard'da harfi ÜRETSE bile gün ¼ ile kapanıyordu. Artık fark
  ekleniyor; zayıf cevap güçlüyü DÜŞÜRMEZ. (Kullanıcı sorusu "L4→L5'te de
  şık sayısı var mı" — var: `sansPayi` tanıma puanını ölçekliyor, yalnız
  2 şıkla oynayan çocuk eşiğe 6 değil 12 ayrı günde varır. Bekçi:
  `gunlukKanit.test.ts`.)
  ⚠️ `MASTERY.EPS` kayan nokta içindir: `6 × ½ = 1.9999…` eşiği tam sınırda
  bloke ediyordu.
- ⚠️ **ARALIKLI TEKRAR TAKVİMİ** (`SPACING`, srs.ts): **AYNI GÜN SAYILMAZ.**
  Basamak yalnız FARKLI BİR GÜNDE verilen doğru cevapla ilerler; aynı
  oturumda üst üste doğru yapmak L4 vermez (güne yayılan tekrar tek seferde
  tekrarın 3 katı kalıcılık veriyor — 5. sınıf ölçümü). Flashcard'ın tek
  dokunuşta ustalığı bu yüzden kaldırıldı; ilk doğru L3, ikincisi L4,
  L5 kanıt kuruyla (yukarı bak) en erken 5. AYRI günde.
  Basamaklar `1 → 3 → 7 → 21 → 60 → 150 → 365` gün (Cepeda 2008: 1 hafta
  için sürenin %20-40'ı, 1 yıl için %5-10'u). Son basamağı geçen öğe
  **MEZUN** olur (`GRADUATED_STEP`), bir daha programa girmez — Bahrick:
  yılı devirmiş bilgi 30 yıl sabit kalıyor ("permastore").
- ⚠️ **VADE SIRASI**: hatırlama olasılığı `DESIRED_RETENTION` (0.90) altına
  düşen öğe KURAYA GİRMEZ, doğrudan öne alınır (`isDue`, `DUE_SHARE` 0.7).
  Eskiden vade yalnız bir bilet çarpanıydı (en fazla ×3) ve 170 öğelik
  havuzda unutulmuş öğe kurayı kaybediyordu → "L3+ ama unutmuş" sayısı
  şişiyordu. Kalan %30 yeni öğe tanıtımına bırakılır, yoksa biriken bakım
  borcu öğrenmeyi durdurur. Karışıklık çarpanı vade sırasında DA uygulanır
  (yoksa karıştırılan harf sık gelmeyi bırakıyor — testi var).
- `DESIRED_RETENTION` (0.90) ile Wilson'ın **%85 başarı oranı** AYRI
  şeylerdir: biri tekrarların SEYREKLİĞİNİ, öteki soruların ZORLUĞUNU
  ayarlar. Çocukta hedefi düşürmüyoruz; iş yükü kazancı `INTERVAL_SCALE`
  ile aralık uzatmaktan gelir (Bahrick: 13 tekrar × 56 gün = 26 tekrar ×
  14 gün). İngilizce'de kelime sayısı büyüyünce tek sayıyla yük yarıya
  iner. Ölçüm: sahte ustalık karışık senaryoda 55 → 19.
- SRS `src/data/srs.ts`: L1-5. Yanlış = **-2 seviye** (kullanıcı şartı,
  değişmez). L3→L4 = üst üste 2 doğru (`consecutiveCorrect`), L4→L5 = kanıt
  kuru. Seçici: görülmemişler müfredat sırasıyla, art arda aynı öğe yok,
  ağırlıklar L1 %46 → L5 %8 (%85 başarı kuralı, monoton iniş).
- ⚠️ **ALIŞTIRMASIZ KONUDA BÖLÜM KİLİDİ YOK** (kullanıcı tespiti: "orada
  zaten alıştırma yok, ne işe yarayacak"). Kapının şartı "bu bölümdeki her
  öğeyi L3'e çıkar"; `noPractice` konuda hiçbir öğe SORULMADIĞI için seviye
  asla yükselmiyor ve 1. bölümden sonrası ASLA açılmıyordu. ÖLÇÜLDÜ (gerçek
  oyuncu kurulumu, test kilidi KAPALI): Yazılışlar'da çocuk 84 şeklin yalnız
  **9**'unu görebiliyordu; kalan 12 bölüm "Alıştırma yaparak öğrenince
  açılır" yazan kilitli kutulardı — o konuda alıştırma olmadığı için
  uyulması İMKÂNSIZ bir yönerge. Üstelik konu "bir kez girilince"
  tamamlandığından çocuk 75 şekli hiç görmeden geçiyordu. Bölüm rozeti
  (☆ 0/9) da gizlendi: ölçtüğü şey orada yok. ⚠️ Muafiyet YALNIZ
  `noPractice`e; alıştırmalı konuda kilit aynen duruyor (bekçisi var).
  ⚠️ Bu hata test kilidi (1234) AÇIKKEN GÖRÜNMEZ — o bayrak bütün bölümleri
  açıyor. Bölüm kilidi ölçülürken bayrak KAPALI olmalı.
- Bölüm kilidi `src/lib/unlock.ts`: konu içi section'lar sıralı açılır.
  Açılma şartı İKİ tane: (1) bölümdeki tüm öğeler L3+, (2) bölüm içinde
  sıcak karışıklık kalmamış (`hotPairInSection`, eşik 0.6). Eskiler açık
  kalır. `isTopicCompleted` de aynı iki şarta bakar.
  Test/Flashcard/oyun havuzu (`gamePool`) YALNIZ açık öğeleri sorar
  (`getUnlockedItemsOf` / `getUnlockedItemIdSet`).
- Konu kilidi: konudaki tüm öğeler L3+ → sonraki konu.
- ⚠️ **TEST PANELİNDE İKİ AYRI ANAHTAR VAR** (`src/lib/testUnlock.ts`,
  Ayarlar → Test Paneli): kod **1234** yalnız PANELİ açar, hiçbir şeyi
  açmaz. İçinde bağımsız iki anahtar: **🔓 tüm konuları aç** (unlock.ts +
  Macera/Parti/Yarış bölüm sayıları) ve **🐞 debug göstergeleri**
  (`LevelBadge`, `DebugHud`, Macera blok seviyesi). Eskiden tek düğmeydi;
  kullanıcı şartı: "tüm konuları açınca normal oyuncu gibi test edemiyorum"
  — HUD'ı açmak isteyen veli kilitleri de açmış oluyordu. Getter'lar PANELE
  de bakar (paneli kapatmak ikisini birden etkisiz kılar) ve eski tek
  anahtarlı cihazlar için göç var. Bekçi: `testPaneli.test.ts`.
- Soru kaynağı `src/lib/questionSource.ts` (Topic testi): retry / bakım /
  frontier önceliği. Yanlış harf en fazla **BİR kez** tekrar sorulur (eskiden
  sınırsızdı → çocuk aynı harfte kilitlenip bakım kanalına hiç sıra
  gelmiyordu). **Zorlanma bandında bakım, retry'nin önüne geçer** — kolay
  soru konu içinde yok, önceki konunun bilinen harflerindedir. Flashcard'da
  da aynı kurtarma karşıtlık zincirinin önünde. Bakım sorusunun ÇELDİRİCİLERİ
  de yalnız açık bölümlerden gelir.

### Karışan harfler (`confusables.ts` + `confusion.ts`)
- `confusables.ts` = STATİK bilgi (import etmez, yapraktır): rasm öbekleri
  (ب/ت/ث/ن/ي…, ا/ل, ك/ل, م/ه) **ve** aynı harfin başta/ortada/sonda hâlleri
  (`l2-NN-init|med|fin`) da karışan sayılır.
- `confusion.ts` = ÖLÇÜLEN karışıklık ısısı (0..1, localStorage, öğrenciye
  özel, yarı ömür 21 gün). Yanlış şık seçimi +0.34; şık bilinmiyorsa
  a-priori partnerlere +0.12; partner ortadayken **üst üste 3 doğru** ayrım
  → −0.5. Harf ısısı BÜTÜN hâllere/harekelere taşınır (Elif↔Lem ısınınca
  `l2-01-fin` de ısınır), form ısısı yalnız o harfin hâlleri arasında kalır.
- **AYNI SESLİ öğe asla çeldirici olamaz** (`sameSound`): sorular sesle
  sorulur, Fe'nin yalın/başta/ortada/sonda hâllerinin dördü de
  `basic-20.mp3` çalar → ikisi şıkka girerse sorunun İKİ doğru cevabı olur.
  `pickDistractors` ve `pickCluster` bunu eler (küme üyeleri birbirine de
  benzemez). Sonuç: sesle sorulan çoktan seçmeliyle form ayrımı SORULAMAZ.
- Isının üç etkisi: **sıklık** (srs.ts biletinde `1 + 1.6·ısı`),
  **birliktelik** (`pickDistractors` → oyunlarda `pickWrongs`/`pickCluster`),
  **ardışıklık** (`pickContrastId` → Flashcard'da partner hemen sonra gelir,
  zincir en fazla 3).
- Katman sırası tek yönlü: `confusables → confusion → srs/sayfalar/oyunlar`.
  `pickDistractors` **confusion.ts'ten** gelir (confusables'ta değil).
- Ölçüm noktaları: Topic testi (`choose`), `gameProgress.recordGameAnswer`
  (`chosenId`/`shownIds` meta'sı — moddan bağımsız her cevapta işler),
  Flashcard (ardışık kart partnerse doğru cevap = ayrım).
- Debug HUD'da "Karışıklık Isısı" bölümü çifti okunur gösterir (Elif↔Lem).

### Telafi (`src/lib/remedial.ts` + `RemedyOverlay`)
- **Nokta grupları İKİŞERLİ** (`DOT_GROUPS`, writingMnemonics.ts): tek bir
  "Diş Kardeşler" listesi (be te se nun ye) çocuğa somut ayrım vermiyordu
  (kullanıcı: "yeterince açıklayıcı değil"). Artık AYNI NOKTA SAYISINDAKİ
  ikili karşı karşıya: **Nun–Be** (1 nokta, üstte/altta), **Ye–Te**
  (2 nokta, altta/üstte), **Şın–Peltek Se** (3 nokta, ikisi de üstte →
  ayrım DİŞ sayısında; bu yüzden `sharedNote` alanı var, alt şerit
  "iskeleti aynı" demez).
- ⚠️ **ÇİZGİ YÖNTEMİ — Elif ile Lem** (`STROKE_PAIRS`, `StrokeCompare`):
  ikisinin de NOKTASI YOK, ikisi de düz dikey çizgi → nokta yöntemi işe
  yaramaz. Ayırt edici kural: **Elif'ten sonra çizgi BİTER (sola bağlanmaz),
  Lem'den sonra DEVAM EDER.** Kart yalnız BAŞTA ve ORTADA hâllerini
  karşılaştırır — Lem'in SONDA (ﻞ) ve YALIN (ل) hâlinde derin çanak var,
  orada karışmaz (kullanıcı kararı). Üç yerde görünür: Yazılış Hafıza
  sayfası (nokta bölümünün altında), konu girişindeki önizleme (4. karo),
  telafi ekranı (`kind: "cizgi"`).
- ⚠️ **FORM KISITI** (`FORM_RESTRICTED`, confusables.ts): Elif↔Lem yalnız
  Lem'in `init`/`med` hâlinde karışan sayılır. `baseConfusable` bunu uygular
  → çeldirici seçimi ve MISS_SOFT yayılımı da otomatik uyar. `remedial.ts`
  "cizgi" dersini `baseConfusable` üzerinden kapıya bağlar — yalnız harf
  numarasına bakmak YETMEZ, yoksa Lem'in çanaklı hâlinde de çizgi dersi
  açılıyordu (testi var).
- ⚠️ Şın İKİ grupta: `sin` (aynı iskelet) ve `nokta-3` (aynı nokta sayısı).
  Bu yüzden `Remedy.partner` var — telafi ekranı çocuğun GERÇEKTEN
  karıştırdığı harfle aynı gruptakini seçer, yoksa `find` ilk grubu verip
  alakasız karşılaştırma gösteriyordu.
- Yalnız `l2-*` (başta/ortada/sonda) hatalarında; harfin hafıza yöntemi
  tam ekran açılır. Yöntem HATANIN EKSENİNE göre: farklı harf karıştırdıysa
  nokta (`DotCompare`, hata yapılan hâlle açılır), aynı harfin başka hâliyle
  karıştırdıysa kuyruk (`EraseGame`) ya da "hiç değişmez".
- **Her yanlışta çıkmaz**: ısı ≥ 0.5 (tek hata yetmez) + aynı harf 30 dk,
  herhangi bir telafi 4 dk soğuma + seansta en fazla 3.
- Test/Flashcard'da hemen; OYUNLARDA ASLA ortada — `queueRemedy` ile
  kuyruğa alınır, `useRemedyOnGameOver` (ölünce/süre bitince) ya da
  Game.tsx unmount'ta (bitişi olmayan oyunlar) açılır.

### Sayfa kaydırma kilidi (`src/hooks/useLockBodyScroll.ts`)
- ⚠️ **SAYAÇLI OLMAK ZORUNDA.** Kanca ÜÇ yerden çağrılıyor ve iç içe geçiyor:
  `Game.tsx` (rota sarmalayıcısı) + `PartyGame` + `KartGame`. Her çağrı kendi
  "önceki değer"ini saklayınca (deneyle bulundu, `kaydirmaKilidi.test.tsx`):
  içteki prev="" saklayıp kilidi kurar, dıştaki prev="hidden" saklar; içteki
  tek başına kapanınca kilit OYUN SÜRERKEN çözülür, dıştaki kapanınca
  "hidden" geri yazılıp **kilit TAKILI KALIR**. Kullanıcı bildirdi:
  "oyundan geriye bastım, oyunlar ekranı yukarı aşağı gitmiyordu; sayfayı
  yenileyince düzeldi". İlk giren kurar, SON çıkan geri yükler.

### Oyun modları (`src/lib/gameMode.ts`)
- Varsayılan **süper** ("super"); kullanıcı Ayarlar'dan normale döner.
- Süper: her oyun cevabı SRS'e sayılır; ipucu halkası yalnız L1'de.
- Normal: SADECE eğlence — oyun cevabı SRS'e HİÇ yazılmaz
  (`recordGameAnswer` erken döner). Eskiden her 3 cevaptan 1'i sayılıp
  "📝 Test sorusu sayıldı" bildirimi çıkıyordu; **kullanıcı şartıyla
  kaldırıldı** (çocuk hangi cevabın sayıldığını bilemediği için ilerleme
  rastlantısal görünüyor, oyun "düzgün test etmiyor" hissi veriyordu).
  Karışıklık ölçümü moddan bağımsız çalışmaya devam eder — o seviye değil,
  neyin neyle karıştırıldığı bilgisidir. Hafıza'da her 3 eşleşmede
  `InGameQuiz` (gerçek çoktan seçmeli, `recordInGameTest` her zaman sayar)
  çıkar; Balon/Koşu'da doğru cevapta ışık + ipucu halkası hep görünür.
- Topic Test + Flashcard recordSrsAnswer'ı doğrudan çağırır → hep sayılır;
  testte yanlış cevaplanan soru bir kez tekrar sorulur (questionSource.ts).

### Hoca Modu (`src/lib/students.ts`)
- Cihazda öğrenci profilleri; `setActiveStudentScope` (srs.ts) localStorage
  anahtarını `elifba-srs-{ns}-student-{id}-v1` yapar → seviye/kilit/ilerleme
  öğrenciye özel, geçişte kaldığı yerden. Öğrenci aktifken buluta YAZILMAZ.
- UI: `StudentSwitcher` (PageHeader + Index sağ üst), yönetim Ayarlar →
  Hoca Modu. Öğrenci yoksa düğme görünmez.

### Soru sorma yöntemi (`src/lib/askMode.ts` + `games/_askUI.tsx`)
Ayarlar → "Oyunda soru yöntemi". Varsayılan **klasik**; ESKİ MOD SİLİNMEDİ.
Mod oyuna GİRERKEN dondurulur (ortasında değişirse şıkların anlamı kayar).
- ⚠️ **OKUMA BİLMEYEN ÇOCUK İÇİN İKİ MOD** (kullanıcı tespiti: "çocuklar
  okuma bilmiyor, o yüzden harfi gösterip şıkları yazılı veremiyoruz"):
  **sesli** "Ses Şıkları" — glif asılı, şıklar 🔊; ilk dokunuş DİNLETİR,
  ikincisi seçer (`ask.onayla`, oyunun seçim işleyicisinin ilk satırı).
  Şık en fazla 3 (`SESLI_SIK`): 4 şık ~6 sn dinleme, çocuk ilkini unutuyor.
  **sekil** "Şekil Eşleme" — harfin BAŞKA hâli asılı (`ـبـ`), şıklar harfler.
  ⚠️ Bunu SES SORAMAZ: bir harfin dört hâli aynı mp3'ü çalıyor (`sameSound`
  onları eliyor), yani 2. konudaki 84 şekil oyunlarda hiç ölçülemiyordu.
  ⚠️ Şekil Eşlemede ÇELDİRİCİLER BAŞKA HARF olmalı — aynı harfin başka
  harekesi gelirse sorunun İKİ doğru cevabı olur (ölçüldü: Quiz'de hedef
  3. konudan gelince çeldiriciler hep aynı harfin harekeleriydi).
  Destek bayrakları: `sesliDestek` / `sekilDestek` — aksiyon oyunlarında şık
  engelin kendisi olduğu için ikisi de klasiğe düşer; Kutu Boşalt'ta tahtayı
  oyun kendi kurduğu için (12 kutu) yine klasik. Kart/Parti `getAskMode()`
  yerine `oyunAskModu()` kullanır: `mode !== "klasik"` diye bakan kod yolları
  yeni modları YAZILI sanıp panolara Latin ad basardı.
- `ask.tekrarVar`: glifin ASILI durduğu modlarda tekrar düğmesi ÖLÜDÜR (ses
  çalmak cevabı vermek olur). Oyunlar mod adına değil buna bakar.
- **klasik**: sesi duy → glif seç. (Mevcut/varsayılan.)
- **flash** "Şimşek": glif kısa süre parlar söner → şıklar YAZILI AD.
  ⚠️ **SÜRE AYARLANABİLİR** (`FLASH_PRESETS`, Ayarlar: 0.3/0.5/0.8/1.3 sn,
  varsayılan 0.5). Literatür iki AYRI darboğaz diyor: (1) KODLAMA darboğaz
  DEĞİL — yetişkinde tek glif ~50 ms, çocuk 2-3 kat yavaş → ~150 ms, yani
  0.3 sn fazlasıyla yeter; (2) DİKKAT/BAKIŞ asıl sınır — bakışı kaydırmak
  8 yaşında ~411 ms (yetişkin 270), üstelik 6 yaşındaki çocuk TEK ODAKLI
  dikkat kullanıyor, oynarken başka yeri izleyemiyor. Bu yüzden glif
  **oyun görüntüsünün ORTASINDA** belirir ve öncesinde `FLASH_CUE_MS`
  (320) boyunca küçük bir halka bakışı oraya çeker — kenarda beliren
  0.3 sn'lik bir glif çocuğun gözü varmadan sönüyordu.
  ⚠️ Glifin KENDİSİ saydam değil, ALTLIK saydam — harf tanıma parlaklık
  karşıtlığına bağlı (Legge); saydam harf = düşük karşıtlık. Konum üst
  bölge: üste bindirilmiş sabit sembol dikkati tünelliyor (HUD araştırması).
  Süre darboğaz DEĞİL (Sperling: 50 ms'de 9-12 harf); fazladan süre okumak
  için değil BAKIŞI ÇEVİRMEK için.
- **ustte** "Tabela": glif ekranda/kapıda ASILI → şıklar yazılı ad. Bu modda
  SES ÇALINMAZ (adı söylemek = cevabı vermek); "dinle" düğmesi gizlenir.

- **Yazılı şık çeldiricisi** `pickNameWrongs`: ad hedefe EN BENZEYENDEN
  seçilir ("Sin↔Şin", "Sad↔Dad") — yoksa çocuk kelimeyi OKUMADAN ilk harfe
  bakıp seçer. `adZorlugu(level)` KADEMELİ: L1-2 uzak ad (0.15), L3 orta,
  L4+ en yakın ad. Kullanıcının "bear/giraffe → bear/beal" fikri; ama
  UYDURMA AD YOK — sahte harf adı çocuğa yanlış ad öğretme riski taşır.
- ⚠️ **TABELADA DOĞRU CEVAPTA HARFİN SESİ ÇALAR** (`cevapSesi`): şıklar
  LATİN harfle yazılı; çocuk "Dad" yazısını seçip doğru yapsa bile harfin
  nasıl OKUNDUĞUNU duymuyorsa yarım öğreniyor (kullanıcı şartı).
- ⚠️ **ŞİMŞEK/TABELA PLAKASI**: ince SİYAH çerçeve (`border-foreground/75`,
  kullanıcı isteği — şıkların etrafındaki gibi), altlık saydam/glif opak,
  punto `min(...)` ile ekrana göre sınırlı. Sabit `text-[8rem]` Macera gibi
  dar oyun alanlarında soruyu devasa yapıp oyunu kapatıyordu; küçük alanlı
  oyunlar `useAskLayer({ flashBoy })` ile daha da küçültür (ölçüm: Macera'da
  örtme %50 → %31).
- ⚠️ **MACERA'DA TABELA CEVAPTAN SONRA KALKAR** (`setHedefGlif(null)`):
  sonraki soruya kadar asılı kalması hem ekranı meşgul ediyor hem çözülmüş
  soruyu gösteriyordu (kullanıcı şartı).
- ⚠️ **KUTU BOŞALT'TA HEDEF PANELİ HEP DURUR**: `target` null olduğu anlarda
  (tip tamamlandı → yeni hedef seçiliyor) panel yok olup altındaki kutu
  yukarı zıplıyordu. Panel sabit yükseklikte kalır, içeriği "Aferin!" olur.
- ⚠️ **GLİFİN MÜREKKEBİ ÖLÇÜLEREK ORTALANIR** (`src/lib/glifOlcu.ts`).
  `line-height` SATIR KUTUSUNU büyütür, MÜREKKEBİ ORTALAMAZ: ج ح خ çanağı
  taban çizgisinin çok altına iner, ا neredeyse tamamen üstünde kalır.
  Ölçüm (100px punto, 33 glif): 9 glif plakadan taşıyordu (ج ح خ 22.5px),
  merkeze ortalama sapma 42.7px, ج tam 73.5px aşağıdaydı. Canvas
  `actualBoundingBox` ile mürekkep kutusu ölçülüp `translateY(...em)`
  uygulanınca taşma 0, sapma 5px (o 5px KASITLI — kullanıcı "tam ortadan
  çok az üstte olsun" dedi, `YUKARI_PAY`). Kaydırma `em` cinsinden döner,
  punto değişse de çalışır; font yüklenince önbellek bir kez atılır (yedek
  fontla ölçüm yanlış çıkar).
- ⚠️ **MÜREKKEP ORTALAMASI ARTIK `EmojiView`'İN İÇİNDE.** `glifOlcu.ts` vardı
  ama ortak bileşen kullanmıyordu; her oyun tek tek uygulamak zorundaydı ve
  çoğu unutulmuştu. Kullanıcı iki kez aynı hatayı bildirdi ("uzay oyununda
  ayın, ha gibi harflerin alt kısımları beyaz yuvarlağın dışına çıkıyor").
  ⚠️ ÖLÇÜM `tools/perf/glifKutu.mjs` — gerçek Amiri Quran gömülü, EKRAN
  GÖRÜNTÜSÜNDEN piksel sayımı: 56px dairede 34px puntoda 37 glifin **19'u**
  diskin dışına taşıyordu (en derin 9.6 px). Ortalama → 7, punto 30 → **2**
  (yalnız ötre işareti 3 px değiyor). Uzay Savaşı puntosu 34 → 30.
  ⚠️ **ÖLÇÜT DAİRE, KUTU DEĞİL**: ilk ölçümüm mürekkebi kutunun sınırlarıyla
  kıyaslayıp "taşma yok" demişti — daire alta doğru daralıyor, geniş bir
  çanak kutunun içinde ama diskin DIŞINDA kalabiliyor. Sayı ile görüntü
  çelişince görüntü haklı; araç piksel saymaya çevrildi.
  ⚠️ **DAİRE İÇİNDEKİ GLİF 12px SALINAMAZ**: `animate-float` 56px dairede
  yarıçapın %21'i kadar oynuyor ve glifleri uçta dışarı çıkarıyordu.
  Kutu içindeki glifler `animate-float-az` (4px) kullanır.
  Bekçi: `glifOrtalama.test.ts`.
- ⚠️ **TABELA GLİFİ KIRPILMAMALI.** `leading-[1.35]` + dar `py` ile 33
  glifin 11'i kutunun dışına taşıyordu (ölçüldü): ج ح خ tabanın 12px altına,
  kesreli بِ 9px. Arapça glif taban çizgisinin altına (nokta/kesre) ve
  üstüne (hareke) taşar. Doğrusu `lineHeight: 1.7` + `py-2` → taşma 0.
- **Hangi oyunda ne çalışıyor**: Yarışı, Partisi, Hızlı Quiz, Balon, Uzay
  Savaşı, Uçan Kuş, Kutu Boşalt, Elifbâ Macerası, Yılan.
  Partisi'nde şimşek de 3 şık (şerit kapatmak parkurda engel gibi görünüyor).
  ⚠️ **Kutu Boşalt TERS kurulur**: üstte GLİF asılı, KUTULARDA yazılı ad
  (klasikte tam tersi). ⚠️ **Uçan Kuş'ta harf ÇARPIŞMA ALANI'dır**: yazılı
  kutu genişleyince çarpışma testi de yatayda esner (`HIT_X_ESNEK`), yoksa
  çocuk yazının tam ortasına nişan almak zorunda kalır.
  ⚠️ **Macera ve Koşusu'nda `🎯 Hangisi: {question}` şeridi harfin TÜRKÇE
  ADINI yazar** — yazılı modda bu cevabın ta kendisidir; Macera'da gizlendi.
  ⚠️ **DOĞRU CEVABIN SESİ BİTMEDEN YENİ SORU GELMEZ**: `cevapSesi` artık
  ses bitince çözülen bir söz döndürür, oyunlar onu `await` eder. Önce
  "çal ve unut"tu; oyun kendi zamanlayıcısıyla geçtiği için kayıt yarıda
  kalıyordu (kullanıcı: "ses devam ederken yeni soru gözüküyor").
  ⚠️ **ŞİMŞEK PLAKASININ YERİ OYUNA GÖRE** (`flashYer`): varsayılan `top-20%`
  Yılan'da doğrudan yılanın üstüne düşüyordu. Oyun alanı ekranın üst
  yarısındaysa plaka başlık hizasına çekilir (ölçüm: ızgarayı örtme %0).
  ⚠️ **UZAY SAVAŞI'NDA KUTU PİKSEL, ÇARPIŞMA YÜZDE** — ikisi ÖLÇÜLEREK
  bağlanır (`alanOlcu` + ResizeObserver). Kap 5:6 olduğu için yatay %1 ile
  dikey %1 aynı piksel değil; sabit katsayıyla dönüştürmek tutmuyordu.
  Ölçüm (412px ekran, kap 380×456): yazılı kutunun görsel yarı-eni %14.74,
  çarpışma yarı-eni %12.00 — iki yanda %2.74'lük şerit GÖRÜNÜYOR ama
  VURULMUYORDU. Yeni kutu/boyut eklerken px→% çevrimini ölçümden al.
  ⚠️ **Koşusu'nda tabela YOLUN ÜSTÜNDE, oyun alanının DIŞINDA** (kullanıcı
  şartı "yolu kapatmasın, görsün"); kapı panolarında yazılı ad, `boardTexture`
  yazılı/glif için AYRI önbelleklenir (aynı metin iki farklı fontla çizilir).
  ⚠️ **AYNI YAZILI AD İKİ ŞIKTA OLAMAZ — tahtayı KENDİ kuran her oyunda.**
  `pickNameWrongs` bunu içeride eliyor ama `pickWrongs`/`pickCluster`
  kullanan oyunlar `ask.ayriAdlar` ile ayrıca elemeli: Uçan Kuş, Kutu
  Boşalt, Koşusu, **Yılan** (yazılı moda sonradan açıldığında atlanmıştı).
  `celdiriciler`in YEDEK yolu da ad-tekil olmalı — aday yetmiyorsa
  ŞIK AZ OLSUN, bozuk soru sorma.
  ⚠️ **YILAN'DA PUNTO ÖLÇÜLEN HÜCREYE BAĞLI**: sabit `text-base` (16px) idi
  ama tahta ekrana göre esniyor — 14 sütunlu tahta telefonda ~376px, hücre
  ~27px, yani glif hücrenin ancak %60'ı kadardı ("harfler çok küçük").
  Punto YÜZDEYLE verilemez (`font-size: %` ana öğenin PUNTOSUNA göre çalışır),
  o yüzden hücre ResizeObserver ile ÖLÇÜLÜP piksel olarak bağlanıyor.
  Yem ve sınav şıkları hücreden **1.5× büyük** çizilir — çarpışma yine tek
  hücre; taşma güvenli çünkü şıklar birbirinden en az 4 kare uzağa yerleşiyor.
  ⚠️ **Yılan'da ad tek ızgara karesine sığmaz**: yazılı şık, anchor
  karesinden başlayan `AD_GENISLIK` (5) karelik bir ŞERİTtir; yılan şeridin
  herhangi bir karesinden yiyebilir ve anchor sağ kenara sıkışmaz.
  Koşusu'nda yazılı şık YOK (`useAskLayer({ yaziliDestek: false })` klasiğe
  düşürür) — kapı panoları R3F bileşeni, ayrı bir geçiş ister.
  Uygulanamaz → Hafıza/Eşleştirme/Üçlü/Yapboz (soru zaten görsel,
  "hedef + şık" yapısı yok).
- ⚠️ **AYNI YAZILI AD İKİ ŞIKTA OLAMAZ** (`sameName`, `sameSound`un yazılı
  karşılığı): havuzdaki 443 addan 113'ü çakışıyor — ثَ ile سَ ikisi de "se",
  ذِ ile زِ ikisi de "zi". İkisi birden ekrana gelirse sorunun İKİ doğru
  cevabı olur ve doğru okuyan çocuk yanlış sayılır. `pickNameWrongs` bunu
  zaten eliyor; tahtayı KENDİ kuran oyunlar (Uçan Kuş, Kutu Boşalt)
  `ask.ayriAdlar` ile ayrıca elemek zorunda.
- ⚠️ **KÖR CEVAP SAYILMAZ** (`korCevapMi`, askMode.ts): şimşekte glif
  belirmeden ya da `MIN_ALGI_MS` (150) geçmeden gelen dokunuş harfe
  BAKILMADAN verilmiştir; SRS'e yazılmaz. "Göremedim" ile "bilmiyorum"
  aynı şey değil — kör basışı yanlış saymak harfi −2 seviye düşürüp ölçümü
  bozuyordu. Kural muhafazakâr: glif hiç işaretlenmemişse (klasik/tabela,
  3B kapı oyunları) ASLA devreye girmez.
- **ŞİMŞEK EŞİĞİ KALİBRASYONU** (`components/FlashKalibre.tsx`, Ayarlar →
  şimşek bloğu): 3 süre × 4 soru, karışık sırayla; eşiği (%75) geçen EN KISA
  süreyi önerir. ⚠️ Sorular yalnız çocuğun ZATEN BİLDİĞİ harflerden (L3+)
  seçilir — bilinmeyen harfle ölçüm "kısa sürede bilemedi" der, oysa uzun
  sürede de bilemezdi. SRS'e HİÇBİR ŞEY YAZMAZ.
- **OKUMA ONAYI**: yazılı mod ilk kez seçilirken veliye bir kez sorulur.
  Çocuk Latin harfi okuyamıyorsa mod ölçüm bile yapamaz (her soru rastgele
  işaretlenir, SRS bunu "bilmiyor" sanar).

### Kalıcılık katmanı (`oyunSonucu.ts` · `siparis.ts` · `gorevler.ts` · `bolumYildiz.ts`)
Ölçüldü (`tools/perf/yogunluk.mjs`): 15 oyunun 12'si oturumlar arasında HİÇBİR
ŞEY kaydetmiyordu; öğrenme yoğunluğu 154 ↔ 1 soru/dk arasında değişiyordu.
- ⚠️ **REKOR KENDİ REKORUDUR** — başka çocukla sıralama YOK. 5-8 yaşta
  karşılaştırma yetkinlik hissini zedeliyor. `oyunBitti()` her oyun bitiminde
  tek satırla çağrılır, **günlük seriyi de besler**: seri yalnız SRS cevabıyla
  ilerliyordu, normal modda oyun oynayan çocuğun serisi hiç ilerlemiyordu.
- ⚠️ **SKORUN YÖNÜ SAKLANIR** (`yuksek`/`dusuk`): kimi oyunda AZ iyi (hamle,
  süre), ötekilerde ÇOK iyi (puan). Tek alan ikisini tutamaz — "en iyi 40
  hamle" çıkar.
- ⚠️ **BÜTÜN OYUNLAR KAYIT YAZAR — bekçisi `kalicilik.test.ts`.** Paket ilk
  yazıldığında üçü dışarıda kalmıştı: Kutu Boşalt'ta `useOyunSonu` İMPORT
  EDİLMİŞ ama hiç ÇAĞRILMAMIŞTI (ölü import; eslint bunu yakalamıyor), Üçlü
  Eşle ve Yapboz'da hiç yoktu. Zararı yalnız "rekor yok" değil: **günlük seri
  de beslenmiyor**. Test import değil ÇAĞRI arar.
- ⚠️ **SERİ İKİ YERDEN BESLENİR**: `oyunBitti()` ve `setYildiz()`. Macera ile
  Parti rekor yazmaz, yalnız yıldız yazar; seri yalnız `oyunBitti`ye bağlıyken
  bütün gün Macera oynayan çocuğun serisi HİÇ ilerlemiyordu (normal modda oyun
  cevabı SRS'e de yazılmaz). `setYildiz` seriyi ERKEN DÖNÜŞTEN ÖNCE besler —
  bölümü daha kötü bitirmek de "bugün oynadım"dır.
- ⚠️ **BİTİŞİ OLMAYAN OYUNDA KANCA İŞLEMEZ**: `useOyunSonu` bir `bitti`
  bayrağının kenarını bekler. Kutu Boşalt'ta (tahta boşalınca yenisi kurulur)
  kayıt ELDEN `oyunBitti()` ile yazılır.
- ⚠️ **REKORUN ÖLÇEĞİ DEĞİŞİRSE ESKİ KAYIT ATILIR** (`yon`+`birim` uyuşmazlığı,
  `oyunBitti`). Hafıza'nın rekoru "en az hamle"den "en çok tahta"ya geçti;
  eski kayıt aynı anahtarda kalsaydı 6 HAMLElik rekor yeni ölçekte "6 tahta"
  diye okunup çocuktan 7 tahta bitirmesini isteyecekti. Ölçek değişince kayıt
  ilk oyun gibi baştan başlar (oynama sayacı korunur).
- ⚠️ **HAFIZA'NIN REKORU HAMLE DEĞİL TAHTA SAYISIDIR**: `sonrakiTur` her turda
  tahtayı bir çift büyütüyor (4 → 10) ve daha çok çift zorunlu olarak daha çok
  hamle demek. Hamle rekoru olsaydı 1. turun rekoru (4 çift) ASLA kırılamazdı;
  çocuk 9 çiftlik tahtayı kusursuz bitirse bile "rekorun 6" yazacaktı — en iyi
  oynadığı turda başarısız hissedecekti. Tek tahtanın KALİTESİ ⭐ ile gösterilir,
  o rekorun işi değil.
- ⚠️ İlk oyunda "rekor kırdın" YAZILMAZ; kıyaslanacak şey yokken bunu demek
  sonraki gerçek rekoru değersizleştirir.
- ⚠️ **SİPARİŞ KAPI DEĞİL BONUS** (`siparis.ts`, Üçlü Eşleştir + Üçlü Eşle).
  O iki oyun eşleşmeyi `item.id` eşitliğiyle buluyordu: tek harf bilmeyen çocuk
  ikisini de kusursuz oynayabiliyordu (çikolata kaplı brokoli). Sipariş ŞART
  olsaydı iğne aramaya dönerdi (kullanıcı sorusu: "tek tane varsa 2 saat arar
  mı"). Bu yüzden: her eşleşme yine sayılır · sipariş edilen harfin doğma
  ağırlığı ×2.5 (match-3 türünün kendi çözümü) · `SIPARIS_SABIR` (8) EŞLEŞMEDE
  tutmazsa KENDİLİĞİNDEN başka harfe döner · hedef küçük (2 tane).
  ⚠️ Sabrın birimi **eşleşme**, hamle DEĞİL (`Siparis.eslesme`): `siparisIsle`
  yalnız eşleşmede çağrılıyor. 12'yken 25 hamlelik oyunda sipariş neredeyse
  hiç dönmüyordu — adı vardı, işlevi yoktu.
  Ağırlık daha yükseğe çekilmez: tahtayı tek harfle doldurmak üçlüleri
  kendiliğinden oluşturur, düşünmek kalmaz.
- ⚠️ **SAYAÇLAR HATAYLA SIFIRLANMAZ** (kullanıcı itirazı): Kutu Boşalt'ın
  sayacı "hatasız zincir" diye adlandırılmıştı. Burası ÖĞRENME uygulaması —
  yanlış cevap ölçüm verisidir (SRS seviyeyi, karışıklık ısısını ondan
  besliyor); hatayı görünür biçimde cezalandıran sayaç çocuğu emin olmadığında
  denemekten caydırır ve yıldız kuralıyla da çelişir ("kazanılanı kaybetme
  korkusu tekrar oynamayı engelliyor"). Sayaç artık boşaltılan kutu sayısı,
  yalnız İLERİ gider. (Not: `tahtaHatasizRef` hiçbir yerde `false`
  yapılmıyordu — etiket yanlıştı, davranış zaten kümülatifti.)
- ⚠️ **GÖREVLER KAÇIRMA CEZASIZ** (`gorevler.ts`, Koşusu): gün değişince
  yenilenir, "kaybettin" hissi verilmez. Mesafe görevi oyun BİTİNCE işlenir —
  `gorevIlerlet` localStorage'a yazıyor, saniyede 60 kez yazmak telefonu kilitler.
- ⚠️ **YILDIZ PERFORMANSA BAKAR** (`bolumYildiz.ts`, Macera/Parti/Yarışı):
  yoksa yine tek bit olur. Bölüm AÇILMASI dereceye bağlı DEĞİL (kullanıcı
  şartı: sonuncu da olsa devam edebilmeli). Yıldız geriye gitmez — kazanılanı
  kaybetme korkusu tekrar oynamayı engelliyor.
- ⚠️ **REKOR RENDER SIRASINDA OKUNMAZ**: `getOyunKaydi()` düz localStorage
  okuması yapar; Yarışı'nın pist listesi her render'da 3 pist × 2 kez okuyup
  JSON ayrıştırıyordu ve yeni rekor kartlara yansımıyordu. Bileşenlerde
  `useOyunKayitlari()` kancası kullan (olay dinler).
- ⚠️ **UZAY SAVAŞI'NDA HEDEF EKRANDA OLMAK ZORUNDA**: ekranda hedef yokken bile
  doğru harf yalnız %55 olasılıkla gönderiliyordu; çocuk "şın'ı vur" duyup şın'ı
  hiç göremeden bekliyordu (ölçüm: ilk soru 22.9 sn).

### Oyun hissi — juice (`src/lib/juice.ts` + `src/lib/titresim.ts`)
- ⚠️ **KULLANICI TESPİTİ: "koşu oyununda para toplarken ses çıkmıyor".**
  Ölçüldü: 15 oyunun 12'sinde HİÇ sfx yoktu, titreşim HİÇBİRİNDE yoktu.
  Şimdi hepsinde var (bekçi `juiceKapsam.test.ts`; gerçekten ÇALDIĞINI ölçen
  araç `tools/perf/juice.mjs` — WebAudio'nun `createOscillator`'ını sayıyor).
- `sfx(kind, { seri, titresim })`: topla · guc · zipla · carp · patlat ·
  kaydir · ates · seri · bitis. **Müzik YOK** (audio.ts'teki kuralla aynı),
  hepsi tek atımlık bildirim tonu.
- ⚠️ **SERİ ARTTIKÇA TİZLEŞİR** (Mario'nun para kuralı): aynı "çıt"ı 40 kez
  duymak tekdüze; yükselen perde "biriktiriyorum" hissi verir. 12 adımda
  tavan (yoksa duyulamaz frekansa çıkıyor). Koşusu'nda seri 1.2 sn
  dokunulmazsa sıfırlanır — ayrı toplanan paralar tek seri sayılmasın.
- ⚠️ **TİTREŞİM `sfx`'İN İÇİNDE, çağrı yerlerinde DEĞİL**: 15 oyunda tek tek
  `titre()` yazmak unutulmaya açıktı (ölçtük — 4 oyunda ses vardı, titreşim
  yoktu). `playSfx` de aynı sebeple kendi titriyor.
- ⚠️ **SIK YAPILAN HAREKET TİTREMEZ** (`zipla`/`kaydir`/`ates`): Uçan Kuş'ta
  26 saniyede 62 kanat çırpışı ölçüldü — her birinde titremek rahatsız edici
  ve pil yakıcı. Titreşim önemli anlara ayrılır. Süreler 8-34 ms.
- ⚠️ **HAFIZA'DA ISKA "hata" DEĞİL "hafif"**: orada ıska konumu unutmaktır,
  harfi bilmemek değil — sert geri bildirim yanlış ders verir (SRS kuralıyla
  aynı gerekçe).
- `titresim.ts` AYRI modül: hem `audio.ts` (playSfx) hem `juice.ts`
  kullanıyor, juice zaten audio'dan `tone` alıyor — aynı dosyaya koymak
  döngüsel import üretiyordu. Ayarlar'dan kapatılabilir.
- Sarsıntı/pop animasyonları `tailwind.config.ts`'te (`juice-shake`,
  `juice-pop`) — **transform ile**, `top/left` ile değil (yeniden yerleşim
  tetikleyip zaten kasan cihazda kareyi düşürüyor).

### Ses üretimi — gürültü ilkesi (`audio.ts`'teki `gurultu`)
- ⚠️ **HAZIR SES DOSYASI YOK, HEPSİ SENTEZ.** Uygulamanın bütün OYUN sesleri
  WebAudio ile üretiliyor (gerçek hoca kayıtları ayrı konu). Tek bir sfx
  mp3'ü hem paket boyutu hem lisans/atıf yükü demek; ayrıca bu ortamdan
  freesound/pixabay/opengameart/kenney'in hiçbirine erişilemiyor (egress
  kapalı) — indirmek mümkün değil.
- ⚠️ **SES AYARI HİÇBİR ŞEYİ KAPATMIYORDU** (Ayarlar → "Ses Efektleri").
  `getSettings().sound` bütün kod tabanında TEK yerde okunuyordu: Ayarlar
  sayfasının kendi `checked` değerinde. `tone`/`gurultu`/`motor`/`sfx`/
  `playFeedback` ona hiç bakmıyordu — anahtar süsten ibaretti, kapatan veli
  hiçbir fark duymuyordu. Artık kapı `sfxAcik()` ile `tone`, `gurultu`,
  `motor` ve sürekli katmanların içinde. ⚠️ **KAPI YALNIZ EFEKTLERE**:
  `playItem`/`playSpeech` (gerçek hoca kayıtları) ASLA kısılmaz — oyunların
  sorusu SESLE sorulur, onları susturmak oyunu oynanamaz yapar.
  Bekçi: `sesAyari.test.ts` (sahte AudioContext ile osilatör sayar).
- ⚠️ **TEK MELODİK KATMAN: `gameMusic.ts` — VARSAYILAN KAPALI.** Macera'da
  pentatonik bir ambiyans çalıyordu ve varsayılan AÇIKTI, yani "müzik yok"
  kuralının dışında kalmış tek yerdi. Kullanıcı kararı (dinî hassasiyet:
  "elifbâ harfiyle müzik iyi olmayabilir, kutsal olduğunu düşünenler var"):
  **kod ve düğme kalsın, varsayılan kapalı olsun**. Anahtarın üç hâli var,
  göç kendiliğinden doğru: yok → sessiz (yeni varsayılan) · "1" → sessiz
  (eskiden bilerek kapatanlar) · "0" → çalar (bu sürümden sonra bilerek
  açanlar). ⚠️ Sessizken `start()` erken döner — AudioContext bile açılmaz;
  eskiden grafik kurulup kazanç 0'a çekiliyordu, yani kimsenin duymadığı iş
  sürekli dönüyordu. Bu yüzden Macera'daki efektin bağımlılıklarına
  `musicMuted` EKLENDİ: oyun ortasında açan için `start()` yeniden
  çağrılmalı. Ayrıca Ayarlar'daki ses anahtarı kapalıysa müzik de çalmaz.
  Bekçi: `sesAyari.test.ts` → "oyun müziği (Macera)".
- ⚠️ **SÜREKLİ SES KATMANI** (`motorDongusu` / `gurultuDongusu`, `SurekliSes`):
  uygulamada HİÇ YOKTU — 15 oyunun sesi de "olay oldu → çıt" biçimindeydi.
  Oysa hız türlerinin ses kimliği DURUM sesidir: motor, lastik, zemin,
  rüzgâr. Kullanıcı bunu yarışta istedi ("arka planda sesi az motor sesi");
  aynı boşluk üç hız oyununda da vardı.
  · **Yarışı**: motor (perde hızdan, 66→250 Hz) + lastik cıyaklaması
    (bandpass, yalnız |drift| > 0.35) + çim uğultusu (pist dışında).
  · **Koşusu / Partisi**: rüzgâr; Koşusu'nda kenar hız çizgileriyle AYNI
    sayıdan beslenir — göz ve kulak aynı şeyi söyler.
  ⚠️ **MÜZİK DEĞİL**: melodi/ölçü/akort yok, aracın ve hızın kendi sesi.
  "Müzik yok" kuralı melodik/ritmik arka plan içindir.
  ⚠️ Parametreler `setTargetAtTime` ile sürülür (`setValueAtTime` her karede
  çağrılınca "fermuar" gürültüsü çıkıyor) ve güncelleme HER KAREDE DEĞİL
  HUD temposunda (7 Hz) yapılır — zaman sabiti 0.08 sn olduğu için kulak
  farkı duymuyor, 60 Hz'de her karede beş otomasyon olayı yazmak gereksiz.
  ⚠️ Gürültü tamponu döngü için **2 sn**'ye çıkarıldı: 0.5 sn'lik gürültü
  saniyede iki kez tekrarlanınca kulak onu ritmik bir doku olarak yakalıyor.
  ⚠️ Katmanlar oyundan çıkarken `dur()` ile bırakılmalı, yoksa ses sürer.
  Bekçi: `gameFeelKapsam.test.ts` → "sürekli ses katmanı (hız oyunları)".
- ⚠️ **`tone` YETMEZ, DOĞADAKİ SESLER PERİYODİK DEĞİL**: çamur, toz, su,
  rüzgâr gürültüdür. `gurultu({dur, bas, tepe, son, q})` beyaz gürültüyü
  kesme frekansı SÜPÜRÜLEN alçak geçiren süzgeçten geçirir; ıslaklık yüksek
  Q'dan (rezonans) gelir. Gürültü tamponu bir kez üretilip önbelleğe alınır —
  her seferinde 0.5 sn'lik rastgele dizi doldurmak telefonda kareyi düşürür.
- Parti'de çamur: her adımda `sfx("camur")` + AYAK ÇAMURA BULANIR + yerde
  ayak izi + sıçrayan damlalar. Hepsi tek sayıya bağlı: `yogunluk`
  (= kalan çamurlu adım / `IZ_ADIM`), çamurun içinde 1, çıkınca adım adım 0.
  ⚠️ **AYAKLARIN AYRI MALZEMESİ VAR** (`ayakMat`/`ayakDeriMat`): ayakkabı
  gövdeyle aynı malzemeyi paylaşıyordu, çamuru boyamak gövdeyi ve bereyi de
  karartırdı. Kopya malzeme sayesinde yalnız ayak kirlenir.
  ⚠️ **İZ KOYUDAN AÇIĞA GİDER** (kullanıcı şartı: "ilk adım koyu iken adım
  attıkça rengi açılsın"): izin başlangıç opaklığı ve boyu yoğunlukla
  ölçeklenir, damla sayısı da azalır (3 → 1).
  ⚠️ **ZAMAN SOLMASI GECİKMELİ** (ilk %65 tam koyulukta durur): doğrusal
  solmada ilk iz hem EN KOYU hem EN ESKİ olduğu için en çok soluyor ve
  bütün izler birbirine benziyordu — adım gradyanı ekranda kayboluyordu.
  ⚠️ İz, çamurdan ÇIKTIKTAN sonra da `IZ_ADIM` (5) adım devam eder — asıl
  bilgi orada; içindeyken zaten yavaşlıyor. Ses yalnız çamurun İÇİNDE çalar.
  ⚠️ İz/damla HAVUZDAN gelir (her adımda mesh yaratmak WebView'de çöp
  toplayıcıyı tetikler) ve yalnız OYUNCU iz bırakır — 5 bot da bıraksa ekran
  çamur içinde kalır. Zıplarken iz basılmaz. ⚠️ Çamur TİTREŞMEZ (~3 adım/sn).

### Görsel oyun hissi (`src/lib/gameFeel.ts`)
`juice.ts` KULAĞA ve ELE hitap eder (ses + titreşim); `gameFeel.ts` GÖZE.
⚠️ Ölçüldü: ses katmanı 15 oyunun hepsindeydi ama görsel taraf boştu —
`SARSINTI_SINIFI` dışa aktarılmıştı ve HİÇBİR oyun kullanmıyordu (ölü kod).
Kaynaklar: Swink *Game Feel*, Vlambeer *Art of Screenshake*, Jonasson & Purho
*Juice it or lose it*, Eiserloh *Juicing Your Cameras*.
- ⚠️ **SARSINTI TRAVMANIN KARESİYLE** (`createSarsinti`): `sarsıntı = travma²`.
  Doğrusal olsaydı küçük olaylar (iniş) gözü tırmalar, sert olaylar (çarpma)
  yeterince ayrışmazdı; kare alınca ikisi TEK sayıyla ayarlanıyor. Gürültü
  rastgele değil farklı frekanslı SİNÜS karışımı (rastgele sayı her karede
  zıpladığı için "kar gürültüsü" gibi görünüyordu).
- ⚠️ **SARSINTI OYUN ALANINA, SAYFAYA DEĞİL** ve genlik KÜÇÜK (2B'de 7px):
  çocukta bütün sayfayı sarsmak yazıyı okunmaz yapıyor, mide bulandırıyor.
- ⚠️ **DONMA KARESİ 60-80 ms** (`createHitstop`, Vlambeer): vuruş anında oyun
  durur — bu minik sürtünme "bu ÖNEMLİYDİ" diyor. Çocukta üst sınır 0.1 sn
  (uzun donmayı "takıldı" sanıyor). ⚠️ **SIRA**: `sarsinti.guncelle(gerçekDt)`
  ÖNCE, `step(hitstop.suz(dt))` SONRA — donmada sarsıntı da donarsa ekran
  "kilitlendi" gibi görünür ve etki tamamen kaybolur.
- ⚠️ **3B'de SARSINTI TAKİPTEN SONRA EKLENİR**: kamera `lerp`/`damp` ile
  hedefe çekiliyor; sarsıntıyı önce yazarsan bir sonraki karede yumuşatma
  onu geri emiyor ve ekranda hiçbir şey görünmüyor.
- ⚠️ **CSS ANİMASYONU AYNI SINIFLA YENİDEN TETİKLENMEZ** — `data-` özniteliği
  değiştirmek de yetmez. `key` değiştirilir (Yılan'ın başı, Uçan Kuş'un
  çırpışı, Uzay Savaşı'nın namlu parlaması böyle çalışıyor).
- ⚠️ **MACERA'DA ZIPLAMA ARTIK ASİMETRİK** (Mario/Celeste): çıkışta normal,
  TEPEDE 0.55× (asılı kalma), İNİŞTE 2×. Sekmeli zaman (0.1 sn) ve tampon
  (0.12 sn) zaten vardı. ⚠️ Bölüm tasarımı bozulmasın diye ÖLÇÜLDÜ
  (`tools/perf/zipla.mjs`): tepe 113.3→116.9 px, havada 0.692→0.737 sn,
  yatay atlama 173→184 px, tepede asılı kalma 0.138→0.250 sn — ÜÇÜ DE
  BÜYÜDÜ, hiçbir blok ulaşılmaz olmuyor. (Elle hesap "havada kalma kısalır"
  demişti, YANLIŞTI: apex çarpanı inişin ilk bölümünü de yavaşlatıyor.)
- ⚠️ **EZİLME-UZAMA HACMİ KORUR** (`ezilmeUzama`, sx·sy ≈ 1) ve ölçek AYAKTAN
  uygulanır — tepeden ölçeklenen karakter zemine gömülüyor.
- ⚠️ **HIZ HİSSİ GÖRÜNTÜDEN GELİR**: Koşusu 13→24 birime hızlanıyordu ama
  kamera hep aynı açıyla bakıyordu. Artık görüş açısı (FOV) hızla açılıyor
  (64°→73°), çarpmada travmayla BÜZÜLÜYOR. Partisi ve Yarışı'nda da aynı.
  ⚠️ 9°'den fazlası küçük ekranda harfleri kenara itip okunmaz yapıyor.
  ⚠️ **KOŞUSU'NDA KAMERA YANAL TAKİP ETMEZ ve ASLA YATMAZ** (kullanıcı
  tespiti: "sağa sola giderken kameranın oynaması gözü çok yoruyor"). İki
  sebep: (1) göz hareketi sahnedeki SABİT referansa tutunarak çözüyor, kamera
  kayınca o referans kayboluyor; (2) ufuk eğilmesi (roll) en güçlü vestibüler
  çakışma ekseni — çakışma, simüle edilen hareketin karmaşıklığıyla artıyor.
  Yerine: karakterin kendi yatışı + gövde dönüşü + yanal esnemesi, kenar HIZ
  ÇİZGİLERİ (saf CSS/DOM, 3B sahneye çizim çağrısı eklemez, yalnız kenarlarda
  — ortada trenler ve harf panoları var), şerit/zıplama/kayma sesleri.
  Kalan tek kamera hareketi ÇARPMA sarsıntısı (kullanıcı onu beğendi) ve
  onun da DÖNME bileşeni Partisi/Yarışı dahil sıfırlandı.
  Bekçi: `gameFeelKapsam.test.ts` → "kamera konforu".
- Her oyunun mekanizması ayrı (tür tür seçildi): Macera ezilme+donma+sarsıntı,
  3B'ler FOV+sarsıntı, Uçan Kuş çırpış ezilmesi, Uzay Savaşı namlu parlaması +
  geri tepme, Balon gerçek patlama halkası, Match3 zincir rozeti, Hafıza
  eşleşme "pop"u / ıska sarsıntısı, Kutu Boşalt küçülerek patlayan kutu,
  Yapboz oturan parça, Quiz son 10 saniyede atan sayaç.
  Bekçi: `gameFeelKapsam.test.ts` (ÇAĞRI arar, import değil).

### Mobil his katmanı (Capacitor hedefli) — `docs/game-feel.md`
Her oyunun hangi oyuna benzediği, o türün imza teknikleri ve neyin BİLEREK
alınmadığı orada yazılı (Mario'nun kayganlığı, MK'nin drift kademeleri…).
- ⚠️ **`click` PARMAĞIN KALKMASINI BEKLER.** Ölçüm: oyun dosyalarında 69
  `onClick`'e karşı 19 `onPointerDown`; dokunmayla oynanan oyunların hiçbirinde
  `pointerdown` yoktu. İki kademeli çözüm: cevap SAYILMAYAN dokunuşlar
  (Hafıza kartı, Match3/Üçlü taşı, Yapboz parçası) → `onPointerDown`; cevap
  SAYILANLAR (balon, kutu, quiz şıkkı) → commit `click`te KALIR (kaydırırken
  kazara cevap verilmesin) ama `active:` basılma tepkisi eklendi — `:active`
  parmak değdiği an tetiklenir, JS beklemez. Bekçi: `mobilHis.test.ts`.
- ⚠️ **iOS'TA TİTREŞİM HİÇ ÇALIŞMIYORDU**: `navigator.vibrate` iOS Safari ve
  WebView'de YOK — bütün dokunsal katman iPhone'da sessizce kayboluyordu.
  `titresim.ts` artık katmanlı: (1) `window.Capacitor.Plugins.Haptics`
  (impact LIGHT/MEDIUM/HEAVY + notification SUCCESS/ERROR), (2) yoksa
  `navigator.vibrate`, (3) o da yoksa sessiz. ⚠️ **npm bağımlılığı YOK** —
  `purchases.ts` ile aynı köprü deseni; paket kurulu değilken 2. katmana
  düşer. Çağrı `void`: haptik sözünü beklemek kareye native köprü gecikmesi
  bindirir.
- ⚠️ **`prefers-reduced-motion` SAYGI GÖRÜR** (`hareketKatsayisi()`, 0.25):
  benzetim baş dönmesi insanların üçte birine kadarını etkiliyor ve FOV
  oynaması bilinen tetikleyici (Xbox erişilebilirlik kılavuzu). Travma
  sarsıntısı, üç 3B oyunun FOV'u ve DOM sarsıntısı kısılır — SIFIRLANMAZ,
  yoksa oyun "tepki vermiyor" hissi veriyor. Önbellek testte
  `__resetHareket()` ile atılır.
- Tür imzası olarak eklenenler: Yılan kareler ARASINDA kayar (ızgara yalnız
  mantık; `transform` geçişi, süre TIK SÜRESİYLE aynı kaynaktan), Match3'te
  düşen taşlar ALTTAN yukarı KADEMELİ gecikmeyle iner, Uzay Savaşı'nda namlu
  parlaması + geri tepme, Uçan Kuş'ta çırpış ezilmesi + "+1" izi, Balon
  şişerek patlar (eskiden `opacity-0`), Kutu Boşalt küçülerek patlar, Yapboz
  oturan parçayı poplar, Quiz son 5 sn'de saniyede bir TIK sesi çalar
  (Kahoot'un geri sayım müziğinin müziksiz karşılığı), Parti'de çarpma anında
  ezilme (Fall Guys: "paçavralığı kaybedersen mizahı kaybedersin").

### Zorluk ve klavye (`src/lib/zorluk.ts` + `src/lib/klavye.ts`)
- ⚠️ **OYUNLAR SABİT HIZDA GİTMEZ** (kullanıcı tespiti: "hep aynı hızda
  geliyorlar, tek düze"). `rampa(dogruSayisi)` başlangıç hızından tavana
  **KAREKÖK** eğrisiyle çıkar — doğrusal rampa ilk 5 soruda hiç fark
  ettirmeyip sonra duvara çarpıyordu; karekök erken hissettirir, geç
  boğar. Ölçüt SKOR DEĞİL **doğru sayısı** (skor seri bonusu/2X ile şişer;
  Koşusu'nda bu yüzden `SPEED_FULL` doğruya bağlanmıştı).
- **Üç kademe** `ZORLUKLAR` (kolay/orta/zor): `baslangic`, `tavan`,
  `tavanDogru` (tavana kaç doğruda varılır), `can`, `sik`, `sure`, `tahta`.
  **Varsayılan KOLAY** (kullanıcı şartı — çocuklar hep kolayla başlasın).
- ⚠️ **ZORLUK HER OYUNDA AYNI ŞEY DEĞİL — ÜÇ EKSEN.** 14 oyunun hepsi bağlı
  (bekçi: `zorlukKapsam.test.ts`; bir dönem yalnız 6'sı bağlıydı ve Ayarlar'daki
  düğme çalışıyormuş gibi duruyordu).
  · **HIZ** (Koşusu, Macera, Parti, Yarışı, Balon, Kuş, Yılan, Uzay):
    hız bandı + `can`. Koşusu'nda **Orta kademe eski ayarı BİREBİR korur**
    (13.0 → 24.0, 40 doğruda; 10 doğruda 14.8) — zorluk yalnız bandın uçlarını
    kaydırır, kullanıcının onayladığı t² eğrisine DOKUNMAZ.
  · **SÜRE** (`sureIcin`, Hızlı Quiz): Kolay 90 sn · Orta 60 · Zor 45. Kolayda
    süre UZAR — hız çarpanının TERSİ yönde, ikisini aynı alandan türetme.
  · **TAHTA** (`tahtaBoyu`; Hafıza, Üçlü Eşleştir, Üçlü Eşle, Kutu Boşalt,
    Yapboz): zorluk hız değil HAFIZA YÜKÜ. Hafıza 4/6/8 çift, Üçlü Eşleştir
    3/4/5 çeşit, Kutu Boşalt 3/4/5 tip. Yapbozda **yaş TABAN, zorluk ±1
    basamak** (yaşı silip yalnız zorluğa bakmak 4 yaşındakini 16 parçaya atıyordu).
  ⚠️ **ALT SINIR ŞART**: 2 çeşitli eşleştirme tahtası kendi kendini patlatır.
  ⚠️ **HAFIZA'DA YUVARLAMA AŞAĞI**: en yakına yuvarlayınca Kolay ile Orta AYNI
  tahtayı alıyordu (6·6·8) ve zorluk hiçbir şey değiştirmiyordu. Çift sayı da
  şart — 3 sütunlu ızgarada 10 kart son satırda tek kart bırakıyor.
- ⚠️ `sikSayisiIcin(seviye, tavan)` şık sayısını **yalnız L1-L2'de** düşürür:
  yeni harfte az şık yardımdır, bilinen harfte ölçümü sulandırmak olur
  (yukarıdaki `sansPayi` bunu zaten cezalandırıyor, ikisi birlikte çalışır).
- **PC'de oynanır** (`klavye.ts`): WASD **ve** yön tuşları birlikte (basit
  oyunlarda ikisi de), boşluk = zıpla/ateş, şıklar için **1-9**
  (`useSecenekTuslari`, Digit + Numpad). Tuş kodu `e.code` ile okunur —
  `e.key` Türkçe klavyede farklı harf verir. `pcMi()` =
  `matchMedia("(pointer: fine)")`; ipucu metni `ipucu(dokunmatik, klavye)`
  ile cihaza göre yazılır (telefonda "SPACE" yazmak kafa karıştırıyor).

### Oyunlar
- ⚠️ **HAFIZA'DA SÜPER MOD = SES↔RESİM** (kullanıcı fikri): çift artık iki
  aynı glif değil; "a" yüzü GLİF (sessiz açılır), "b" yüzü 🔊 (açılınca
  gerçek kaydı çalar). Normal modda eski hâli. **İlerleme sayımı kuralı**:
  seviye YALNIZ çocuk bir harfin SES kartını İLK DEFA açıp doğru resmi
  bulduğunda artar — o an gerçek geri getirme vardır (sesi duyar, resmin
  yerini HATIRLAMAK zorundadır). TERSİ SAYILMAZ (önce resim, sonra ses =
  yalnız konum hafızası) ve ikinci açılışta da sayılmaz. Yanlış eşleşme
  SRS'e YAZILMAZ: hafıza oyununda ıska konumu unutmaktır, harfi bilmemek
  değil — ona −2 seviye yazmak ölçtüğümüz şeyi bozar. Bayrak `ilkKartYeniSes`
  ile kart AÇILMADAN ÖNCE okunur (sonra okursan hep "görülmüş" çıkar).
- ⚠️ **OYUN SİLİNİRSE ALTI YER GÜNCELLENİR** (İki Yol Koşusu böyle kaldırıldı,
  kullanıcı isteği): dosyanın kendisi · `Game.tsx` (lazy import + `GAMES`
  dizisi + `case`) · `Games.tsx` (liste) · `SUPER_MODE_GAMES` (gameMode.ts) ·
  `tools/perf/*.mjs` içindeki oyun listeleri · kapsam testlerindeki oyun
  SAYISI (`zorlukKapsam` tam sayı bekliyor). ⚠️ **ÇOCUĞUN CİHAZINDAKİ REKOR
  KENDİLİĞİNDEN SİLİNMEZ**: kayıtlar tek sözlükte oyun id'siyle duruyor ve
  kimse okumadığı için sonsuza kadar orada kalıyordu — `oyunSonucu.ts`
  içindeki `KALDIRILAN` kümesi okuma sırasında bir kez ayıklıyor.
- 14 oyun `src/pages/games/`; kayıt: Game.tsx (route) + Games.tsx (liste,
  Kolay/Zor gruplu) + `SUPER_MODE_GAMES` (gameMode.ts) + Settings metni.
- "Elif Ba Macerası" (`PlatformGame.tsx`, id "platform"): 10 bölüm, cami
  finali. **Şiddetsiz tasarım korunacak** — canavar öldürülmez, Nur'a değen
  canavar güvercine dönüşüp uçar. ✨ **Nur ışığı atışı**: Nur açıkken ✨
  düğmesi (klavye J/F) ışık fırlatır; değdiği canavar yine güvercin olur —
  silah değil, ışık. 🌑 **Karanlık Bulut** yalnız 10. bölümde, caminin
  önünde: öldürülmez, 5 ışıkla AYDINLATILIR, dağılınca yuttuğu harfler
  saçılır. Arenaya girince kandil yanar (nur sürekli tazelenir); ışık
  perdesi bulut dağılmadan camiye geçirmez. Bulut yalnız yavaş "gölge
  damlası" gönderir (kaçılacak engel).
- "ElifBa Koşusu" (`SubwayGame.tsx`, id "subway"): R3F 3D koşu.
  ⚠️ **Hız rampası SKORA değil DOĞRU SAYISINA bağlı** (`SPEED_FULL` = 40).
  Eskiden `BASE + score*0.05` idi; doğru cevap 10-20 puan (2X ile 40)
  getirdiği için çocuk 6-11 doğruda tavan hıza çıkıyordu ("hemen
  hızlanıyor"). Skor seri bonusu ve 2X ile şiştiği için kötü ölçüttü.
  Şimdi 10 doğruda 14.8 (eskiden 23.0), tavan 40 doğruda. Arapça
  harfler canvas dokusuyla (troika değil), pano dokusu ölçüp sığdırır
  (derin çanaklı harfler kesilmez), fog'dan muaf. Tasarım:
  `docs/tren-sorfu-tasarim.md`. rAF arka planda kısılır — DT_MAX kelepçesi var.
  ⚠️ **GÜÇ SÜRESİ RAKAMLA DEĞİL AZALAN BARLA** (`GUCLER`, sol alt köşe):
  eskiden sağ üstte "🚀 4s" yazıyordu — 5-8 yaşta rakam okumak ayrı bir iş,
  üstelik çocuk koşarken köşedeki iki karakteri okuyup saniyeye çeviremiyor.
  Doluluk = kalan süre, okuma gerektirmez. **Tek bar yeter**: `onGate` yeni
  gücü yalnız üçü de bitmişken veriyor, aynı anda en fazla bir güç etkin.
  ⚠️ Barın genişliği CSS geçişiyle yumuşatılır: HUD 200 ms'de bir güncelleniyor
  (kasıtlı — her karede React render etmemek için), geçiş olmadan çubuk
  saniyede 5 kez ZIPLAYARAK kısalıyor.
  ⚠️ **GÜÇ BİTMEDEN KARAKTER "NEFES ALIR"** (`nefesSaydamligi`, gameFeel.ts —
  ortak katmanda, Parti/Yarışı da kullanabilsin diye). Kullanıcı şartı:
  "bara bakmasa bile anlasın". Koşu oyununda göz YOLDA olmak zorunda; köşedeki
  çubuğu izlemek engel kaçırmak demek, o yüzden uyarı çocuğun zaten baktığı
  yerde de veriliyor. Son `GUC_UYARI` (1.6 sn) boyunca saydamlık kosinüsle
  **4 kez** 1 → 0.35 → 1 gider (ölçüldü: 2.82 sn'de başlıyor, dipler 0.38 ·
  0.37 · 0.35 · 0.35, tam bitişte 1.00). ⚠️ İki ucu da 1 olmalı — bitişte
  yarı saydam kalırsa çocuk gücün sürdüğünü sanır. ⚠️ SERT yanıp sönme
  DEĞİL: sert `visible` yanıp sönmesi bu oyunda zaten "hasar aldım"
  (`ghostT`); iki durum aynı işareti verirse ayırt edilemez.
  ⚠️ Malzemelerin `transparent`ı MOUNT'ta açılır — çalışma anında değiştirmek
  three.js'te shader'ı yeniden derletir, tam da gücün bittiği anda kare düşer.
  ⚠️ **EKRANDA YÖN TUŞU YOK** (kullanıcı şartı: "en alttaki renkli yön
  tuşlarını kaldır"). Bütün hareketler oyun alanının KENDİSİNDEN yapılıyor:
  kaydırma (sağa/sola şerit · yukarı zıpla · aşağı kay) ve kısa dokunuş
  (sol/sağ üçte bir şerit, ORTA soruyu tekrar dinletir), masaüstünde ok
  tuşları/WASD. Hiçbir işlem yalnız tuşlara bağlı değildi, o yüzden
  kaldırmak bir yeteneği götürmedi. Geri koyma.
- "Elifbâ Partisi" (`PartyGame.tsx`, id "party"): **Fall Guys tarzı 3B engel
  parkuru**, 5 botla yarış, tam ekran + dikey + mobil kontroller. R3F DEĞİL,
  **düz three.js** (her karede ~40 hareketli gövde; React ağacına bağlamak
  gereksiz reconcile). Engeller: dönen çekiç, sallanan sarkaç, alçak dönen
  çubuk, yana kayan silindir, çamur. Şiddetsiz: değen karakter takla atıp
  yavaşlar, ölmez/elenmez; ağ yalnız yavaşlatır.
  - ⚠️ **EKSEN KURALI: yarış -Z yönünde koşulur.** Mantıksal `z` 0→len ARTAR
    ama sahneye hep `wz(z) = -z` ile yerleştirilir. Kamerayı +Z'ye baktırmak
    (parkuru +Z'de kurmak) three.js'te görüntüyü AYNALAR: harfler ters okunur,
    "sağ" tuşu ekranda sola gider. Yeni nesnenin z'sini ham koyma, `wz()` kullan;
    lokal +Z'de duran parçanın (çekiç kolu) mantıksal z'si TERS işaretlidir.
  - **10 bölüm** (`LEVELS` tablosu) + bölüm seçme ekranı (`phase: "levels"`);
    engeller reçeteden PROSEDÜREL dizilir. İlerleme `elifba-party-progress-v1`,
    test kilidi (1234) hepsini açar. Bölümü bitirmek sonrakini açar (derece
    şartı yok). Bitiş ekranında "Devamı gelecek" notu var.
  - **Soru kapıları seyrek**: kapılar parkurun iki ucuna YAYILIR ve aralarında
    `PROMPT_LEAD`'den (100 birim) fazla mesafe olmak ZORUNDA — yoksa bir kapıyı
    geçer geçmez sonrakinin sesi çalıp çocuk hiç nefes almıyor. Kapı sayısını
    artırırken `len`'i de artır (kabaca her 150 birime bir kapı).
    Kapı çevresindeki engelsiz pay ASİMETRİK: önü 48, arkası 12 birim
    (simetrik yapılınca kapılar arası tamamen boşalıyor).
  - **Soru sesi ERKEN çalar** (`PROMPT_LEAD` = 100 birim ≈ 9 sn) ve kapıya
    `PROMPT_REPEAT` (30) kalınca bir kez daha — kullanıcı şartı: 40 birimle
    (3.5 sn) çocuk "anca yetişiyordu", bilinmeyen harf + çocuk refleksi
    birleşince imkânsıza yakındı. Gate'teki `said` alanı iki çalmayı ayırır.
    Aynı anda yalnız SIRADAKİ kapı görünür (iki kapı üst üste görününce çocuk
    hangisine cevap vereceğini şaşırıyor).
  - **Kontrol hyper-casual**: canvas'ta parmağı basılı tutup KAYDIRINCA karakter
    parmağı takip eder (`ctrl.dragX`). Subway Surfers gibi "swipe = şerit atla"
    DEĞİL — hareket sürekli. Kaydırmadan kısa dokunuş (<260 ms) = zıpla.
    Düğmeler YÜZER (alt bara sabitlenirse parmak oraya takılıp kaydırma bozulur).
  - **Tek özel güç** (kullanıcı şartı): doğru kapı RASTGELE bir güç verir
    (🚀 roket · ⭐ süper zıplama · 🕸️ ağ · 🛡️ kalkan), slot tektir, yenisi
    eskisinin üstüne yazar. Tek düğmeyle kullanılır. **Güç ışıkla anlatılır**:
    kazanınca karakter parlar (`glowT`), etkinken gövde `emissive` + aura küresi
    + ekran kenarı parıltısı. emissive'i 0.4'ün üstüne çıkarma — karakterin
    kendi rengi kaybolur.
  - **Botlar kapıyı RASTGELE seçer** (kullanıcı şartı). Eskiden `skill`'e göre
    çoğunlukla doğruyu buluyorlardı; çocuk doğru cevap verse bile öne
    geçemiyordu. Bot `skill`'i artık yalnız ENGELDEN KAÇMA (`dodge`) içindir.
  - **Zıplama bir kaçış aracıdır**: normal zıplama tepe ≈4.3 birim, ⭐ kozu
    ≈13 birim. Her engelin `clear` eşiği var (çekiç 4.4, sarkaç 4.2, silindir
    2.4, çubuk 1.5) — üstünden geçilebilir.
  - ⚠️ **TAKLA SONRASI DOKUNULMAZLIK** (`graceT`, `GRACE_TIME` 1.2 sn):
    alçak dönen çubuk (spinner) sürekli döndüğü için çocuk bir kez
    takıldığında ÇIKAMIYORDU — takla 1 sn sürüyor, o sırada ne yön
    değiştirebiliyor ne ZIPLAYABİLİYOR (zıplama `hitT > 0` iken kapalı),
    2.4 birimlik geri itilme çubuğun 8.5 birimlik erişiminden çıkarmıyor.
    Üst üste 4-5 kez düşüyordu. Takladan sonra hiçbir engel çarpmaz;
    karakter yanıp sönerek bunu GÖSTERİR. ⚠️ Görünürlüğün TEK SAHİBİ
    kamera bloğudur — iki ayrı yerde `group.visible` atarsan biri ötekini
    ezer (bir kez oldu).
  - ⚠️ **YARIŞ 3-2-1 SAYIMIYLA BAŞLAR** (`geriSayim`, 3.2 sn): bölüm seçilir
    seçilmez koşuluyordu ve ilk kapının sorusu `step` içinde silahlanıp
    ekran boyanmadan çalıyordu (kullanıcı: "başlayınca ekran gelmeden ses
    geliyor"). Sayım `step`'i geciktirdiği için ses de kendiliğinden
    gecikiyor — ayrı bir ses erteleme koduna gerek yok. ⚠️ Sayım
    `ctrl.running` ile İZLENMEZ, ayrı `basladi` bayrağıyla izlenir:
    duraklatma da `running`'i kapatıyor, tek bayrakla sayım sırasında
    duraklatınca sayaç ilerleyip oyunu KENDİLİĞİNDEN başlatıyordu.
    ⚠️ Sahne sayımdan ÖNCE `yerlestir()` ile kurulur (Yarışı'ndaki
    `placeRacers()` tuzağının aynısı): yer/kamera yalnız `step()` içinde
    yazılıyordu, çocuk sayım boyunca BOŞ yola bakıyordu (ekran görüntüsüyle
    görüldü). Sayı ekranın ortasında değil YOLUN ÜSTÜNDE (`pt-[26vh]`) —
    tam ortada karakterin ve "Sen" etiketinin üzerine biniyordu.
    Bekçi: `gameFeelKapsam.test.ts` → "geri sayım (Parti)".
  - Diğer tuzaklar: kamera oyuncunun ~17 birim gerisinde → geçilen kapı
    gizlenmeli, kameraya yakın yarışmacı `visible=false`; çekiç direği pivotun
    çocuğu OLMAYACAK (yoksa çekiçle döner); yüz düzlemi kapsülün DIŞINDA ve
    -Z'ye bakar; bot şeritleri orta şeridi (oyuncunun) boş bırakır.
- "Elifbâ Yarışı" (`KartGame.tsx`, id "kart"): **Mario Kart tarzı 3B kart
  yarışı**, 3 pist × 2 tur, 5 bot. Partisi'nden AYRI oyun: orası düz koridorda
  koşu, burası VİRAJ ALMA — pist bir eğri (spline), çime çıkmak yavaşlatır,
  viraja hızlı girmek savurur.
  - ⚠️ **PİST BİR EĞRİDİR**: oyun mantığı iki sayıyla çalışır — `s` (pist
    boyunca mesafe) ve `u` (ortadan yanal sapma). Dünya konumu her karede
    `worldAt(s,u)` ile eğriden hesaplanır. Çarpışma/bot/kapı mantığı düz bir
    koridordaymış gibi basit kalır. Eğri `getSpacedPoints` ile örneklenip
    LOOKUP tablosuna alınır (`getPointAt` her karede çağrılırsa pahalı) —
    eşit aralıklı örnekleme şart, parametrik olursa virajda hız dalgalanır.
  - ⚠️ **`Object3D.lookAt` yerel +Z'yi hedefe çevirir** (KAMERA ve IŞIK'ta −Z!).
    Bu yüzden kart modelinin ÖNÜ +Z'dedir (nose +2.1, spoiler −1.85); model
    −Z'ye bakacak şekilde kurulunca araç bütün yarışı geri geri gidiyordu.
    Aynı sebeple kapı grubu `lookAt(GERİYE)` döner — ileriye baktırılınca pano
    ön yüzü çocuktan uzağa bakıp harfler AYNALANIYOR ve şeritler ters
    sıralanıyordu. `flatOnTrack`'te düzlem `rotation.z = π` alır, yoksa yerdeki
    ok deseninin "yukarısı" geriyi gösterir.
  - ⚠️ **u'nun İŞARETİ**: `normals = UP × teğet` ama ileri bakan sürücünün
    SAĞI `teğet × UP = −normal`'dir. Bu yüzden `worldAt` u'yu **negatif**
    işaretle uygular (`addScaledVector(normal, -u)`) → u pozitif = SAĞ.
    Düzeltilmeden önce parmağı sağa kaydırınca araç sola gidiyordu.
  - Pist KAPALI: `s` sarmalanır (`wrapS`), mesafe karşılaştırmaları iki yönden
    ölçülüp küçüğü alınmalı, yoksa bitiş çizgisi civarında çarpışma kaçar.
  - Araç yerleştirme `placeRacers()` ile AYRI: yalnız `step()` içinde kalırsa
    geri sayım boyunca bütün araçlar sahnenin merkezinde üst üste durur.
  - **Yol düzlemine yatık nesne** (bitiş çizgisi, hız rampası) için `flatOnTrack`
    kullan: grup lookAt ile teğete döner, düzlem grubun İÇİNDE yatırılır.
    Aynı nesnede `rotation.x` + `rotation.z` vermek Euler sırası yüzünden
    nesneyi eğriltiyor.
  - Kapı grubu `lookAt(ileri)` ile döner → grubun yerel **+X = -normal**,
    bu yüzden pano yanal konumu `-laneU(i)`. (Ters kurulunca harf aynalanır.)
  - Görüntü kalitesi: `ACESFilmicToneMapping` + sRGB çıkış + PCFSoft gölge +
    `MeshStandardMaterial` + gradyan gökyüzü kubbesi (ShaderMaterial).
    Gölge kamerası aracı takip eder (tüm pisti kapsayamaz, çözünürlük erir).
  - Çime çıkan oyuncu yavaşça asfalta itilir (`|u| > roadHalf` iken) — küçük
    çocuk pistin dışında takılıp kalmasın; ceza yavaşlık, kilitlenme değil.
  - Şiddetsiz: muz yalnız KAYDIRIR, yıldız yalnız korur. Güçler tek slot ve
    rastgele (🍄 turbo · ⭐ yıldız · 🍌 muz · 🪶 tüy), Partisi'yle aynı kural.
  - ⚠️ **TEKERLEK ÜÇ KATLI KURULUR** (`body → hub → wheel`, ölçüm
    `tools/perf/teker.mjs`). Kullanıcı "sağa sola gidince ön tekerler
    havadaymış gibi" dedi; ÖLÇÜLDÜ: tam savrulmada aks yataydan **35.5°**
    kalkıyor, tekerlek yerden **0.373 birim** (yarıçapının %60'ı)
    yükseliyordu. İKİ AYRI kusur aynı görüntüyü veriyordu:
    (1) **gövde eğimi tekerleği de yatırıyordu** — gerçek araçta gövde
    süspansiyon üzerinde yatar, lastik YERDE kalır; eğim artık `shell`
    düğümünde, tekerlekler `body`nin doğrudan çocuğu.
    (2) **yuvarlanma (X) ile direksiyon (Y) AYNI Euler'deydi** — three.js
    "XYZ" sırasında matris Rx·Ry olur, yani sürekli büyüyen yuvarlanma açısı
    direksiyon EKSENİNİ devirir (Unity forumlarındaki klasik "ön teker
    gimbal" sorunu). Artık göbek yalnız Y, çocuğu olan tekerlek yalnız X.
    Yeni değerler: aks eğimi **0°**, yerden açıklık **0**.
  - ⚠️ **DİREKSİYON AÇISI İKİ KAYNAĞIN TOPLAMI**: (a) sürüş girdisi
    (`drift × STEER_INPUT`, arcade payı — çocuk sağa basınca teker görünür
    biçimde sağa döner), (b) **pistin kavisi**, bisiklet modeliyle
    δ = atan(L·κ). (b) olmadan uzun virajda `drift` sıfır olduğu için teker
    DÜMDÜZ kalıyordu, oysa araç dönüyor. κ, pist boyunca iki kirişin
    arasındaki açıdan ölçülür — **dt gerektirmez**, geri sayımda da doğru.
    Üstüne **Ackermann**: iç teker daha küçük yayı çizdiği için daha çok
    döner (cot δ_dış = cot δ_iç + iz/dingil; iz 2.5, dingil 2.6 → 24°
    ortalamada iç 29.6° · dış 20.2°). Sürücünün elindeki direksiyon da döner.
  - ⚠️ **JANTTA DESEN OLMAZSA DÖNÜŞ GÖRÜNMEZ** (`hubTexture`): lastik de
    göbek de düz silindir, yani dönme eksenine göre TAM SİMETRİK — kod her
    karede döndürüyordu, ekranda hiçbir şey değişmiyordu. Doku PAYLAŞILIR,
    çizim çağrısı artmaz (ölçüldü: 185 çizim / 47.9k üçgen — eskisiyle
    AYNI). ⚠️ Desenin simetri derecesi **strobe sınırını** belirler: `n`
    kollu göbek karede π/n'den fazla dönerse zamansal örtüşmeye girer ve
    tekerlek GERİYE dönüyormuş gibi görünür (wagon-wheel etkisi). Görsel
    açısal hız bu yüzden `π/(HUB_SPOKES·dt)` ile kelepçelenir — dt'ye bağlı
    olduğu için 30 fps'lik cihazda kendiliğinden daha sıkı. Yuvarlanma
    ω = v/yarıçap (arka teker büyük → yavaş döner) ve **dt ile** çarpılır;
    eski sabit `* 0.016` 120 Hz telefonda tekerleği iki kat hızlı
    döndürüyordu. Bekçi: `gameFeelKapsam.test.ts` → "tekerlek (Yarışı)".
  - Sürücü ANIMAL CROSSING oranlarında ve YUVARLAK parçalardan (küre/kapsül/
    torus): büyük kafa, çizilmiş sevimli yüz, AÇIK kask (kapalı vizör camı
    YOK — küre "kuşağı" kaskın çevresini sardığı için arkadan bakınca cam
    çocuğa dönük görünüp sürücü geri bakıyor sanılıyordu), kulaklık + ponpon
    (kamera hep arkada, sevimlilik arkadan okunmalı), tulum aracın AÇIK tonu
    (aynı renk olunca gövde kaportaya karışıyor).
  - Yolun iki yanında beyaz KENAR ÇİZGİSİ (asfalt/kerb sınırı) — hız yaparken
    pistin sınırı yoksa okunmuyor. ⚠️ `buildRibbon` kenarları küçükten büyüğe
    sıralar: ters verilirse (sol taraf −11 → −12.6) üçgen sarımı döner, normal
    aşağı bakar ve şerit YALNIZ BİR TARAFTA görünür.
  - Rakip gizleme ölçütü KAMERAYA MESAFE (< 5 birim); "oyuncunun gerisindeki
    herkes" denince geçilen rakip daha yanı başındayken yok oluyordu.
  - Yarış ekranında sol üstte ÇIKIŞ (X) düğmesi var — yoksa çocuk yarışın
    ortasında oyunlara dönemiyor.
  - `_letterTexture.ts` ortak: harf panosu / isim etiketi / sevimli yüz /
    emoji dokusu. Partisi de bunu kullanır — harfi panoya sığdırma ve yüz
    çizimi tek yerde.
- ⚠️ **YARIŞ BAŞLANGIÇ SESİ İKİ SESTİR** (`sfx("sayim")` / `sfx("start")`,
  juice.ts): motor sporlarının evrensel deseni — **aynı perdede üç tik,
  sonra daha TİZ ve UZUN bir işaret**. Sayımda perde kasten DEĞİŞMEZ;
  yükselen bir sayım son notayı sıradanlaştırır, "başla"nın farklı olduğu
  ancak öncekiler tekdüze olunca anlaşılır. Tikin altındaki 180 Hz'lik
  vuruş telefon hoparlörü içindir (ince bir bip küçük hoparlörde cılız
  kalıyor). Sesi "geri sayım" değil "YARIŞ geri sayımı" yapan şey
  **motor**: `motor()` (audio.ts) perdesi KAYAN testere dalgasını perdeyi
  takip eden rezonanslı süzgeçten geçirir, iki osilatör hafif detonedir
  (vuru = hırıltı). Tikte kısık bir gaz blibi (88→132 Hz), başlangıçta
  kalkış (110→460 Hz) + lastik cıyaklaması (yüksek Q'lu `gurultu`).
  Bekçi: `yarisSesi.test.ts` — sahte AudioContext kurup GERÇEKTEN hangi
  osilatörün hangi perdede açıldığını ölçer (dizgi eşleştirmesi değil).
- ⚠️ **GERİ SAYIM SAYACI KELEPÇESİZ SÜREYİ KULLANIR** (Yarışı): fizik dt'si
  `DT_MAX` (0.05) ile kırpılıyor — arka plandan dönüşte tünelleme olmasın
  diye. Sayacı onunla beslemek 20 fps'in ALTINDAKİ cihazda geri sayımı
  YAVAŞLATIYOR: ölçüldü (`tools/perf/sesZaman.mjs`, ~10 fps) tikler 1.0 sn
  yerine 2.0 sn arayla çaldı, "3-2-1" 3.2 yerine **5.8 sn** sürdü.
  `cd -= Math.min(0.5, dtRaw)` — 0.5 tavanı arka plandan dönüşte sayımın
  tek karede bitmesini engeller. (Partisi'nde aynı kalıp duruyor.)
- ⚠️ **UYARLANIR ÇÖZÜNÜRLÜK** (`_perf.ts`, Partisi + Yarışı): Capacitor/
  WebView'de en pahalı şey üçgen değil DOLDURULAN PİKSEL. 2026 telefonlarında
  dpr 2.6-3.5; sabit `setPixelRatio(2)` ile 412×880 ekran 1.45 MP olarak
  çizilir, üstüne PCFSoft gölge + antialias binince kare 16 ms'i aşar.
  `createAdaptiveResolution` kare süresini ÖLÇER (cihaz sınıfı tahmin etmez):
  >22 ms ise oranı 0.25 düşürür, <13 ms ise yükseltir, [1, 2] arası.
- **Yarış süresi**: 3 tur × büyütülmüş pist ≈ 2-2.5 dk (kullanıcı şartı
  "birkaç dakika araba kullansınlar"). Tur sayısı BEDAVA süredir (aynı
  geometri tekrar dönülür); pisti büyütmek yalnız yol şeridinin üçgenini
  artırır (tek mesh). Ölçüm: pist %43 uzayıp turlar 2→3 olunca (toplam
  mesafe ×2.1) çizim çağrısı 216→234, üçgen 46k→51k. Dekor SAMPLES'a bağlı
  olduğu için uzunlukla artmaz.
- **Soru sesi kapı başına TEK KEZ** çalar (Partisi ve Yarışı) — otomatik
  tekrar YOK; kullanıcı şartı: aynı soruyu iki kez sormak (biri uzakta, biri
  kapıya yakın) rahatsız ediyor. Tekrar dinlemek "Hangi kapı? — dinle"
  bandına dokunmakla olur.
- ⚠️ **KAPILAR EĞRİLİĞE GÖRE YERLEŞİR (Yarışı).** Pist boyunca EŞİT bölmek
  kapıyı VİRAJ ÇIKIŞINA düşürebiliyor: çocuk virajı alıyor, şıkları ancak
  ~1 sn kala görüyor. Ölçüm (Yıldız Vadisi 2. kapı, eşit bölmeyle s=420):
  yaklaşımın son 70 biriminde κ=0.019 — pistin en sert virajının %45'i,
  bütün pistlerdeki en kötü değer. Artık kapılar eşit noktadan ±%15 kayarak
  yaklaşımı EN DÜZ yerlere BİRLİKTE yerleştirilir; kapı aralığı eşit aralığın
  %78'inin altına inemez ve ilk 110 birim boş kalır. Sonuç: her pistte her
  kapının yaklaşım κ'sı ≤0.0102 (Yıldız 2. kapı 0.0190→0.0102).
  ⚠️ Ortak arama ŞART — kapılar tek tek en düze kaçınca aralıklar bozuluyor
  (bir denemede 100 birime düşmüştü). Aralık kontrolü de SIRALI dizide
  yapılmalı: pencere sarmalanınca kapılar sıra değiştirip iki kapı 4 birim
  aralığa düştüğü hâlde kontrol "geçti" diyordu.
- ⚠️ **Dekor kapı YAKLAŞIMINA konmaz** (`inGateSight`, 100 birim): 15-31 birim
  yanda duran ~10 birim boyundaki ağaç, virajın içinde kalınca kapıyı tam
  olarak gizliyordu ("viraja girmeden bir yer var, orada da ağaç var").
- ⚠️ **KAPI ARASI NEFES PAYI = kapı aralığı − PROMPT_LEAD.** Bu pay geri
  bildirim melodisinden (~0.65 sn) belirgin biçimde büyük olmalı, yoksa
  sıradaki sorunun sesi geçilen kapının "doğru/yanlış" sesiyle AYNI ANDA
  çalar ve duyulmaz — çocuk için soru hiç sorulmamış olur ("2. harfte ses
  gelmedi, sadece şıklar vardı"). Yarışı'nda pist halka ve kapılar eşit
  bölündüğü için pay pistten piste değişiyordu: Bahçe 366−260=106 (3.5 sn),
  **Çöl 242−260 = NEGATİF**, **Yıldız 280−260=20 (0.7 sn)**. Çözüm
  `PROMPT_GAP` (1.6 sn): kapı cevaplandıktan sonra sıradaki soru bu süre
  dolmadan çalmaz; `nextD < 80` emniyeti bekleme yüzünden sorunun
  ATLANMAMASINI garanti eder. Partisi'nde pay en dar bölümde bile 4.1 sn
  (10. bölüm) olduğu için orada gerekmedi — yeni bölüm/pist eklerken bu
  payı hesapla.
- ⚠️ **SORU "SORULDU" SAYILMASI SESİN GERÇEKTEN ÇALMASINA BAĞLI.** `playItem`
  artık `onFail` alıyor: `play()` reddedilirse (mobil WebView'de olur) ya da
  dosya hatası yüzünden robotik TTS'e düşülürse haber veriyor. Kapı bunu
  duyunca `said`'i sıfırlıyor ve bir kez daha deniyor (en fazla 2). Bu "iki
  kez sormak" DEĞİL — kullanıcı onu istemedi — "bir kez gerçekten sorabilmek".
  Eskiden `said = 1` iyimser konuluyordu: ses çalmasa bile soru sorulmuş
  sayılıp bir daha hiç sorulmuyordu. Kapı silahlanınca `preloadItems([target])`
  ile mp3 önden indiriliyor (yavaş bağlantıda ses kapıdan sonra geliyordu).
- ⚠️ **KAPI SORUSU SIRASI GELİNCE DAĞITILIR** (`armGate`, Partisi + Yarışı).
  Bölüm/yarış kurulurken bütün kapılara birden soru dağıtılamaz: aralarında
  hiç cevap kaydedilmediği için SRS durumu değişmez ve `pickNextGameItem` her
  çağrıda müfredatın ilk görülmemiş harfini (Elif) döndürür → çocuk bütün
  bölüm boyunca tek harf görür. Aynı sebeple **cevap kaydı, sıradaki kapının
  seçilmesinden ÖNCE** gelmeli: Yarışı'nda pist halka olduğu için kapı geçilen
  KAREDE, o kapı `done` işaretlenmeden sıradaki kapı "en yakın" seçilip
  silahlanıyordu (Partisi'nde `find(!done)` dizi sırasıyla baktığı için sorun
  çıkmıyor). Regresyon testi: `src/test/gameGates.test.ts`.
- Arapça glif + `leading-none` = taşma; `leading-[1.5+]` kullan ve cn()
  içinde leading'i text-* SONRASINA koy (tailwind-merge yutar).
- Grid'ler `dir="rtl"` (Arapça sağdan sola).

## Performans (Capacitor / Play Store hedefli)

Uygulama **Capacitor ile Play Store'a** çıkacak. Capacitor'da paketler YEREL
diskten okunur — ağ beklemesi yok, darboğaz JS'in AYRIŞTIRILMASI ve pikselin
DOLDURULMASI. Ölçüm araçları `tools/perf/` (README'de tuzaklar yazılı).
⚠️ Capacitor paketi HENÜZ KURULU DEĞİL (`android/` yok, `@capacitor/core` yok);
koddaki Capacitor parçaları (`CapacitorBackHandler`, `purchases.ts`) yoksa
sessizce devre dışı kalıyor. Yükleme boyutu 20 MB (16'sı ses) — 150 MB
sınırının çok altında, ses dosyalarını KÜÇÜLTME.

- ⚠️ **BÜTÜN ROTALAR VE OYUNLAR `React.lazy` İLE BÖLÜNMÜŞ** (Index hariç —
  açılış sayfası beklemesin). Eskiden tek 2.4 MB'lık paket vardı: alfabe
  sayfasını açan çocuk 3B yarış motorunu da indirip ayrıştırıyordu.
  Ölçüm (CPU 4x yavaşlatılmış): açılış JS 2345 → 667 kB, ilk boyanma
  916 → 512 ms, DOMContentLoaded 573 → 153 ms. `manualChunks` three/react/
  supabase'i ayırıyor. **Yeni sayfa eklerken statik import YAZMA.**
- ⚠️ **UYARLANIR ÇÖZÜNÜRLÜK'ÜN İKİ TUZAĞI** (`_perf.ts`) — ikisi de aynı yöne
  bakıyordu: yardıma EN ÇOK muhtaç cihaz yardımı ya çok geç alıyordu ya hiç.
  (1) Pencere KARE sayarsa 10 fps'lik cihaz ilk düzeltmeyi 15 sn sonra alır
  (60 fps'lik 2.5 sn sonra) — pencere SANİYE ile ölçülür.
  (2) "Sekme arkaplanda" koruması `dt > 0.2` iken 5 fps altındaki HER kareyi
  eliyordu, uyarlama hiç devreye girmiyordu. Eşik 1 sn + `document.hidden`.
  Ölçüm: Partisi 10 → 15 fps, Yarışı 4 → 9 fps (canvas 824×1760'ta ÇAKILI
  kalıyorken 412×880'e iniyor). Bekçi: `perfUyarlanir.test.ts`.
- ⚠️ **R3F'te `dpr={[1, 1.75]}` TEK BAŞINA uyarlanır YAPMAZ** — R3F üst ucu
  kullanır, biri `setDpr` çağırana kadar orada kalır. Koşusu'nda tam olarak bu
  vardı. Çözüm `<UyarlanirDpr>` bileşeni; R3F'te `setPixelRatio`/`setSize`
  ÇAĞIRMA (R3F kendi boyutlandırmasını yapıyor, çakışıyor).
- **Dekor InstancedMesh olmalı**: Yarışı'nda ~240 ağaç/kaya tek tek Mesh idi,
  üç yığına indi (çizim çağrısı 206 → 185, üçgen artmadı — dekor düşük
  poligonlu). `frustumCulled = false` şart (örnekler pistin her yerinde).
- ⚠️ **BU SANDBOXTA GPU YOK** (swiftshader = yazılım rasterleştirici): 3B
  fps'i gerçek telefonu TEMSİL ETMEZ (CPU profilinde %83 `(program)`).
  Cihazdan bağımsız ölçüye bak — `tools/perf/3b.mjs`: çizim çağrısı/üçgen
  (Koşusu 121/9.0k · Partisi 207/32k · Yarışı 185/48k). 2B oyunların hepsi
  4x yavaşlatılmış CPU'da 60 fps.
- ⚠️ **OYUNU GERÇEKTEN BAŞLATMADAN ÖLÇME**: Partisi/Yarışı bölüm seçme
  ekranıyla açılıyor, orada rAF boşta dönüyor ve ölçüm "60 fps, min 60"
  diyor — oyun hiç çalışmamış olur.
- HUD'lar 200-250 ms'lik `setInterval` ile güncelleniyor (Koşusu, Macera):
  kasıtlı, her karede React render etmemek için. Bunları rAF'a çevirme.

## Git / dağıtım
- Repo: kaptankare5/elif-buddy-spark; `main` = Lovable'ın da yazdığı canlı
  dal. Lovable araya commit atar — push öncesi `git fetch` + kontrol et.
- main'e gönderim yöntemi (kabul görmüş): yerelde commit →
  `git commit-tree HEAD^{tree} -p origin/main` ile ileri commit → push
  (force-push YOK, geçmiş korunur).
- ⚠️ **DALDA OLAN CANLIDA YOK DEMEKTİR.** Dal ile main AYRI: dala commit
  atmak uygulamayı güncellemez, Lovable **main'i** yayınlar. Bir kez
  442 ses dosyası dalda hazır dururken kullanıcı eski sesleri duydu ve
  "yapmadın" sandı. İş bitti demeden önce
  `git diff --name-status origin/main HEAD` ile bak.
- ⚠️ **main'i dala MERGE ETME.** main'in ağacı zaten bu dalın kopyasıdır
  (commit-tree ile gidiyor) ama git bunu bilmez: `git merge origin/main`
  12 sahte çakışma üretti (bütün oyun dosyaları). Doğrusu CERRAHİ ALIM —
  `git diff --name-status <main'e-en-son-gönderdiğim-commit> origin/main`
  ile Lovable'ın DOKUNDUĞU dosyaları bul, yalnız onları
  `git checkout origin/main -- <yol>` ile al.
- ⚠️ **`commit-tree HEAD^{tree}` DALIN AĞACINI OLDUĞU GİBİ KOYAR** — main'de
  olup dalda olmayan dosya SESSİZCE SİLİNİR, main'de DEĞİŞMİŞ bir dosya da
  sessizce ESKİ hâline döner.
  ⚠️ **`grep '^D'` YETMEZ — bir kez tam olarak bundan dolayı Lovable'ın işi
  ezildi.** Yalnız silinenlere bakıyordum; Lovable araya 5 commit atıp şedde
  okunuşlarını düzeltmişti (`ebbe/ibbe/übbe`), benim ağacım onları `M` olarak
  geri aldı. Doğru emniyet, göndermeden HEMEN önce:
  `git fetch origin main && git diff --name-status HEAD origin/main`
  çıktısı BOŞ olmalı. Boş değilse önce cerrahi alım yap
  (`git checkout origin/main -- <yol>`), testleri çalıştır, sonra gönder.
- ⚠️ **Depo shallow klonlanıyor** (`.git/shallow` var, main'in geçmişi 96
  commit). Ortak ata bulunamadığı için git "refusing to merge unrelated
  histories" der; gerekirse `git fetch --unshallow origin`.
- gh CLI yok; PR gerekirse GitHub REST API + `git credential fill` token'ı.
- `.claude/` commit'lenmez. Commit mesajları Türkçe özet + madde.

## Gelecek özellikler
`docs/gelecek-ozellikler.md` — yapılmamış ama kararı verilmiş işler.
En önemlisi **sesli okuma denetimi** ("harfi gör, SÖYLE"): uygulamadaki
bütün ölçüm alımlama yönünde (sesi duy → harfi seç), Elifbâ kitabı ise
tersini istiyor. Üretim kanıtı şu an yalnız Flashcard'ın kendi beyanına
dayanıyor. Tuzaklar orada yazılı (tarayıcı konuşma tanıma hece tanımıyor,
çocuk sesi ≠ yetişkin sesi, eşik kalibre edilmeli, ses cihazdan çıkmamalı).

## Kullanıcı tercihleri
- Türkçe iletişim; çocuk odaklı UI (büyük dokunma alanları, ses öncelikli);
  para kazanma yok (hasSuperMode=true sabit); gerçek ses kayıtlarına dokunma.
