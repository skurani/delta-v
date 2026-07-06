import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Serve the generated event stream as a static asset:
  // data/usage-events.json → fetch("/usage-events.json")
  publicDir: "data",
});
