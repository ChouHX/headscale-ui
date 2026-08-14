import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

function normalizeBasePath(value: string | undefined) {
  const path = value?.trim() || "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
