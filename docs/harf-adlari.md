# Harf adlarının Türkçe yazımı — literatür taraması ve ölçüm

Bu belge tek bir soruyu cevaplıyor: **ekranda harfin adı nasıl yazılmalı?**
İki bağımsız kaynağa bakıldı — (1) Türkçedeki yerleşik yazımlar, (2) uygulamanın
kendi hoca kayıtlarının ÖLÇÜMÜ. İkisi çakışınca kayıt kazanır: çocuk sesi duyup
yazılı şıktan seçiyor, yazı ile ses ayrı şey söylerse soru ölçmek istediğini
ölçmez.

## 1. Türkçede iki ayrı gelenek var

Arapça harflerin Türkçe adlandırılmasında birbiriyle yarışan iki gelenek
bulunuyor ve ikisi de yaygın:

| | ط | ظ | خ | ح |
|---|---|---|---|---|
| **Elifbâ cüzü geleneği** (Diyanet Elif-Ba, Milliyet/Hürriyet elifbâ listeleri, tr.wikipedia "Hı (harf)") | tı | zı | hı | ha |
| **Arap alfabesi / dil öğretimi geleneği** (DİA "HARF" maddesi; Hürriyet, Sabah, CNN Türk "Arap alfabesi" listeleri) | **ta** (ṭâʾ) | **za** (ẓâʾ) | **ha** (ḫâʾ) | ha (ḥâʾ) |

DİA'nın *HARF* maddesi klasik adları şöyle sayıyor: “bâʾ, tâʾ, s̱âʾ, ḥâʾ, ḫâʾ,
râʾ, zây, **ṭâʾ**, **ẓâʾ**, fâʾ, hâʾ, yâʾ” — yani harf adı, harfin sesine
*elif-i memdûde* eklenerek kurulur ve **hepsi “a” ile biter**. “Tı/zı” yazımı
elifbâ cüzlerinin Türkçeleşmiş okuyuşu; yanlış değil ama tek doğru da değil.

Kullanıcının kuralı (“kalınlar sonu a ile bitecek, ra-ri-ru istisna”) ikinci
geleneğe denk düşüyor.

## 2. Ölçüm: hoca hangisini söylüyor?

Tartışmayı uygulamanın kendi kayıtları çözdü. `tools/ses/adlar.py` her harf
için, adın (`basic-NN.mp3`) ünlü çekirdeğini **aynı harfin harekeli
kayıtlarıyla** (`hareke-NN-fetha|esre|otre.mp3`) karşılaştırıyor. Ünsüz üç
referansta da aynı olduğu için fark yalnız ünlüden geliyor — formant kestirmeye
gerek kalmıyor.

Sonuç: **28 harfin 23'ü tutuyor.** د ve ن `ince` kovada olduğu için
referanslarında “a”/“u” yok, en yakın komşuya düşüyorlar (sahte uyuşmazlık).
Geriye üç GERÇEK uyuşmazlık kalıyor ve üçü de aynı yöne bakıyor:

| harf | ekranda yazıyordu | kayıt diyor | uzaklık | ikinci en yakın |
|---|---|---|---|---|
| ط | tı | **a** → “ta” | 0.084 | 0.213 |
| ظ | zı | **a** → “za” | 0.031 | 0.167 |
| خ | hı | **a** → “ha” | 0.138 | 0.397 |

Yöntemin körlemesine “fetha” demediğinin kanıtı, doğru bilinen harflerin
kontrolü: Cim → i, Sin → i, Şin → i, Mim → i, Nun → ü, Elif → i. Yöntem esre ve
ötreyi de buluyor.

## 3. Ne değişti, ne değişmedi

- **ط “Tı” → “Ta”**, **ظ “Zı” → “Za”** (ad, TTS okunuşu, yazılış hafıza
  kartları ve alıştırma kelimeleri). Hem literatürün ikinci geleneği hem de
  hocanın kaydı bunu söylüyor.
- **خ “Hı” KALDI.** Kayıt burada da “ha” diyor ama ح zaten “Ha”. İki harfe aynı
  adı yazmak, yazılı şık modlarında (Şimşek, Tabela, Kutu Boşalt) sorunun **iki
  doğru cevaplı** olması demek — doğru okuyan çocuk yanlış sayılır. Ekranda
  Diyanet Elif-Ba'nın adı olan “Hı” kalıyor; ayrım literatürde de zaten
  *hırıltılı ha* (خ) ↔ *boğaz hası* (ح) diye anlatılıyor.
- Kalan 25 ad zaten hem literatüre hem kayda uyuyordu: Elif, Be, Te, Se, Cim,
  Ha, Dal, Zel, Ra, Ze, Sin, Şin, Sad, Dad, Ayn, Ğayn, Fe, Gaf, Kef, Lem, Mim,
  Nun, Vev, He, Ye.

Bekçi: `src/test/harfAdlari.test.ts` (ad tablosu kilitli, ad tekrarı yasak,
kalın harfin adı “a” ünlüsü taşır, TTS ile yazı aynı ünlüyle biter).

## 4. Peltek harfler

Literatürde peltek harfler **ث (peltek se)**, **ذ (peltek zel)** ve **ظ (peltek
za)**: dil ucu üst dişlerin arasına hafifçe sıkıştırılarak çıkarılır. “Peltek”
bir **niteleme**, ad değil — Diyanet Elif-Ba dahil bütün listeler harfi kısaca
“se”, “zel”, “za” diye adlandırıyor. Uygulama da öyle yapıyor:

- Ad (şık metni, kart etiketi) kısa kalır: **Se · Zel · Za**. Yazılı şıkta
  “Peltek Se” gibi uzun bir etiket hem satıra sığmaz hem de okuma bilmeyen
  çocuk için gereksiz yük.
- Peltekliğin öğretileceği yer telaffuz/mahreç anlatımı, şık etiketi değil.

## 5. Ayn'ın kesme işareti (`a'` · `i'` · `u'`)

Sâkin (cezimli) ayn Türkçede **kesme işaretiyle** yazılır — bu uygulamanın
kendi ezber metinleri zaten böyle yazıyor:

> **na'büdü** · **neste'în** · **en'amte** · **e'ûzü** · **a'taynâkel**

Aynı kural elifbâ kartlarına da uygulandı: `اَعْ` = **a'**, `اِعْ` = **i'**,
`اُعْ` = **u'**, şeddeli `اَعَّ` = **a'a**. Yani karttaki işaret, Kevser'deki
“a'taynâ”daki işaretin ta kendisi; ayrı bir sembol değil.

Neden şart: ayn'ın Türkçede ünsüz karşılığı yok (`cons` boş). İşaret
kaldırılırsa cezimli ayn düz bir sesliye (“a”) dönüşür ve yazılı şıkta
elif/hemze kaynaklı kartlardan ayırt edilemez hâle gelir. Bilimsel yazımda
(İSAM/DİA) aynı ses `ʿ` ile gösteriliyor; halka açık Diyanet meâllerinde ve
elifbâ kitaplarında kesme işareti kullanılıyor — çocuk için ikincisi doğru
tercih.

## Kaynaklar

- TDV İslâm Ansiklopedisi, “HARF” maddesi — https://islamansiklopedisi.org.tr/harf--alfabe
- TDV İslâm Ansiklopedisi, “TRANSKRİPSİYON” — https://islamansiklopedisi.org.tr/transkripsiyon
- İSAM Türkçe Çeviri Yazı Kılavuzu — https://www.isam.org.tr/uploads/65b578535d55b.pdf
- Diyanet Elif-Ba 2024 — https://egitimhizmetleri.diyanet.gov.tr/Documents/Diyanet%20Elif-Ba%202024.pdf
- Hürriyet, “Arap alfabesi… yazılışı, okunuşu ve sırası” — https://www.hurriyet.com.tr/egitim/arap-alfabesi-nedir-kac-harf-ve-ozellikleri-nelerdir-arapca-alfabe-harfleri-yazilisi-okunusu-ve-sirasi-41747163
- Hürriyet, “Arapça'da kalın, ince ve peltek harfler” — https://www.hurriyet.com.tr/egitim/arapcada-kalin-ince-ve-peltek-harfler-okunuslari-konu-anlatimi-41948962
- Sabah, “Arap alfabesi nedir, özellikleri nelerdir?” — https://www.sabah.com.tr/egitim/arap-alfabesi-nedir-ozellikleri-nelerdir-arap-alfabesi-kac-harf-e1-5513880
- Milliyet, “Elif Ba harfleri… okunuşu” — https://www.milliyet.com.tr/ramazan/dini-bilgiler/elif-ba-harfleri-nelerdir-elif-ba-harfleri-okunusu-turkce-anlamlari-ve-arapca-yazilislari-6410933
- Vikipedi, “Hı (harf)” — https://tr.wikipedia.org/wiki/H%C4%B1_(harf)
- Diyanet, “Harflerin Doğru Telaffuzu” (mahreç notu) — https://webdosyasp.diyanet.gov.tr/muftuluk/UserFiles/van/Ilceler/muradiye/UserFiles/Files/Mahrec_aa426fe4-b1e5-4df7-85fd-c4f30d0d2f51.doc
