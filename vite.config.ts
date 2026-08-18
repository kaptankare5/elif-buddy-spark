import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [react(), mcpPlugin()],
  build: {
    // ⚠️ CAPACITOR/PLAY STORE: paketler YEREL diskten okunuyor, ağ beklemesi
    // yok — bölmek saf kazanç. Tek dosyada 2.4 MB JS her AÇILIŞTA ayrıştırılıyordu;
    // alfabe sayfasını açan çocuk 3B yarış motorunu da bekliyordu.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // three.js ailesi: YALNIZ 3 oyun kullanıyor (Koşusu, Partisi, Yarışı).
          if (/[\\/]node_modules[\\/](three|@react-three|troika|its-fine|zustand|suspend-react|maath|meshline)/.test(id))
            return "three";
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id))
            return "react";
          if (id.includes("@supabase")) return "supabase";
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
