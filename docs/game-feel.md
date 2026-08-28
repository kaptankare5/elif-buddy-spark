# Oyun hissi (game feel) — tür tür araştırma ve uygulama

Bu belge iki soruyu cevaplıyor: **(1) her oyunumuz hangi oyuna benziyor**,
**(2) o türün "hissini" veren imza teknikler neler ve bizde hangileri var.**

Yöntem: önce kodun kendisinden mekanik çıkarıldı (tür tahmini değil, sabitler
ve döngüler okundu), sonra o tür için akademik ve uygulamacı kaynaklar tarandı,
sonra eksikler uygulandı. Uygulanmayanlar da gerekçesiyle yazılı — bir tekniği
"kopyalamamak" bazen doğru karardır (aşağıda *bilerek alınmadı* başlıkları).

---

## 0. Ortak çerçeve

Pichlmair & Johansen'in *Designing Game Feel: A Survey* (IEEE ToG, 200+ kaynak
taraması) üç alan ayırıyor — bu belge de o düzeni izliyor:

| alan | ne yapar | cilası |
|---|---|---|
| **Fiziksellik** (physicality) | nesnenin ağırlığı, ivmesi, çarpışması | **ayar** (tuning) |
| **Yükseltme** (amplification) | olayın önemini duyurmak | **sululuk** (juicing) |
| **Destek** (support) | oyuncunun önündeki sürtünmeyi kaldırmak | **sadeleştirme** (streamlining) |

⚠️ Bizim ilk turumuz neredeyse tamamen **yükseltme** idi (sarsıntı, donma,
ezilme). İkinci tur asıl kazancı **fiziksellik** ve **destek** alanlarında
buldu: yılanın kayması, taşların düşmesi, dokunma gecikmesi, iOS'ta hiç
çalışmayan titreşim.

Uygulamacı kaynakları: Nijman/Vlambeer *The Art of Screenshake* (donma karesi
60-80 ms, namlu parlaması, geri tepme, kalıcılık, kamera gecikmesi), Jonasson &
Purho *Juice it or lose it* (ezilme-uzama, aşımlı yumuşatma, parçacık),
Eiserloh *Juicing Your Cameras* (travma modeli: sarsıntı = travma²), Swink
*Game Feel*, Mark Brown *Secrets of Game Feel and Juice*.

### Bu uygulamaya özgü üç kısıt

1. **Müzik yok** (audio.ts kuralı). Türün gerilimi müzikten geliyorsa
   (Kahoot'un geri sayım müziği gibi) karşılığı tek atımlık bildirim tonu
   olmalı — melodi değil.
2. **Kullanıcı 5-8 yaşında.** Çocuk UX literatürü "anında tepki", "büyük
   dokunma alanı", "cömert tolerans" diyor. Bu, ustalık isteyen bazı tür
   tekniklerini (Mario'nun kayganlığı gibi) DIŞARIDA bırakmayı gerektiriyor.
3. **Capacitor ile mağazaya çıkacak.** Dokunma gecikmesi, haptik ve WebView
   kare bütçesi birinci sınıf tasarım konusu — masaüstünde görünmeyen
   sorunlar orada birinci derecede hissediliyor.

---

## 1. Elif Ba Macerası → **Super Mario Bros / Celeste**

2B yandan kaydırmalı platform. `RUN_SPEED 200`, `GRAVITY 1900`, `JUMP_V -660`.

**Türün imza teknikleri ve durumumuz**

| teknik | kaynak | durum |
|---|---|---|
| sekmeli zaman (coyote, ~100 ms) | Celeste *Forgiveness* | ✅ 0.1 sn |
| zıplama tamponu (~150 ms) | Celeste | ✅ 0.12 sn |
| değişken zıplama yüksekliği (tuş bırakınca kes) | SMB | ✅ `JUMP_CUT` |
| **tepede yarım yerçekimi** | Celeste: "tuşu basılı tutarsan tepede yerçekimi yarıya iner" | ✅ 0.55× |
| **inişte 1.5-2.5× yerçekimi** | SMB ~2×, Celeste ~2.5× | ✅ 2.0× |
| iniş ezilmesi + toz | *Juice it or lose it* | ✅ |
| kamera bakış payı | Swink | ✅ damp'lı ±30 px |
| donma karesi (hasar / dönüşüm) | Vlambeer 60-80 ms | ✅ 70 / 45 ms |
| köşe düzeltmesi (kafa çarpınca yana kaydır) | Celeste | ✅ zaten var (yatay itme) |
| **zıplama yüksekliği koşu hızıyla artar** | SMB | ❌ *bilerek alınmadı* |
| **momentum/kayganlık** (düşük ivme, düşük hava kontrolü) | SMB | ❌ *bilerek alınmadı* |

⚠️ **Bilerek alınmadı — gerekçe:** SMB'nin kayganlığı oyunun ustalık tavanını
yükseltiyor; "yön değiştirmek zaman alır" kuralı 6 yaşındaki çocuk için ceza.
Bizde yön değişimi anında; bu bir eksiklik değil, hedef kitle kararı. Zıplamayı
koşu hızına bağlamak da anlamsız: `mv` yalnız -1/0/1, gerçek bir koşu hızı
değişkeni yok.

⚠️ **Zıplama yayı ölçülerek değiştirildi** (`tools/perf/zipla.mjs`) — bölüm
tasarımı bloklara ve uçurumlara göre kurulu, körlemesine yerçekimi değiştirmek
bölümleri geçilemez yapabilirdi:

| | eski | yeni |
|---|---|---|
| tepe | 113.3 px | 116.9 (+%3.2) |
| havada kalma | 0.692 sn | 0.737 (+%6.6) |
| yatay atlama | 173 px | 184 (+%6.6) |
| tepede asılı kalma | 0.138 sn | 0.250 (+%81) |

Üçü de büyüdü → hiçbir blok ulaşılmaz, hiçbir uçurum geçilmez olmadı.

---

## 2. ElifBa Koşusu → **Subway Surfers / Temple Run**

3 şeritli 3B sonsuz koşu (R3F). `BASE_SPEED 13 → MAX_SPEED 24`.

Tür analizlerinin ortak tespiti: bu türde **her şey tepkisellik ve ritim**;
"kaydırma anında karşılık bulmalı", "hız hissi sürekli artmalı".

| teknik | durum |
|---|---|
| **hıza bağlı görüş açısı (FOV)** | ✅ 64° → 73° |
| çarpmada FOV büzülmesi | ✅ travmadan türetiliyor |
| travma tabanlı kamera sarsıntısı (yalnız ÇARPMADA) | ✅ |
| **kenar hız çizgileri** | ✅ |
| karakterin yatışı + dönüşü + esnemesi | ✅ |
| şerit değişimi / zıplama / kayma sesi | ✅ |
| kameranın şeridi takibi | ❌ **KALDIRILDI** |
| kamera yatışı (roll) | ❌ **KALDIRILDI** |

### ⚠️ Kamera oyuncuyu YANAL TAKİP ETMEZ ve ASLA YATMAZ

Bir dönem kamera oyuncunun x'ini %22 takip ediyor ve şerit değişiminde hafifçe
yatıyordu. Kullanıcı tespiti: *"sağa sola giderken kameranın sağa sola oynaması
gözü çok yoruyor."* İkisi de ayrı ayrı yanlıştı:

- **Sabit referansın kaybı.** Göz, hareketi sahnedeki durağan bir referansa
  tutunarak çözüyor; kaynakların ortak tavsiyesi "beynin, kamera ne kadar
  savrulursa savrulsun HAREKET ETMEYEN bir referans noktasına ihtiyacı var".
  Kamera sürekli kayınca o referans yok oluyor ve göz her şerit değişiminde
  yeniden odaklanıyor.
- **Ufuk eğilmesi (roll) en pahalı eksen.** Eksen çalışmaları, sensör
  çakışmasının simüle edilen hareketin KARMAŞIKLIĞIYLA arttığını, pitch'e roll
  eklenmesinin bulantıyı belirgin biçimde büyüttüğünü gösteriyor.

**Yerine ne kondu** (hepsi kamerayı oynatmadan):

1. **Karakterin kendi yatışı** — koşucu viraja yatar gibi eğilir (eskisinin
   ~2.5 katı). Ufuk düz kaldığı için göz yorulmuyor, hareket yine okunuyor.
2. **Gövde dönüşü (yaw)** — sırf yatmak "devriliyor" gibi duruyordu; dönüşle
   birlikte "kayıyor" oluyor.
3. **Yanal esneme** — yanal hız arttıkça gövde hareket yönünde uzuyor (hacim
   korunur): klasik hareket lekesi hilesi.
4. **Kenar hız çizgileri** — hız hissinin kamerasız klasik çözümü. ⚠️ Yalnız
   sol %0-16 ve sağ %84-100'de: ortada trenler ve harf panoları var, oraya
   çizgi koymak soruyu okunmaz yapar. Saf CSS + DOM katmanı — 3B sahneye tek
   çizim çağrısı bile eklemiyor. Şeffaflık hızla ölçekleniyor ve `setInterval`
   ile DOM'a doğrudan yazılıyor (state'e bağlamak saniyede 60 render olurdu).
5. **Hareketin sesi** — şerit değişimi, zıplama ve kayma sessizdi; oyunun üç
   temel eylemi hiçbir geri bildirim vermiyordu. ⚠️ Şerit değişimi TİTREŞMEZ
   (saniyede birkaç kez yapılan hareket).

**Kalan tek kamera hareketi ÇARPMA sarsıntısı** — kullanıcı onu beğendi
("çarpınca ekran değiştirmesi güzel") ve gerçek bir olaya bağlı, sürekli
değil. Onun bile **dönme bileşeni sıfırlandı** (Partisi ve Yarışı'nda da):
sarsıntının görülen kısmı kaymadır, dönme az katkı çok maliyet.

Bekçi: `gameFeelKapsam.test.ts` → "kamera konforu".

---

## 3. Elifbâ Partisi → **Fall Guys**

3B engel parkuru, 5 bot, çekiç/sarkaç/silindir/çamur.

Mediatonic'in kendi ifadesi: *"karakterin paçavralığını (ragdoll-ness)
kaybedersen mizahı kaybedersin"* ve *"düşmek komiktir"* — yani bu türde
**çarpma bir ceza değil, ödüldür**; okunaklı ve komik olmalı.

| teknik | durum |
|---|---|
| takla animasyonu (gövde döner, uzuvlar savrulur) | ✅ zaten vardı |
| **çarpma anında ezilme** (ilk 0.16 sn geniş+basık) | ✅ yeni |
| kamera sarsıntısı + FOV darbesi | ✅ yeni |
| takla sonrası dokunulmazlık, yanıp sönerek gösterilir | ✅ zaten vardı |
| hıza bağlı FOV (roket açar, çamur kapatır) | ✅ yeni |

---

## 4. Elifbâ Yarışı → **Mario Kart**

Spline pist, viraj, çim cezası, tek slotlu güçler.

MK'nin hız hissi reçetesi: **FOV genişlemesi + kameranın geri çekilmesi +
sarsıntı + drift kıvılcımı**.

| teknik | durum |
|---|---|
| hıza bağlı FOV | ✅ zaten vardı (`62 + v*0.12`) |
| turboda ek FOV | ✅ zaten vardı (+10°) |
| kamera hıza göre geri çekilir | ✅ zaten vardı (`13 + v*0.14`) |
| drift kıvılcımları | ✅ zaten vardı |
| **muza basınca / turboda kamera sarsıntısı** | ✅ yeni |
| **çarpmada FOV büzülmesi** | ✅ yeni |
| drift şarjının renk kademesi (mavi→turuncu→mor) | ❌ *bilerek alınmadı* |

⚠️ **Bilerek alınmadı:** MK'de kıvılcım rengi bir ÖDÜL kademesini haber verir
(mini-turbo). Bizde drift boost mekaniği yok; kademeli kıvılcım hiçbir şey vaat
etmeyen bir yalan olurdu. Kıvılcım "hızlı viraj alıyorsun" demeye devam ediyor,
o doğru.

### ⚠️ Ön tekerlekler: "havadaymış gibi" (kullanıcı tespiti)

MK'de aracın tekerleği türün İMZASIDIR — kamera hep arkada olduğu için çocuğun
en çok baktığı hareketli parça odur. Bizde iki ayrı kusur aynı görüntüyü
veriyordu; payları `tools/perf/teker.mjs` ile ölçüldü (tam savrulmada):

```
ESKİ  aks eğimi en çok 35.5° · ortalama 16.4°  | yerden açıklık 0.373 (yarıçapın %60'ı)
YENİ  aks eğimi en çok  0.0°                   | yerden açıklık 0.000
```

1. **Gövde eğimi tekerleği de yatırıyordu.** Gerçek araçta gövde süspansiyon
   üzerinde yatar, lastik yerde kalır (oyun tarafında bunun karşılığı, gövde
   kabuğunu tekerlek düğümünden AYIRMAK — ray-cast araç kurulumlarının
   "chassis float, wheels planted" düzeni). Eğim artık `shell` düğümünde.
2. **Yuvarlanma (X) ile direksiyon (Y) aynı Euler'deydi.** three.js "XYZ"
   sırasında matris Rx·Ry olur: sürekli büyüyen yuvarlanma açısı direksiyon
   EKSENİNİ deviriyordu. Unity forumlarında bu tam olarak kayıtlı bir tuzak —
   "arka tekerlekler düzgün dönüyor, ÖN tekerlekler bozuluyor, çünkü onlar
   ayrıca direksiyona da çevriliyor". Çözüm her yerde aynı: **iki ayrı düğüm**
   (ya da kuaterniyon çarpımı), göbek yalnız direksiyonu, tekerlek yalnız
   yuvarlanmayı döndürür.

| teknik | durum |
|---|---|
| direksiyon ve yuvarlanma ayrı düğümde | ✅ yeni |
| gövde yatar, tekerlek yerde kalır | ✅ yeni |
| **Ackermann** (iç teker dıştan çok döner) | ✅ yeni |
| pistin kavisi tekerleğe yansır (δ = atan(L·κ)) | ✅ yeni |
| sürücünün elindeki direksiyon döner | ✅ yeni |
| jant deseni + strobe kelepçesi | ✅ yeni |
| süspansiyon çökmesi / burun dalması | ❌ *bilerek alınmadı* |

⚠️ **Bilerek alınmadı:** gerçek süspansiyon çökmesi (hızlanmada arka oturur,
frende burun dalar) her tekerlek için ayrı yay-sönüm ister; bizim fizik
modelimiz yanal KAYMA üzerine kurulu, ivme eğrisi otomatik gaz tarafından
sürülüyor. Sahte bir çökme, olmayan bir şeyi haber veren bir yalan olurdu —
kıvılcım renk kademesiyle aynı gerekçe.

⚠️ **Jant deseni bir SÜS DEĞİL, ölçüm aracı**: lastik de göbek de düz silindir,
yani dönme eksenine göre tam simetrik. Desen olmadan yuvarlanma animasyonu
ekranda HİÇ görünmüyor (kod her karede döndürüyor, göz hiçbir şey görmüyor).
Desen gelince strobe (wagon-wheel) sınırı devreye girer: `n` kollu göbek karede
π/n'den fazla dönerse tekerlek geriye dönüyormuş gibi görünür. Görsel açısal
hız `π/(n·dt)` ile kelepçelendi — dt'ye bağlı olduğu için 30 fps'lik cihazda
kendiliğinden daha sıkı.

---

## 5. Uçan Kuş → **Flappy Bird**

Tür analizleri: tek mekanik, **anında yeniden başlama**, ve kuşun hıza bağlı
dönüşü (imza hareket).

| teknik | durum |
|---|---|
| hıza bağlı dönüş (-30°…+60°) | ✅ zaten vardı |
| **çırpış ezilmesi** (dikey uzayıp yerine oturur) | ✅ yeni |
| **puan izi ("+1" kuşun yanında yükselir)** | ✅ yeni — Vlambeer'in "kalıcılık" maddesi |
| çarpmada sarsıntı | ✅ yeni |

⚠️ **Anında yeniden başlama** kısmen alındı: bitiş kartı duruyor çünkü rekor ve
seri bilgisi (kalıcılık katmanı) çocuk için ödülün kendisi. Kart üzerindeki
tekrar düğmesi tek dokunuş.

---

## 6. Yılan Oyunu → **Snake (Nokia) / Slither.io**

⚠️ **Bu turun en büyük kazancı burada.** Modern Snake yeniden yapımlarının
hepsinde ortak tespit: **ızgara yalnız MANTIKTIR, gövde kareler ARASINDA
yumuşatılır**. Bizde gövde her tıkta bir kare ışınlanıyordu.

| teknik | durum |
|---|---|
| **kareler arası kayma** | ✅ yeni — `transform` geçişi, süre tık süresiyle aynı |
| yeme nabzı (baş bir kez şişer) | ✅ yeni |
| çarpmada sarsıntı | ✅ yeni |

⚠️ İki tuzak: (1) kayma `left/top` ile yapılırsa her karede yeniden yerleşim
tetikliyor — yüzdesel `translate` elemanın KENDİ kutusuna göre çalıştığı ve bir
hücre tam bir kutu olduğu için `x*100%` doğrudan hücre numarası oluyor.
(2) Geçiş süresi tık süresiyle **aynı kaynaktan** gelmeli; ayrı hesaplanırsa
yılan ya duruyor ya lastik gibi geriliyor (hız rampası ilerledikçe fark büyüyor).

---

## 7. Uzay Savaşı → **Space Invaders / Galaga**

Sabit nişancı; düşmanlar yukarıdan iner.

Vlambeer'in listesi bu tür için yazılmış gibi: **namlu parlaması, geri tepme,
vuruş efekti, kalıcılık, sarsıntı**.

| teknik | durum |
|---|---|
| **namlu parlaması** (geminin burnunda bir karelik ışık) | ✅ yeni |
| **geri tepme** (gemi atışta geri çöküp yaylanır) | ✅ yeni |
| çarpmada sarsıntı | ✅ yeni |
| vuruş "pop"u | ✅ zaten vardı (`pops`) |

---

## 8. Üçlü Eşleştir → **Candy Crush / Bejeweled**

Takas tabanlı match-3, zincir (cascade) çözümlü.

| teknik | durum |
|---|---|
| grup patlamadan önce vurgulanır | ✅ zaten vardı |
| zincir derinleştikçe ses tizleşir | ✅ zaten vardı |
| **zincir rozeti (⛓️ ×N, zincirle büyür)** | ✅ yeni |
| derin zincirde tahta sarsılır | ✅ yeni |
| **düşen taşlar — SATIR SATIR KADEMELİ gecikme** | ✅ yeni |

⚠️ Kademe şart: tür kaynaklarının ortak tespiti "taşları aynı anda düşürmek
sarsak görünüyor, gecikmeleri kademelendirmek düzeltiyor". Bizde gecikme
ALTTAN yukarı artıyor (aşağıdaki taş önce oturur — gerçek yerçekimi sırası).

---

## 9. Üçlü Eşle → **Triple Tile / Tile Master 3D / "Sheep a Sheep"**

7 slotlu tepsi; 3 aynısı patlar. Türün gerilimi **tepsinin dolmasıdır**.

| teknik | durum |
|---|---|
| tepsi doluluğu gerilim kaynağı | ✅ mekanikte var |
| eşleşmede pop + ses | ✅ |
| kaybetmede sarsıntı | ✅ yeni |
| **taşın tepsiye uçması** | ❌ sıradaki iş (bkz. aşağıda) |

---

## 10. Hafıza Kartları → **Concentration / Memory**

| teknik | durum |
|---|---|
| **eşleşme "pop"u** | ✅ yeni — eskiden eşleşen çift sessizce solup gidiyordu |
| **ıska sarsıntısı (HAFİF)** | ✅ yeni |
| basılma tepkisi | ✅ yeni |

⚠️ Iska geri bildirimi bilerek hafif: burada ıska KONUMU unutmaktır, harfi
bilmemek değil — sert geri bildirim yanlış ders verir (SRS kuralıyla aynı
gerekçe: ıska SRS'e yazılmıyor).

---

## 11. Balon Patlatma → **balon/bubble-pop (kaz tırnaklı "tap target")**

Tür kaynaklarının ortak tespiti: patlama **orijinalinden BÜYÜK** olmalı.

| teknik | durum |
|---|---|
| **balon şişerek patlar** (`scale-150` + saydamlaşma) | ✅ yeni — eskiden sadece `opacity-0` idi |
| **patlama halkası** (arkasında iz bırakır) | ✅ yeni |
| basılma tepkisi (`active:scale-90`) | ✅ yeni |
| ıskada sarsıntı | ✅ yeni |

---

## 12. Kutu Boşalt → **Toon Blast / kutu temizleme**

| teknik | durum |
|---|---|
| **boşalan kutu küçülerek patlar** | ✅ yeni — eskiden `opacity-0` ile bir anda yok oluyordu |
| yanlışta kırmızı pop | ✅ zaten vardı |
| yanlışta tahta sarsıntısı | ✅ yeni |

---

## 13. Yapboz → **jigsaw / parça takası**

Tür kaynaklarının ortak tespiti: **oturan parçanın "klik"i** oyunun tek hazzı.

| teknik | durum |
|---|---|
| **doğru yerine oturan parça "pop" yapar** | ✅ yeni — eskiden yalnız "bitti" vardı |
| basılma tepkisi | ✅ yeni |
| `pointerdown` ile anında takas | ✅ yeni |

---

## 14. Hızlı Quiz → **Kahoot / Trivia**

Kahoot'un gerilimi büyük ölçüde **geri sayım müziğinden** gelir. Bizde müzik
yok; karşılığı:

| teknik | durum |
|---|---|
| **son 10 sn'de sayaç kızarır ve her saniye atar** | ✅ yeni |
| **son 5 sn'de saniyede bir "tık"** (tek atımlık ton, gittikçe tiz) | ✅ yeni |
| seri çarpanı rozeti | ✅ zaten vardı |
| yanlış şıkta sarsıntı | ✅ zaten vardı |

---

## 15. İki Yol Koşusu — **KALDIRILDI**

Kullanıcı isteğiyle oyun ve bütün verileri silindi (bkz. `oyunSonucu.ts`
içindeki `KALDIRILAN`). Numara, sonraki bölümlerin yeri kaymasın diye
duruyor. Koşu türünü Subway Surfers tarzı **ElifBa Koşusu** (2. bölüm)
temsil ediyor — o duruyor.

---

## 16. MOBİL / CAPACITOR — türden bağımsız katman

⚠️ **Bu bölüm masaüstünde görünmez ama telefonda oyunun yarısıdır.**

### 16.1 Dokunma gecikmesi: `click` parmağın KALKMASINI bekler

Ölçüm: oyun dosyalarında **69 `onClick`**'e karşı **19 `onPointerDown`**;
dokunmayla oynanan oyunların (Hafıza, Yapboz, Match3, Üçlü Eşle) hiçbirinde
`pointerdown` yoktu. `click`, `pointerdown` + `pointerup` + tarayıcının hareket
ayrıştırması demek — yani geri bildirim çocuk parmağını KALDIRANA kadar
gecikiyordu.

Çözüm iki kademeli, çünkü bu uygulamada çoğu dokunuş bir **cevaptır**:

- **Cevap sayılmayan dokunuşlar** (kart çevirme, taş seçme, parça takası) →
  `onPointerDown`. Yanlışlıkla dokunmanın SRS bedeli yok.
- **Cevap sayılan dokunuşlar** (balon, kutu, quiz şıkkı) → commit `click`te
  KALDI (kaydırırken kazara cevap verilmesin), ama hepsine `active:` basılma
  tepkisi eklendi. `:active` parmak DEĞDİĞİ an tetiklenir, JS beklemez —
  yani çocuk anında tepki görür, cevap yine bilinçli kalır.

Not: `index.html` viewport'unda `user-scalable=no` var, yani eski 300 ms
çift-dokunma gecikmesi zaten yok; kalan gecikme tamamen "parmak kalkma" payı.

### 16.2 iOS'ta titreşim HİÇ ÇALIŞMIYORDU

`navigator.vibrate` iOS Safari ve iOS WebView'de **yok**. Yani bütün dokunsal
geri bildirim katmanı iPhone'da sessizce kayboluyordu. Android'de çalışıyordu
ama şiddet ayrımı olmadan.

Çözüm katmanlı (`src/lib/titresim.ts`):
1. Capacitor + Haptics eklentisi varsa → Taptic Engine / Android
   HapticFeedback (`impact` LIGHT/MEDIUM/HEAVY, `notification` SUCCESS/ERROR).
2. Yoksa → `navigator.vibrate` desenleri (bugünkü davranış).
3. O da yoksa → sessizce hiçbir şey.

⚠️ **npm bağımlılığı eklenmedi**: eklenti native tarafta kayıtlıysa Capacitor
onu `window.Capacitor.Plugins.Haptics` altında yayımlıyor — `purchases.ts` ve
`CapacitorBackHandler` ile aynı desen. Paket kurulu değilken kod 2. katmana
düşüyor, derleme bozulmuyor. Çağrı `void`: haptik sözünü beklemek kare süresine
native köprü gecikmesi bindirir.

### 16.3 Hareket duyarlılığı (`prefers-reduced-motion`)

Benzetim baş dönmesi insanların üçte birine kadarını etkiliyor; sarsıntı ve
**FOV oynaması** bilinen tetikleyiciler (Xbox erişilebilirlik kılavuzu FOV
ayarını doğrudan sayıyor). Bu bir çocuk uygulaması olduğu için:

- `hareketKatsayisi()` → cihaz "hareketi azalt" diyorsa **0.25**.
- Travma sarsıntısının genliği, üç 3B oyunun FOV oynaması ve DOM sarsıntısı
  bu katsayıyla kısılıyor. Geri bildirim kaybolmuyor, genliği iniyor.

---

## Sıradaki işler (yapılmadı, kararı verildi)

- **Üçlü Eşle**: seçilen taşın tepsi slotuna UÇMASI. Türün imza hareketi;
  taşların mutlak konumlandırmaya geçmesini gerektiriyor.
- **Match3**: takas hareketinin kendisi de animasyonlu olmalı (şu an takas
  anında iki hücre içerik değiştiriyor).
- **Koşusu/Yarışı**: yüksek hızda ekran kenarı hız çizgileri.
- Capacitor paketi kurulunca `@capacitor/haptics`'in native tarafta
  kayıtlı olduğunu doğrula (kod hazır, eklenti bekliyor).

## Kaynaklar

Platform türü: [Celeste & Forgiveness (Maddy Thorson)](https://www.maddymakesgames.com/articles/celeste_and_forgiveness/index.html) ·
[2D Platformer game feel tips](https://anchitsh.github.io/platformer.html) ·
[What Makes Jump Mechanics Feel Responsive](https://www.mygamedesign.com/what-makes-jump-mechanics-feel-responsive-and-satisfying/) ·
[Super Mario World Physics](https://blog.hamaluik.ca/posts/super-mario-world-physics/)

Genel game feel: [The Art of Screenshake — Jan Willem Nijman](https://www.youtube.com/watch?v=SkgkIXZ_13Y) ·
[Vlambeer Scale of Quality](https://designoriented.net/blog/2015/05/18/2015518vlambeer-scale-of-quality/) ·
[Explosions in Vlambeer's Nuclear Throne](https://ctrl500.com/game-design/explosions-in-vlambeers-nuclear-throne/) ·
[GMTK — Secrets of Game Feel and Juice](https://www.youtube.com/watch?v=216_5nu4aVQ) ·
[Designing Game Feel: A Survey (Pichlmair & Johansen)](https://arxiv.org/abs/2011.09201) ·
[Game feel on the web: squash, shake, and the art of juice](https://valdemird.com/blog/game-feel-on-the-web/) ·
[How to Make Your Game Feel Good](https://egmatic.com/blog/how-to-make-your-game-feel-good)

Tür tür: [Subway Surfers: a Gameplay Analysis](https://gameworldobserver.com/2016/06/24/subway-surfers-gameplay-analysis) ·
[Fall Guys — Mediatonic ragdoll tasarımı](https://devtrackers.gg/fall-guys/p/cc8ce382-when-is-mediatonic-ever-gonna-fix-the-physics) ·
[Mario Kart 8 Deluxe Drifting Guide](https://www.nintendolife.com/guides/mario-kart-8-deluxe-drifting-guide-how-to-drift-slipstream-and-boost) ·
[Mini-Turbo (Mario Kart Wiki)](https://mariokart.fandom.com/wiki/Mini-Turbo) ·
[Game Design Analysis of Flappy Bird](https://medium.com/@thomaspalef/game-design-analysis-of-flappy-bird-and-swing-copters-5c6df9fc10f0) ·
[Flappy Bird and the eight secrets to optimal gameplay](https://theconversation.com/flappy-bird-and-the-eight-secrets-to-optimal-gameplay-25603) ·
[Snake Ultimate — Smooth Movement](https://www.gamedeveloper.com/design/snake-ultimate---dev-blog-1---smooth-movement-in-unity3d) ·
[Flutter Crush — match-3 kademeli düşüş](https://medium.com/flutter-community/flutter-crush-debee5f389c3) ·
[Puzzle App Interface Design](https://rtware.net/design-ux/puzzle-app-ui-design/) ·
[Admiring the Game Design in Hyper-Casuals](https://www.gamedeveloper.com/design/admiring-the-game-design-in-hyper-casual-games) ·
[Squeezing more juice out of your game design (GameAnalytics)](https://www.gameanalytics.com/blog/squeezing-more-juice-out-of-your-game-design)

Mobil / erişilebilirlik / çocuk: [Haptics — Capacitor Documentation](https://capacitorjs.com/docs/apis/haptics) ·
[Capacitor Haptics (Capawesome)](https://capawesome.io/docs/sdks/capacitor/haptics/) ·
[5 Ways to Prevent the 300ms Click Delay](https://www.sitepoint.com/5-ways-prevent-300ms-click-delay-mobile-devices/) ·
[How to Reduce Input Lag in Mobile Games and Apps](https://keewano.com/blog/reduce-input-lag-games-apps/) ·
[Making touch scrolling fast by default (Chrome)](https://developer.chrome.com/blog/scrolling-intervention) ·
[Motion Sickness Accessibility in Video Games](https://madelinemiller.dev/blog/motion-sickness-accessibility/) ·
[Xbox Accessibility Guideline 117](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117) ·
[Design for Kids Based on Their Stage of Physical Development (NN/g)](https://www.nngroup.com/articles/children-ux-physical-development/) ·
[UI/UX Design for Children](https://www.aufaitux.com/blog/ui-ux-designing-for-children/)
