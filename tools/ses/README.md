# Hoca kayıtlarını kesme araçları

Hoca kayıtları **tek parça** geliyor (bir dosyada 28 harf ya da 84 hece arka
arkaya). Bu klasördeki üç betik onları uygulamanın beklediği tek tek mp3'lere
çeviriyor.

Kaynak: `github.com/kaptankare5/sound` → `Dünya 1. ses kuran/` (8 adet .m4a)

```
kes.py         sessizlikten böler; her dosya için BEKLENEN parça sayısını
               tutturan eşik/süre ikilisini arar → kesim.json
uret.py        kesim.json'a göre keser, uygulamanın dosya adlarını verir
               (mp3 · 44100 Hz · stereo · 192 kbps — mevcut dosyalarla aynı)
parmakizi.py   "bu parça hangi harfin sesi?" — MFCC parmak iziyle ÖLÇER
denetle.py     üzerine yazmadan önce sağlık denetimi (süre/sessizlik/kırpık)
```

Çalıştırma (ffmpeg + numpy gerekir):

```bash
cd tools/ses && python3 kes.py && python3 uret.py     # → yeni_sesler/ (471 dosya)
```

## ⚠️ Eşleme kuralları — ölçülerek doğrulandı

- **Bütün seriler ELİF'ten başlar** ve müfredat sırasında gider.
- Hareke / med / tenvin: 28 harf × (fetha, esre, ötre) = **84** parça,
  dosya numarası = harf numarası.
- **Cezm ve şedde kayıtları da 84** (Elif dahil) ama uygulama Elif'i
  kullanmıyor: `cezm-01` = Be, `sedde-01` = Be. Bu yüzden ilk 3 parça atlanır
  ve **dosya numarası harf numarasının bir eksiğidir**.
- Sıra tahmin edilmedi, **ölçüldü**: her parça mevcut kayıtlara MFCC parmak
  iziyle benzetildi. Kayma denetimi (`cezm`): ofset 0 → ortalama sıra 10.7,
  ofset ±1 → 30-31. Şedde'de Elif'li varsayım 11.5, Elif'siz 28.3.
  Yani sıralama doğru, üstelik bu kayıt mevcutlardan **AYRI BİR ÇEKİM**
  (aynı çekim olsaydı benzerlik 1.0 çıkardı).

## ⚠️ Tuzaklar

- **`silencedetect` bilimsel gösterim yazar** (`silence_start: 8.33333e-05`).
  Sade `[\d.]+` deseni üssü yutup 8.33 saniye sanıyordu → dosyanın başındaki
  sessizlik 8 saniyelik sahte bir parça oluyordu.
- **Şeddede eşik gevşek olmalı**: "ebbe" hecesinin ortasında (şeddede) duraklama
  var, `d=0.2` ile kelime ortadan ikiye bölünüyor (84 yerine 126 parça çıkıyor).
  `d=0.55-0.8` aralığında sonuç sabit: 84.
- **Hırıltılı ha'nın kuyruğu çok hafif**: -25 dB eşikle hırıltının kendisi
  kesiliyor (1.10 sn yerine 0.37 sn kalıyor). -45 dB gerekiyor.
- **Parmak izinde kanal ortalaması çıkarılmalı** (cepstral mean normalization);
  ham log-mel'de aynı kişinin bütün heceleri birbirine benziyor (farklı harfler
  0.95'e kadar çıkıyordu), ayrım yok oluyordu.

## Hangi aileler yenilendi

`hareke` `med` `tenvin` `cezm` `sedde` `basic` → **hepsi yeni çekim** (439 dosya).
⚠️ `basic` (harf adları) sonradan eklendi ve AYRI PARAMETRE ister: kesim eşiği
**-40 dB** (ötekilerde -25 dB sözün ilk hecesini kesiyordu) ve **+3.8 dB
kazanç** (ham kesim -26.8 dBFS ile bütün ailelerin altındaydı).
⚠️ `basic-uzun` (28 uzatmalı harf adı) **eklenmeyecek — bir daha da eklenmesin**
(kullanıcı kararı): uzatmayı zaten **7. konu (Med Harfleri)** öğretiyor, orada
84 kayıt var. Harf adını bir de uzatmalı okutmak aynı şeyi ikinci kez, üstelik
konu dışında öğretmek olurdu. `ha-hiriltili` de aynı sebeple dışarıda: karşılık
gelen bir kart yok.

Ölçüm: bütün aileler −20.9…−25.5 dBFS aralığında (4.6 dB), `basic` −24.2.
Eski `sedde` −31.9 idi, yani **11 dB kısıktı** — oyunda o kartlara gelince ses
düşüyordu; yeni sette bu kalktı.
