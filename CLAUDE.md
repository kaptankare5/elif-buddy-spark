# Elifbâ (elif-buddy-spark)

Çocuklara Kur'an harflerini öğreten React uygulaması. Vite + React 18 + TS +
Tailwind + shadcn + Supabase (Lovable ile oluşturuldu). Dev: `npm run dev`
(port 8080, `.claude/launch.json` var).

**DOĞRULAMA — dikkat:** `npx tsc --noEmit` HİÇBİR ŞEYİ denetlemez! Kök
`tsconfig.json` `"files": []` + yalnız project reference içeriyor, o yüzden
sessizce boş geçer. Doğrusu: **`npx tsc -p tsconfig.app.json --noEmit`**
(+ `npx eslint src/` + `npx vitest run`). Bilinen 4 hata Lovable'ın
`src/lib/mcp/` dosyalarında (`@lovable.dev/mcp-js` paketi kurulu değil) —
bizim değil, sayı 4'ün üstüne çıkarsa yeni hata var demektir.

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
  harfler aynı bölümde ama bölümler EN FAZLA 3 harf — orada bir harf ÜÇ yeni
  şekil demek, 4 harflik bölüm 12 yeni şekle çıkıyordu (13 bölüm: ا ك ل ·
  ب ت ث · ج ح خ · د ذ · ر ز · س ش · ص ض · ط ظ · ع غ · ف ق · م ه · ن ي · و).
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
  testte yanlış cevaplanan soru bir kez tekrar sorulur (questionSource.ts).

### Hoca Modu (`src/lib/students.ts`)
- Cihazda öğrenci profilleri; `setActiveStudentScope` (srs.ts) localStorage
  anahtarını `elifba-srs-{ns}-student-{id}-v1` yapar → seviye/kilit/ilerleme
  öğrenciye özel, geçişte kaldığı yerden. Öğrenci aktifken buluta YAZILMAZ.
- UI: `StudentSwitcher` (PageHeader + Index sağ üst), yönetim Ayarlar →
  Hoca Modu. Öğrenci yoksa düğme görünmez.

### Oyunlar
- 13 oyun `src/pages/games/`; kayıt: Game.tsx (route) + Games.tsx (liste,
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
- "ElifBa Koşusu" (`SubwayGame.tsx`, id "subway"): R3F 3D koşu. Arapça
  harfler canvas dokusuyla (troika değil), pano dokusu ölçüp sığdırır
  (derin çanaklı harfler kesilmez), fog'dan muaf. Tasarım:
  `docs/tren-sorfu-tasarim.md`. rAF arka planda kısılır — DT_MAX kelepçesi var.
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
  - Sürücü ANIMAL CROSSING oranlarında ve YUVARLAK parçalardan (küre/kapsül/
    torus): büyük kafa, çizilmiş sevimli yüz, AÇIK kask (kapalı vizör camı
    YOK — küre "kuşağı" kaskın çevresini sardığı için arkadan bakınca cam
    çocuğa dönük görünüp sürücü geri bakıyor sanılıyordu), kulaklık + ponpon
    (kamera hep arkada, sevimlilik arkadan okunmalı), tulum aracın AÇIK tonu
    (aynı renk olunca gövde kaportaya karışıyor).
  - Yolun iki yanında beyaz KENAR ÇİZGİSİ (asfalt/kerb sınırı) — hız yaparken
    pistin sınırı yoksa okunmuyor.
  - `_letterTexture.ts` ortak: harf panosu / isim etiketi / sevimli yüz /
    emoji dokusu. Partisi de bunu kullanır — harfi panoya sığdırma ve yüz
    çizimi tek yerde.
- **Soru sesi kapı başına TEK KEZ** çalar (Partisi ve Yarışı) — otomatik
  tekrar YOK; kullanıcı şartı: aynı soruyu iki kez sormak (biri uzakta, biri
  kapıya yakın) rahatsız ediyor. Tekrar dinlemek "Hangi kapı? — dinle"
  bandına dokunmakla olur.
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
