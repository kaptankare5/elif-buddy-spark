# Gelecek özellikler

Henüz yapılmayan, ama kararı verilmiş ya da konuşulmuş işler. Yapılınca
buradan silinip CLAUDE.md'ye geçer.

---

## 🔴 "ley" kartının sesi — hocanın GERÇEK kaydıyla değiştirilecek

**Durum: GEÇİCİ ÇÖZÜM YÜRÜRLÜKTE.** Kullanıcı kararı: *"şimdilik yap ama bir
ara hatırlat, onu hocanın gerçek sesiyle değiştirelim"*. Bu maddeyi silmek
için tek şart var: hocadan doğru bir **"ley" (لَيْ)** kaydı gelmesi.

### Sorun (ölçüldü)

Cezm konusunun Ekstralar bölümündeki `لَيْ` kartı — `cezm-ekstra-03.mp3` —
kullanıcının kulağına "liy" gibi geliyordu. Ölçüm doğruladı: dosyanın
TAMAMINDA **F1 = 231-306 Hz**, yani ünlü hiç açılmıyor. Aynı kayıttaki öteki
"e"li kelimeler **578-708 Hz**'e çıkıyor (men 649 · ye' 708 · lem 582 ·
yes 578). Yani hoca o kayıtta "ley" dememiş.

⚠️ Hiza denetlendi, mesele kesim/eşleme DEĞİL: 14 kelimenin 13'ünde beklenen
ünlü ölçümle tutuyor (bütün a'lar ve bütün i/ü/u'lar). Yalnız 3. kaydın
içeriği kartla uyuşmuyor.

### Şu an ne var

`tools/ses/birlestir.py` — hocanın KENDİ iki kaydından birleştirilmiş bir
"ley":

| parça | kaynak | aralık |
|---|---|---|
| `/l/` | `hareke-23-fetha.mp3` ("le" — Lem + üstün) | 0.060-0.278 |
| `"ey"` | `cezm-27-e.mp3` (Ye'nin cezimlisi) | 0.125-son |

30 ms eşit güçlü çapraz geçiş, −5.5 dB kazançla ekstra ailesinin seviyesine
(−24.4 dBFS) eşitlendi. Sonuç ölçüldü: **F1 tepe 577 Hz** (eski 306),
ek yerinde perde sıçraması yok (F0 133 → 137 → 140 Hz), tıkırtı yok.

### Neden kalıcı olmamalı

Ses **hocanın söylemediği** bir okuyuş; iki ayrı kaydın birleşimi ona
atfedilmiş oluyor. Uygulamanın ilkesi "gerçek hoca kayıtları"; burası o
ilkenin tek istisnası ve geçici olmak üzere kabul edildi.

**Değiştirince:** yeni kaydı `public/audio/elifba/cezm-ekstra-03.mp3` olarak
koy, `tools/ses/birlestir.py`'yi sil, bu maddeyi kaldır ve CLAUDE.md'deki
ilgili notu güncelle.

---

## 🎤 Sesli okuma denetimi — "harfi gör, SÖYLE"

**Durum:** yapılmadı. Kullanıcı isteği: *"harfi gör sonra ses ile söyleyerek
doğru mu yanlış mı"*.

### Neden bu özellik önemli — ölçülmüş bir boşluğu kapatıyor

Uygulamadaki bütün ölçüm **alımlama** (recognition) yönünde: *sesi duy →
harfi seç*. Elifbâ kitabı ise tam TERSİNİ ister: *harfi gör → SÖYLE*
(üretim / production). CLAUDE.md'deki kanıt kuru bölümünde bunun bedeli
yazılı — gerçek gözlem: **çocuk 1 saatte bütün harfleri L4 yaptı, kitaptan
sorulunca 2 harfi bilemedi.**

Şu an üretim kanıtı yalnız **Flashcard'ın kendi beyanına** dayanıyor
(`meta.selfReport` → `evidence: "production"`, 1 puan; alımlama ½ puan).
Yani çocuk "bildim" diyor, uygulama ona inanıyor. `AuditCard` (20 soruda bir
çıkan denetim kartı) bu beyanı yansız ölçmek için var ama **dolaylı**.

Sesli denetim bu zincirdeki tek eksik halka: beyanı değil, **gerçek üretimi**
ölçer.

### Nasıl çalışmalı

1. Kart harfi gösterir (`آ`, `بَ`, `هُمْ`…), **ses çalmaz** — cevabı vermek olur.
2. Çocuk mikrofona söyler.
3. Uygulama söyleneni harfin beklenen okunuşuyla karşılaştırır → doğru/yanlış.
4. Sonuç SRS'e `evidence: "production"` olarak yazılır (1 tam puan).

### ⚠️ Yaparken düşülecek tuzaklar

- **Tarayıcı konuşma tanıma Türkçe/Arapça hece tanımaz.** `webkitSpeechRecognition`
  KELİME sözlüğüne göre çalışıyor; "bâ", "hüm", "dâllîn" gibi heceleri en yakın
  Türkçe kelimeye çeviriyor ("bak", "hüm" → "hem"). Doğrudan metin
  karşılaştırması YANLIŞ ÖLÇER. Muhtemel çözüm: metin değil **ses benzerliği**
  — `tools/ses/parmakizi.py`'deki MFCC yöntemi zaten elimizde ve 667 kayıtla
  referansımız var. Çocuğun söylediğini hocanın kaydına benzetmek, kelime
  tanımaktan çok daha doğru olur.
- **Çocuk sesi ≠ yetişkin sesi.** Referans hocanın (yetişkin erkek) kaydı;
  çocuğun perdesi ~2 kat yüksek. MFCC'de kanal ortalaması çıkarma
  (cepstral mean normalization) bunu kısmen çözüyor — parmakizi.py'de zaten
  var, orada aynı sebeple eklenmişti.
- **Eşik kalibre edilmeli, tahmin edilmemeli.** `FlashKalibre` bileşeninin
  yaptığı gibi: çocuğun ZATEN BİLDİĞİ (L3+) birkaç harfle ölçüm yapılıp eşik
  kişiye göre belirlenmeli. Sabit eşik, sesi kısık ya da çekingen çocukta
  "hep yanlış" der.
- **Mikrofon izni reddedilirse özellik SESSİZCE kapanmalı**, uygulama
  çalışmaya devam etmeli. Capacitor'da ayrıca `RECORD_AUDIO` izni ve Play
  Store gizlilik beyanı gerekir — **ses kaydı cihazdan ÇIKMAMALI**, ölçüm
  yerelde yapılmalı (çocuk verisi).
- **Yanlış ölçüm SRS'i bozar.** Sesli denetim güvenilirliği kanıtlanana kadar
  `evidence: "production"` vermemeli; önce `AuditCard` gibi YANSIZ bir kanal
  olarak çalışıp ölçüm toplanmalı. Emin olmadan L5 dağıtmak, CLAUDE.md'de
  yazılı "yalan ustalık" sorununu geri getirir.
- **Şık sayısı kuralının karşılığı yok**: sesli cevapta şans payı ~0'dır,
  yani `sansPayi` tam puan vermeli. Ama bu, kuralın *aksi* yönde suistimale
  açık demek — çocuk rastgele mırıldanırsa "yanlış" sayılmalı, "sessiz"
  sayılmamalı. Sessizlik ile yanlış cevap AYRI ele alınmalı (kör cevap
  kuralının sesli karşılığı, bkz. `korCevapMi`).

### Nereye bağlanır

- Yeni bir soru yöntemi olarak: `askMode.ts` → `"soyle"` (klasik/flash/ustte/
  sesli/sekil'in yanına). Oyunlarda değil **önce Flashcard'da** denenmeli —
  aksiyon oyununda mikrofon beklemek akışı bozar.
- `AnswerMeta` → `evidence: "production"`, `optionCount: undefined`
  (şık yok).

---

## Küçük notlar

- **Capacitor kurulumu**: `android/` klasörü ve `@capacitor/core` henüz yok.
  Koddaki Capacitor parçaları (`CapacitorBackHandler`, `purchases.ts`) paket
  yoksa sessizce devre dışı kalıyor. Play Store'a çıkmadan önce kurulacak.
- **`asar-med-kasr` 8. kartı** (`حَآجُّوكَ`) kayıttan ölçümle çıkarıldı;
  kullanıcı onayı beklemede.
