// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";
import { elifbaTopics } from "../src/data/topics/elifba.ts";

const BASE_URL = "https://elifmim.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const GAME_IDS = [
  "memory",
  "balloon",
  "sorter",
  "puzzle",
  "triple",
  "quiz",
  "subway",
  "platform",
  "flappy",
  "snake",
  "runner",
  "match3",
];

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/oyunlar", changefreq: "weekly", priority: "0.8" },
  { path: "/ilerleme", changefreq: "weekly", priority: "0.6" },
  { path: "/ayarlar", changefreq: "monthly", priority: "0.4" },
  { path: "/giris", changefreq: "monthly", priority: "0.4" },
  { path: "/sifre-sifirla", changefreq: "yearly", priority: "0.3" },
  { path: "/abonelik", changefreq: "monthly", priority: "0.5" },
  { path: "/gizlilik", changefreq: "yearly", priority: "0.3" },
];

const today = new Date().toISOString().split("T")[0];

const entries: SitemapEntry[] = [
  ...staticEntries,
  ...elifbaTopics.map((t) => ({
    path: `/konu/elifba/${t.id}`,
    changefreq: "weekly" as const,
    priority: "0.9",
    lastmod: today,
  })),
  ...elifbaTopics.map((t) => ({
    path: `/konu/elifba/${t.id}/flashcard`,
    changefreq: "weekly" as const,
    priority: "0.7",
    lastmod: today,
  })),
  ...GAME_IDS.map((id) => ({
    path: `/oyunlar/${id}`,
    changefreq: "weekly" as const,
    priority: "0.7",
    lastmod: today,
  })),
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSitemap(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      `  <url>`,
      `    <loc>${escapeXml(`${BASE_URL}${e.path}`)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
