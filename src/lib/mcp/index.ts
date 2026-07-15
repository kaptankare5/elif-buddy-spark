import { defineMcp } from "@lovable.dev/mcp-js";
import listTopicsTool from "./tools/list-topics";
import getTopicTool from "./tools/get-topic";
import getLetterTool from "./tools/get-letter";

export default defineMcp({
  name: "elifmim-mcp",
  title: "Elifmim MCP",
  version: "0.1.0",
  instructions:
    "Elifmim (Elifbâ öğrenme uygulaması) için ortak müfredat araçları. Kur'an Arap alfabesindeki 28 harfi, harekeleri, cezm/şedde/med/tenvin konularını ve her öğenin Arapça glifi, Türkçe okunuşu ile hoca ses kaydı yolunu döndürür. Herkese açık öğretici veridir.",
  tools: [listTopicsTool, getTopicTool, getLetterTool],
});
