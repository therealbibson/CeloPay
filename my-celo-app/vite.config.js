import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "apps/web",
  plugins: [tailwindcss()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
