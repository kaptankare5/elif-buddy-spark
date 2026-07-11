# Yeni Supabase Projesi Kurulumu

Eski (Lovable'ın açtığı) Supabase projesi koddan tamamen söküldü. Uygulama artık
senin açacağın **yeni ve bağımsız** bir Supabase projesiyle çalışır. Supabase
yapılandırılmasa bile uygulama bozulmaz: local-first çalışır, sadece bulut
özellikleri (hesap, senkron, istatistik) devre dışı kalır.

## 1) Proje aç

1. https://supabase.com → **New project** (ücretsiz plan yeterli).
2. Bölge olarak Avrupa'yı (örn. Frankfurt) seç, güçlü bir DB şifresi belirle.
3. Proje açılınca **Project Settings → API**'den şunları kopyala:
   - Project URL (`https://XXXX.supabase.co`)
   - `sb_publishable_...` anahtarı (Publishable key)

## 2) Şemayı kur

Tek dosya yeter: `supabase/migrations/20260711000000_yeni_kurulum.sql`

- **Kolay yol:** Dashboard → **SQL Editor** → dosyanın tüm içeriğini yapıştır → Run.
- **CLI yolu:** `supabase/config.toml` içine proje ID'ni yaz, sonra
  `supabase link --project-ref <PROJE_ID>` ve `supabase db push`.

Kurulan şema:

| Alan | Tablolar | Ne işe yarar |
|---|---|---|
| Hesap ilerlemesi | `letter_stats`, `answer_events` | Giriş yapan kullanıcının SRS yedeği + her cevabın ham kaydı (`record_letter_answer` RPC) |
| Öğrenci senkronu | `students`, `student_guardians`, `student_letter_stats` | Hoca Modu profillerinin bulut kopyası; 6 haneli bağlantı koduyla başka cihazdan devam (`claim_student_by_code` RPC) |
| Analitik | `game_sessions`, `screen_views`, `learning_milestones`, `paywall_events` | Sadece veli onayı verilirse yazılır |
| İstatistik | `analytics_*` view'ları (14 adet) | Admin panelinin veri kaynağı: öğrenme hızı (dakikada/saatte öğe), harf başına öğrenme süresi, DAU, retention, süper-vs-normal, kullanıcı bazlı ilerleme |
| Yetki | `profiles`, `user_roles`, `subscriptions` | Rol (admin/teacher/parent) ve abonelik durumu |

## 3) `.env` doldur

`.env.example` dosyasını `.env` olarak kopyala ve kendi değerlerini yaz:

```
VITE_SUPABASE_PROJECT_ID="XXXX"
VITE_SUPABASE_URL="https://XXXX.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
```

`.env` artık gitignore'da — commit edilmez. Yayın ortamına (Vercel/Netlify vb.)
aynı değişkenleri ortam değişkeni olarak ekle.

## 4) Giriş yöntemleri

### E-posta + şifre
Dashboard → **Authentication → Sign In / Up → Email**: açık gelir. İstersen
"Confirm email" seçeneğini kapatarak kayıt sonrası anında girişe izin verebilirsin.

### Google
1. https://console.cloud.google.com → proje aç → **APIs & Services → Credentials
   → Create Credentials → OAuth client ID** (tip: Web application).
2. **Authorized redirect URI** olarak şunu ekle:
   `https://XXXX.supabase.co/auth/v1/callback`
3. Client ID + Client Secret'ı Supabase → **Authentication → Providers → Google**'a
   yapıştır ve etkinleştir.

### Yönlendirme adresleri
Authentication → **URL Configuration**:
- Site URL: canlı adresin (örn. `https://endlessmum.com`)
- Redirect URLs: `http://localhost:8080`, canlı adres ve `/sifre-sifirla` yolu.

## 5) İlk admin (istatistik paneli için)

Uygulamada bir hesap aç, sonra SQL Editor'de:

```sql
-- user_id'yi Authentication → Users listesinden kopyala
INSERT INTO public.user_roles (user_id, role) VALUES ('BURAYA-USER-ID', 'admin');
```

Artık `/admin` sayfası bu hesapla açılır: DAU, oyun popülerliği, **öğrenme hızı
(dakikada kaç yeni harf)**, harf başına ortalama öğrenme süresi, retention,
yaş dağılımı, kullanıcı bazlı harf kırılımı… (Pazarlama cümlesi için en uygun
metrikler: `analytics_learning_power.avg_seconds_per_item` ve
`analytics_learning_rate.items_per_hour`.)

## 6) Cihazlar arası devam (Hoca ↔ Veli) nasıl çalışır?

1. Hoca kendi telefonunda giriş yapar, Ayarlar → Hoca Modu'ndan öğrenci ekler →
   öğrenci otomatik buluta bağlanır ve 6 haneli **bağlantı kodu** üretilir
   (Hoca Paneli `/hoca` sayfasında görünür, tek dokunuşla kopyalanır).
2. Camide ders: öğrenci profili aktifken verilen her cevap hem cihaza hem
   öğrencinin bulut kaydına yazılır.
3. Evde: anne kendi telefonunda (kendi hesabıyla) giriş yapar, `/hoca`
   sayfasında kodu girer → öğrenci onun cihazına eklenir, ilerleme buluttan
   birleşir, çocuk **kaldığı yerden** devam eder.
4. Birleşme kuralı: aynı harf için daha çok karşılaşma görmüş kayıt kazanır —
   iki cihaz çakışırsa ileride olan geçerlidir.
5. Hoca `/hoca` panelinde her öğrencinin öğrendiği harf sayısını, doğruluğunu,
   **sıradaki öğrenilecek harfi** ve konu bazlı seviye haritasını görür.

## 7) Capacitor (mobil) notları

- Kod `window.Capacitor` kontrolü ile platformu zaten raporluyor; Supabase
  istemcisi WebView'da aynen çalışır.
- **Google girişi native'de:** `signInWithOAuth` şu an `redirectTo:
  window.location.origin` kullanıyor (web için doğru). Capacitor'a geçerken:
  1. Uygulamaya bir deep link şeması ekle (örn. `elifmim://auth-callback`),
  2. Supabase Redirect URLs listesine bu şemayı ekle,
  3. `signInWithOAuth`'u `skipBrowserRedirect: true` + `@capacitor/browser` ile
     aç ve dönüşte `supabase.auth.exchangeCodeForSession` çağır.
  Bu adımlar `src/pages/Auth.tsx` içindeki `doGoogle`'da tek noktada değişir.
- Oturum `localStorage`'da tutuluyor; Capacitor WebView'da kalıcıdır, ek iş
  gerekmez.
