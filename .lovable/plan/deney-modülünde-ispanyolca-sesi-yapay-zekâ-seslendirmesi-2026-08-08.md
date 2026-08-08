# Deney modülünde İspanyolca sesi: yapay zekâ seslendirmesi

Şu an deney tarayıcının kendi konuşma motorunu (`speechSynthesis`, es-ES) kullanıyor. Çoğu telefonda İspanyolca ses paketi yüklü değil — ses hiç çıkmıyor ya da robotik geliyor. Bu, üretim/tanıma ölçümünü doğrudan bozar.

Dili değiştirmek yerine İspanyolcayı koruyup sesi yapay zekâ ile üreteceğiz: kelime listesi sabit ve yalnızca 18 kelime, yani sesler bir kez üretilip saklanabilir. Böylece çocuk her seferinde aynı, doğal ve net telaffuzu duyar (deney için tutarlılık şart).

## Yapılacaklar

1. **Sunucu tarafı seslendirme**: Yeni bir backend fonksiyonu, verilen İspanyolca kelimeyi yapay zekâ ile seslendirip mp3 döndürür. Anahtar sunucuda kalır.
2. **Kalıcı önbellek**: Üretilen mp3 depolamaya (public ses klasörü/bucket) kelime adıyla yazılır. Aynı kelime bir daha üretilmez — ilk çalıştırmadan sonra maliyet sıfır, ses anında gelir.
3. **İstemci**: `speakEs` / `speakTwice` önce bu mp3'ü çalar (tarayıcıda da önbelleklenir). Ses hazır değilse üretilir; herhangi bir hata olursa eskisi gibi tarayıcı motoruna düşer — deney hiçbir durumda sessiz kalmaz.
4. **Ön ısıtma**: Deney girişinde 18 kelimenin sesi arka planda hazırlanır; "Ses hazır" göstergesi tarayıcı ses paketi yerine bu hazırlığı gösterir.
5. **Çift okuma**: Öğretme adımındaki iki kez okuma aynı dosya iki kez çalınarak korunur.

## Teknik notlar

- Seslendirme Lovable AI ses geçidi üzerinden (`openai/gpt-4o-mini-tts`), `stream_format: "audio"`, `response_format: "mp3"` — dosya saklanacağı için akış gerekmiyor.
- Ses tonu: sakin, net, orta-yavaş tempo; tek bir kadın ses (`alloy`) tüm kelimelerde sabit.
- Depolama: Supabase Storage'da public `deney-ses` bucket'ı, dosya adı kelimenin sadeleştirilmiş hâli (`pajaro.mp3`).
- `src/lib/deney.ts` içindeki `speakEs`/`speakTwice` imzaları değişmez; `Deney.tsx` çağrı yerlerine dokunulmaz.
- SRS, Elifbâ sesleri ve `public/audio/*` hiç etkilenmez — deney modülü ayrı kalır.
