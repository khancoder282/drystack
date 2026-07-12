// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import drystack from "@drystack/astro";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://quangseo.drystack.dev/",
  integrations: [
    react(),
    drystack(),
    sitemap({
      filter: (page) => !page.includes("/drystack") && !page.includes("/api/drystack"),
    }),
  ],
  // The drystack admin (/drystack) and its API (/api/drystack) are on-demand
  // routes (prerender: false) — they need a server adapter even though the
  // rest of the site stays statically prerendered.
  adapter: cloudflare({
    prerenderEnvironment: 'node',
  }),
  output: "static",
  server: {
    port: 4567,
    host: "0.0.0.0",
  },
});
