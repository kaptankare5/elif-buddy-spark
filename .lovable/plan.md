# Elifbâ — Kur'an Öğreniyorum'a Dönüşüm

Uygulama, Diyanet Elifbâ kitabındaki 10 konuluk müfredat üzerine yeniden kurulur. Mevcut oyun/test/SRS/ilerleme altyapısı korunur; yeni bir **Flashcard** alıştırma tipi eklenir ve **konu kilidi** getirilir.

## 1. İçerik — mevcut konuları kaldır, Elifbâ ekle

- `src/data/topics/` altındaki `turkce.ts`, `ingilizce.ts`, `matematik.ts`, `doga.ts`, `kavramlar.ts` silinir.
- `src/data/subjects.ts` yeniden yazılır: tek bir subject (`elifba`) veya doğrudan konu listesi. UI'da "subject sayfası" atlanır; ana sayfa 10 konuyu (kilit durumlarıyla) gösterir.
- `src/data/types.ts` içine `SubjectId = "elifba"` yerine düz konu modeli kalır (yalnız `ContentTopic` + `ContentItem`).
- Yeni dosya: `src/data/topics/elifba.ts` — PDF sayfa 6-23'e göre:


| #   | Konu                  | İçerik (item)                                        | Alıştırmalar                               |
| --- | --------------------- | ---------------------------------------------------- | ------------------------------------------ |
| 1   | Harfler               | 28 tekil harf (ا ب ت ... ي)                          | flashcard/test/oyun                        |
| 2   | Harflerin Yazılışları | Her harfin başta/ortada/sonda/tek 4 formu            | 3 formu tek tek sorulur başta ortada sonda |
| 3   | Harekeler             | Tüm harfler × 3 hareke (fetha/kesra/damme) — tek tek | 3 hareke ayrı ayrı                         |
| 4   | Cezm                  | Sayfa 12'deki 2-harfli cezimli birimler              | ayrı ayrı                                  |
| 5   | Şedde                 | Sayfa 14'deki şeddeli birimler                       | ayrı ayrı                                  |
| 6   | Med Harfleri          | Sayfa 16'daki uzatmalı birimler                      | ayrı ayrı                                  |
| 7   | Âsar / Med / Kasr     | Sayfa 18 örnekleri                                   | alıştırma yok                              |
| 8   | Tenvin                | Sayfa 19-21 tenvinli birimler                        | ayrı ayrı                                  |
| 9   | Zamir / Lafzatullah   | Sayfa 22 örnekleri                                   | alıştırma yok                              |
| 10  | Elif-Lâm ve Râ        | Sayfa 23 örnekleri                                   | alıştırma yok                              |


Her `ContentItem` için: `arabic` (metin), `speech` (Türkçe transliterasyon TTS için), `translit` (kart arka yüz metni), opsiyonel `audio` (ses dosyası URL'i).

## 2. Konu kilidi

- Kural: bir konudaki **tüm harflerin SRS `level >= 3**` olması → sonraki konu açılır.
- 1. konu her zaman açık.
- `src/lib/unlock.ts` (yeni): `isTopicUnlocked(topicId)` — `getTopicSrs(NS, topicId)` üzerinden konu tamamlanma durumu hesaplar; sonraki konuya bakan `nextTopicUnlocked` yardımcıları.
- Ana sayfada (`Index.tsx`) kilitli konularda kilit ikonu + tıklamayı engelle.
- `Topic.tsx` giriş kontrolü: kilitliyse `/` sayfasına redirect.
- Oyunlar (`gamePool`) ve testler için **filtre**: yalnızca **açık konuların** itemlarını havuza al. `src/pages/games/_shared.ts` ve `QuizGame.tsx` güncellenir.
- Paywall/`premium.ts` mantığı kaldırılır ya da her şey ücretsiz sayılır (elifbâda premium ayrımı yok). Mevcut `isTopicFree` çağrıları no-op yapılır.

## 3. Flashcard alıştırma tipi (yeni)

Yeni sayfa: `src/pages/Flashcard.tsx` + rota `/konu/:topicId/flashcard`.

- Kart ön yüz: sadece Arapça harf/kelime (büyük, Diyanet-benzeri font).
- Karta tıklayınca 3D flip animasyonu (Tailwind + CSS `transform-style: preserve-3d`).
- Arka yüz: Arapça (küçük) + Türkçe transliterasyon yazısı + ses ikonu (otomatik `playSpeech`).
- Karta cevap butonları yerine **swipe**: sağa (biliyorum → doğru) / sola (bilmiyorum → yanlış). Klavye ok tuşları ve tıklanabilir 👍/👎 butonları da olur.
- Her swipe → `recordSrsAnswer(NS, topicId, itemId, correct)` çağrılır → mevcut SRS ve konu kilidi sistemine tamamen entegre.
- Kart sırası: `pickNextLetterFromTopic` ile SRS ağırlıklı seçilir (zaten oyunlarda kullanılan mantık).
- Konu sayfasında (`Topic.tsx`) ModeSwitch'e üçüncü buton eklenir: 🎯 Test / 🃏 Flashcard / 🎮 Oyunlar. "Kart" modu tamamen flashcard alıştırmasına dönüşür.

## 4. Konu ana ekranı

- Her konu sayfasında (özellikle 1, 2, 3, 7, 9, 10): PDF'deki tablo düzeninde harfler grid olarak gösterilir. Tıklanınca `playItem` ile o harfin/kelimenin sesi çalınır.
- Sayfa altında "Alıştırmaya başla" butonu → alıştırma tipi seçimi (flashcard/test/oyun).

## 5. Yazı tipi

- `bun add @fontsource/amiri-quran @fontsource/scheherazade-new` (Diyanet Mushaf hattına en yakın ücretsiz fontlar).
- `src/main.tsx`'te import; Tailwind config'e `fontFamily.arabic = ["Amiri Quran", "Scheherazade New", "serif"]`.
- Arapça gösterilen tüm elementlere `font-arabic` sınıfı.

## 6. Ses dosyaları

- GitHub `kaptankare5/sound` reposundan `elifbasesler.zip` indirilir, açılır, sesler `lovable-assets create` ile CDN'e yüklenir.
- Dosya adı → item id eşlemesi `src/data/topics/elifba.ts` içinde `audio` alanı olarak set edilir.
- `src/lib/audio.ts` içindeki `playItem` zaten `audio` alanını destekliyorsa aynen kullanılır; desteklemiyorsa küçük bir dallanma eklenir (dosya varsa `HTMLAudioElement`, yoksa mevcut Web Speech fallback).
- Eksik sesler için mevcut TTS (Web Speech, `speech: "elif"` gibi) devreye girer.

## 7. Temizlik

- `src/pages/Subject.tsx`, `src/pages/kavram/*`, `src/components/MathPractice.tsx`, `src/data/topics/*` (elifba hariç) silinir.
- `src/App.tsx` rotalarından `/konu/:subjectId` kaldırılır; `/konu/:topicId` ve `/konu/:topicId/flashcard` bırakılır.
- İlerleme sayfası (`Progress.tsx`) 10 Elifbâ konusunu listeleyecek şekilde güncellenir.

## Etkilenmeyenler (bilinçli olarak dokunulmuyor)

- `src/data/srs.ts` (SRS/tekrar mantığı) — aynen.
- `src/pages/games/*` (oyunlar) — sadece havuz filtresi (kilit).
- `letter_stats`/`answer_events` tabloları ve `record_letter_answer` RPC — aynen (topic_id/letter_id string olarak yeni id'ler alır).
- Auth, abonelik alt yapısı korunur; paywall UI kaldırılır ama tablolar dokunulmaz.

## Onay sonrası ilk adımlar

1. `elifbasesler.zip` indir, içeriği listele, item id şeması karara bağla.
2. `elifba.ts` müfredatını yaz.
3. Kilit + flashcard implementasyonu.
4. Eski subject dosyalarını sil, rotaları güncelle.
5. Fontları ekle, Arapça stilleri uygula.
6. Sesleri CDN'e yükle ve entegre et.