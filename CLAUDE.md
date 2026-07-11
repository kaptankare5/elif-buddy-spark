# Elifbâ (elif-buddy-spark)

Çocuklara Kur'an harflerini öğreten React uygulaması. Vite + React 18 + TS +
Tailwind + shadcn + Supabase. Dev: `npm run dev`
(port 8080, `.claude/launch.json` var). Doğrulama: `npx tsc --noEmit` + eslint.

### Supabase (Lovable bağımlılığı SÖKÜLDÜ — Tem 2026)
- Eski Lovable Supabase projesi ve `@lovable.dev/cloud-auth-js` kaldırıldı.
  Yeni bağımsız proje kurulumu: `docs/supabase-kurulum.md`; şemanın tamamı TEK
  migration'da: `supabase/migrations/20260711000000_yeni_kurulum.sql`.
- `.env` gitignore'da; `.env.example`'dan kopyalanır. Env yoksa client.ts
  placeholder URL ile çalışır (`isSupabaseConfigured` false) — app local-first
  çalışmaya devam eder, bulut istekleri sessizce başarısız olur.
- Auth: e-posta+şifre ve Google, `supabase.auth.signInWithOAuth` (Auth.tsx).
  Capacitor'da Google için deep link gerekir (dokümanda adımlar).
- Öğrenci bulut senkronu (`src/lib/studentSync.ts`): Hoca Modu öğrencileri
  giriş varken buluta bağlanır (`students` + `student_letter_stats`, ns=quiz/games).
  6 haneli link_code ile başka cihaz/hesap `claim_student_by_code` RPC'siyle
  bağlanır → `mergeIntoStudentSrs` (srs.ts) "daha çok karşılaşma kazanır"
  kuralıyla birleştirir. Öğrenci aktifken cevap hocanın letter_stats'ine DEĞİL
  öğrencinin bulut kaydına gider (srs.ts recordSrsAnswer).
- Hoca Paneli `/hoca` (TeacherPanel.tsx): öğrenci raporları, bağlantı kodları,
  kodla bağlanma, "hesabımdaki öğrencileri getir".

## Mimari — kritik kurallar

### Ses (EN ÖNEMLİSİ — geçmişte bozuldu)
- Harf/hece sesleri GERÇEK hoca kayıtları: `public/audio/elifba/*.mp3`
  (basic/hareke/cezm/sedde/med/tenvin — 600+ dosya, item.audio alanında).
- **Daima `playItem(item)` kullan** (item.audio'yu çalar). `playSpeech(text)`
  metni `public/audio/manifest.json`'da arar; bulamazsa ROBOTİK tarayıcı
  TTS'ine düşer. Harf sesi için playSpeech KULLANMA. "Tebrikler!" gibi TTS
  kutlamaları kaldırıldı — `playFeedback(true/false)` (ding/buzz) kullan.

### Veri: `src/data/topics/elifba.ts`
- 28 harf `LETTERS` tablosunda: `cons` (ünsüz) + `thick` (ince/kalin/ra) →
  hareke okunuşları üretilir (kalın 7 harf a/ı/u; Râ karışık ra/ri/ru;
  gerisi e/i/ü). Adlar: Vev (Vav değil), Lem (Lam değil), Ye.
- 10 konu; 7/9/10 video'lu (`topic.video`, YouTube gömme Topic.tsx'te).
- `item.section` = "N. Bölüm" (4 harflik gruplar) veya "Ekstralar"
  (Diyanet PDF alıştırmalarından). CRLF satır sonları — çok satırlı Edit
  eşleşmesi başarısız olursa nedeni bu (tek satır anchor veya node kullan).

### Öğrenme sistemi (bilimsel gerekçeli — koru)
- SRS `src/data/srs.ts`: L1-4. Yanlış = **-2 seviye** (kullanıcı şartı,
  değişmez). L3→L4 = üst üste 2 doğru (`consecutiveCorrect`). Seçici:
  görülmemişler müfredat sırasıyla, art arda aynı öğe yok, ağırlıklar
  L1 %55…L4 %15 (%85 başarı kuralı).
- Bölüm kilidi `src/lib/unlock.ts`: konu içi section'lar sıralı açılır
  (bölümdeki tüm öğeler L3+ → sonraki açılır; eskiler açık kalır).
  Test/Flashcard/oyun havuzu (`gamePool`) YALNIZ açık öğeleri sorar
  (`getUnlockedItemsOf` / `getUnlockedItemIdSet`).
- Konu kilidi: konudaki tüm öğeler L3+ → sonraki konu. Ayarlar'da test
  kilidi: kod **1234** her şeyi açar (`src/lib/testUnlock.ts`).

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
  öğrenciye özel, geçişte kaldığı yerden. Öğrenci aktifken cevaplar hocanın
  hesabına değil, öğrencinin bulut kaydına yazılır (bkz. studentSync.ts).
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
