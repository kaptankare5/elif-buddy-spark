import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { elifbaTopics } from "@/data/topics/elifba";

export default defineTool({
  name: "get_topic",
  title: "Konu detayı",
  description:
    "Bir Elifbâ konusunun tüm öğelerini (harf/hece/kelime, Arapça glif, Türkçe okunuş, ses dosyası yolu, bölüm) döndürür.",
  inputSchema: {
    topicId: z
      .string()
      .describe("Konu id (ör. 'harfler', 'harekeler', 'cezm', 'sedde', 'med', 'tenvin')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ topicId }) => {
    const topic = elifbaTopics.find((t) => t.id === topicId);
    if (!topic) {
      const known = elifbaTopics.map((t) => t.id).join(", ");
      return {
        content: [
          { type: "text", text: `Konu bulunamadı: ${topicId}. Mevcut konular: ${known}` },
        ],
        isError: true,
      };
    }
    const payload = {
      id: topic.id,
      title: topic.title,
      description: topic.description,
      video: topic.video ?? null,
      items: topic.items.map((it) => ({
        id: it.id,
        label: it.label,
        arabic: it.emoji ?? null,
        speech: it.speech,
        translit: it.translit ?? null,
        audio: it.audio ?? null,
        section: it.section ?? null,
      })),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
