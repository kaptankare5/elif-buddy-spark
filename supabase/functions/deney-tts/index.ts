// Deney modülü — İspanyolca kelime seslendirme (ElevenLabs).
// 18 kelimelik sabit liste: üretilen mp3 storage'a BİR KEZ yazılır; sonraki
// isteklerde yalnızca imzalı URL döner (yeniden üretim/indirme yok).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "deney-ses";
const VOICE_ID = "XrExE9yKIg1WjnnlVkGX"; // Matilda — sıcak, net kadın sesi
const SIGN_SECONDS = 60 * 60 * 24 * 7; // 7 gün

// SABİT KELİME LİSTESİ — deney modülünün 18 kelimesi. Bu listede olmayan
// hiçbir metin ElevenLabs'e gönderilmez (maliyet/depo suistimalini engeller).
const ALLOWED_WORDS = new Set([
  "mariposa", "llave", "cuchara", "zanahoria", "ventana", "caballo",
  "fresa", "pájaro", "silla", "queso", "huevo", "zapato",
  "abeja", "rana", "hoja", "reloj", "calcetín", "cuchillo",
]);

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word } = await req.json().catch(() => ({ word: null }));
    if (typeof word !== "string" || !ALLOWED_WORDS.has(word.trim().toLocaleLowerCase("es"))) {
      return json({ error: "invalid word" }, 400);
    }

    const path = `el/${slug(word)}.mp3`; // el/ = ElevenLabs sürümü
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const sign = async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGN_SECONDS);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "sign failed");
      return data.signedUrl;
    };

    // 1) Önbellek — dosya varsa üretme, sadece URL ver.
    const list = await supabase.storage.from(BUCKET).list("el", { search: `${slug(word)}.mp3`, limit: 100 });
    if (list.data?.some((f) => f.name === `${slug(word)}.mp3`)) {
      return json({ url: await sign(), cached: true });
    }

    // 2) Üret (ElevenLabs)
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) return json({ error: "elevenlabs_not_connected" }, 500);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: word,
          model_id: "eleven_multilingual_v2",
          language_code: "es",
          voice_settings: { stability: 0.6, similarity_boost: 0.8, speed: 0.9 },
        }),
      },
    );

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error(`ElevenLabs TTS failed [${res.status}]: ${details}`);
      return json({ error: "tts_failed", status: res.status, details }, res.status);
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (up.error) {
      console.error("upload failed:", up.error.message);
      return json({ error: "upload_failed", details: up.error.message }, 500);
    }

    return json({ url: await sign(), cached: false });
  } catch (e) {
    console.error("deney-tts error:", e);
    return json({ error: String(e) }, 500);
  }
});
