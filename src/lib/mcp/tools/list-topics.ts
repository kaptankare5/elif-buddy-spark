import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { elifbaTopics } from "../../../data/topics/elifba";

export default defineTool({
  name: "list_topics",
  title: "Konuları listele",
  description:
    "Elifbâ müfredatındaki tüm konuları (10 konu: Harfler, Yazılışlar, Harekeler, Cezm, Şedde, Med, Âsar, Tenvin, Zamir, Elif-Lâm) döndürür.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const topics = elifbaTopics.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      itemCount: t.items.length,
      hasVideo: Boolean(t.video),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(topics, null, 2) }],
      structuredContent: { topics },
    };
  },
});
