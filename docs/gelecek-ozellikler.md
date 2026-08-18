# Gelecek özellikler

Henüz yapılmayan, ama kararı verilmiş ya da konuşulmuş işler. Yapılınca
buradan silinip CLAUDE.md'ye geçer.

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
