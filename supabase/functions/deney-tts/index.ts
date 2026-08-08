// Deney modülü — İspanyolca kelime seslendirme (yapay zekâ).
// 18 kelimelik sabit liste: üretilen mp3 storage'a yazılır, ikinci istekte
// yeniden üretilmez (maliyet sıfır, ses anında gelir).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "deney-ses";

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { word } = await req.json();
    if (typeof word !== "string" || !word.trim() || word.length > 40) {
      return new Response(JSON.stringify({ error: "invalid word" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const path = `${slug(word)}.mp3`;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Önbellek
    const cached = await supabase.storage.from(BUCKET).download(path);
    if (cached.data) {
      return new Response(await cached.data.arrayBuffer(), {
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
      });
    }

    // 2) Üret
    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: word,
        voice: "alloy",
        instructions:
          "Speak in clear, natural Castilian Spanish (Spain). Calm, friendly, slightly slow and very articulate, as if teaching a child a single vocabulary word.",
        speed: 0.9,
        stream_format: "audio",
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const details = await res.text().catch(() => "");
      console.error(`TTS failed [${res.status}]: ${details}`);
      return new Response(JSON.stringify({ error: "tts_failed", status: res.status, details }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (up.error) console.error("upload failed:", up.error.message);

    return new Response(bytes, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
    });
  } catch (e) {
    console.error("deney-tts error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
