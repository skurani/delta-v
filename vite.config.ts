import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Serve the generated event stream as a static asset:
  // data/usage-events.json → fetch("/usage-events.json")
  publicDir: "data",
  server: {
    // The reasoning server holds the API key (SPEC.md §6) — the app only
    // ever talks to it through this same-origin proxy.
    proxy: { "/api": "http://localhost:8787" },
  },
});
