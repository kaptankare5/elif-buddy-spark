import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { elifbaTopics } from "../../../data/topics/elifba";

export default defineTool({
  name: "get_letter",
  title: "Harf bilgisi",
  description:
    "28 temel Arap harfinden birini Türkçe adı (Elif, Be, Cim, Vev, Ye...) veya Arapça glifi ile arar; okunuş ve ses dosyası yolunu döndürür.",
  inputSchema: {
    query: z.string().describe("Harf adı (Türkçe) veya Arapça glif. Ör: 'Elif', 'ب', 'Cim'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query }) => {
    const letters = elifbaTopics.find((t) => t.id === "harfler")?.items ?? [];
    const q = query.trim().toLocaleLowerCase("tr");
    const match = letters.find(
      (l) =>
        l.label.toLocaleLowerCase("tr") === q ||
        l.translit?.toLocaleLowerCase("tr") === q ||
        l.emoji === query.trim(),
    );
    if (!match) {
      return {
        content: [{ type: "text", text: `Harf bulunamadı: ${query}` }],
        isError: true,
      };
    }
    const payload = {
      name: match.label,
      arabic: match.emoji ?? null,
      speech: match.speech,
      audio: match.audio ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
