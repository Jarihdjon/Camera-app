import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const API = `http://localhost:${process.env.PORT ?? 5174}`;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Yav's Learning Journey",
        short_name: "Journey",
        description: "Learn, earn blocks, build your world.",
        display: "standalone",
        orientation: "any",
        background_color: "#0b1026",
        theme_color: "#0b1026",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        // Cache the app shell and today's session so he can finish if Wi-Fi drops.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          { urlPattern: /\/api\/session\/today$/, handler: "NetworkFirst", options: { cacheName: "today" } },
        ],
      },
    }),
  ],
  server: { proxy: { "/api": API } },
  preview: { proxy: { "/api": API } },
});
