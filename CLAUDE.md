# Elifbâ (elif-buddy-spark)

Çocuklara Kur'an harflerini öğreten React uygulaması. Vite + React 18 + TS +
Tailwind + shadcn + Supabase (Lovable ile oluşturuldu). Dev: `npm run dev`
(port 8080, `.claude/launch.json` var). Doğrulama: `npx tsc --noEmit` + eslint.

## Mimari — kritik kurallar

### Ses (EN ÖNEMLİSİ — geçmişte bozuldu)
- Harf/hece sesleri GERÇEK hoca kayıtları: `public/audio/elifba/*.mp3`
  (basic/hareke/cezm/sedde/med/tenvin — 600+ dosya, item.audio alanında).
- **Daima `playItem(item)` kullan** (item.audio'yu çalar). `playSpeech(text)`
  metni `public/audio/manifest.json`'da arar; bulamazsa ROBOTİK tarayıcı
  TTS'ine düşer. Harf sesi için playSpeech KULLANMA. "Tebrikler!" gibi TTS
  kutlamaları kaldırıldı — `playFeedback(true/false)` (ding/buzz) kullan.

### Veri: `src/data/topics/elifba.ts`
- İki ayrı bölümleme var: `bolum()` = geleneksel 4'erli ("1. Bölüm" =
  elif be te se) — 1., 3. ve sonraki BÜTÜN konular bunu kullanır.
  `bolumYazilis()` = YALNIZ 2. konu (başta/ortada/sonda): karışabilen
  harfler aynı bölümde toplanır (ا ك ل · ب ت ث ن ي · ج ح خ · د ذ ر ز ·
  س ش ص ض · ط ظ ع غ · ف ق م و ه), 12 karışma öbeğinin hepsi tek bölümde.
  Bölüm ADLARI iki tarafta da sade ("N. Bölüm") — aile etiketi YOK
  (kullanıcı şartı). Harf sırası (LETTERS) hiç değişmedi.
- 28 harf `LETTERS` tablosunda: `cons` (ünsüz) + `thick` (ince/kalin/ra) →
  hareke okunuşları üretilir (kalın 7 harf a/ı/u; Râ karışık ra/ri/ru;
  gerisi e/i/ü). Adlar: Vev (Vav değil), Lem (Lam değil), Ye.
- 10 konu; 7/9/10 video'lu (`topic.video`, YouTube gömme Topic.tsx'te).
- `item.section` = "N. Bölüm" (yukarı bak) veya "Ekstralar"
  (Diyanet PDF alıştırmalarından). CRLF satır sonları — çok satırlı Edit
  eşleşmesi başarısız olursa nedeni bu (tek satır anchor veya node kullan).

### Öğrenme sistemi (bilimsel gerekçeli — koru)
- SRS `src/data/srs.ts`: L1-4. Yanlış = **-2 seviye** (kullanıcı şartı,
  değişmez). L3→L4 = üst üste 2 doğru (`consecutiveCorrect`). Seçici:
  görülmemişler müfredat sırasıyla, art arda aynı öğe yok, ağırlıklar
  L1 %55…L4 %15 (%85 başarı kuralı).
- Bölüm kilidi `src/lib/unlock.ts`: konu içi section'lar sıralı açılır.
  Açılma şartı İKİ tane: (1) bölümdeki tüm öğeler L3+, (2) bölüm içinde
  sıcak karışıklık kalmamış (`hotPairInSection`, eşik 0.6). Eskiler açık
  kalır. `isTopicCompleted` de aynı iki şarta bakar.
  Test/Flashcard/oyun havuzu (`gamePool`) YALNIZ açık öğeleri sorar
  (`getUnlockedItemsOf` / `getUnlockedItemIdSet`).
- Konu kilidi: konudaki tüm öğeler L3+ → sonraki konu. Ayarlar'da test
  kilidi: kod **1234** her şeyi açar (`src/lib/testUnlock.ts`).

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
- Yalnız `l2-*` (başta/ortada/sonda) hatalarında; harfin hafıza yöntemi
  tam ekran açılır. Yöntem HATANIN EKSENİNE göre: farklı harf karıştırdıysa
  nokta (`DotCompare`, hata yapılan hâlle açılır), aynı harfin başka hâliyle
  karıştırdıysa kuyruk (`EraseGame`) ya da "hiç değişmez".
- **Her yanlışta çıkmaz**: ısı ≥ 0.5 (tek hata yetmez) + aynı harf 30 dk,
  herhangi bir telafi 4 dk soğuma + seansta en fazla 3.
- Test/Flashcard'da hemen; OYUNLARDA ASLA ortada — `queueRemedy` ile
  kuyruğa alınır, `useRemedyOnGameOver` (ölünce/süre bitince) ya da
  Game.tsx unmount'ta (bitişi olmayan oyunlar) açılır.

### Oyun modları (`src/lib/gameMode.ts`)
- Varsayılan **süper** ("super"); kullanıcı Ayarlar'dan normale döner.
- Süper: her oyun cevabı SRS'e sayılır; ipucu halkası yalnız L1'de.
- Normal: eğlence — `recordGameAnswer` (src/lib/gameProgress.ts) her 3
  cevapta 1'ini sayar; Hafıza'da her 3 eşleşmede `InGameQuiz` (gerçek
  çoktan seçmeli, `recordInGameTest` her zaman sayar) çıkar; Balon/Koşu'da
  doğru cevapta ışık + ipucu halkası hep görünür.
- Topic Test + Flashcard recordSrsAnswer'ı doğrudan çağırır → hep sayılır;
  testte yanlış cevaplanan soru hemen tekrar sorulur (`retryIdRef`).

### Hoca Modu (`src/lib/students.ts`)
- Cihazda öğrenci profilleri; `setActiveStudentScope` (srs.ts) localStorage
  anahtarını `elifba-srs-{ns}-student-{id}-v1` yapar → seviye/kilit/ilerleme
  öğrenciye özel, geçişte kaldığı yerden. Öğrenci aktifken buluta YAZILMAZ.
- UI: `StudentSwitcher` (PageHeader + Index sağ üst), yönetim Ayarlar →
  Hoca Modu. Öğrenci yoksa düğme görünmez.

### Oyunlar
- 11 oyun `src/pages/games/`; kayıt: Game.tsx (route) + Games.tsx (liste,
  Kolay/Zor gruplu) + `SUPER_MODE_GAMES` (gameMode.ts) + Settings metni.
- "ElifBa Koşusu" (`SubwayGame.tsx`, id "subway"): R3F 3D koşu. Arapça
  harfler canvas dokusuyla (troika değil), pano dokusu ölçüp sığdırır
  (derin çanaklı harfler kesilmez), fog'dan muaf. Tasarım:
  `docs/tren-sorfu-tasarim.md`. rAF arka planda kısılır — DT_MAX kelepçesi var.
- Arapça glif + `leading-none` = taşma; `leading-[1.5+]` kullan ve cn()
  içinde leading'i text-* SONRASINA koy (tailwind-merge yutar).
- Grid'ler `dir="rtl"` (Arapça sağdan sola).

## Git / dağıtım
- Repo: kaptankare5/elif-buddy-spark; `main` = Lovable'ın da yazdığı canlı
  dal. Lovable araya commit atar — push öncesi `git fetch` + kontrol et.
- main'e gönderim yöntemi (kabul görmüş): yerelde commit →
  `git commit-tree HEAD^{tree} -p origin/main` ile ileri commit → push
  (force-push YOK, geçmiş korunur).
- gh CLI yok; PR gerekirse GitHub REST API + `git credential fill` token'ı.
- `.claude/` commit'lenmez. Commit mesajları Türkçe özet + madde.

## Kullanıcı tercihleri
- Türkçe iletişim; çocuk odaklı UI (büyük dokunma alanları, ses öncelikli);
  para kazanma yok (hasSuperMode=true sabit); gerçek ses kayıtlarına dokunma.
