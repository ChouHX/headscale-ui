import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { webdriverio } from "@vitest/browser-webdriverio";
import { defineConfig } from "vitest/config";

const resizeObserverLoopMessage = "ResizeObserver loop completed with undelivered notifications.";
const headscaleE2eUrl = process.env.HEADSCALE_E2E_URL;

// Chrome emits this as an ErrorEvent with no `error`; Vitest Browser then forwards
// it through Vite as noisy test output, not as an application failure.
function suppressKnownResizeObserverNoise() {
  return {
    name: "headscale-ui:suppress-known-resize-observer-noise",
    apply: "serve" as const,
    configureServer(server) {
      const error = server.config.logger.error.bind(server.config.logger);
      server.config.logger.error = (message, options) => {
        if (
          typeof message === "string" &&
          message.includes(resizeObserverLoopMessage) &&
          (message.includes("[Unhandled error]") || message.includes("[console.error]"))
        ) {
          return;
        }
        error(message, options);
      };
    },
  };
}

export default defineConfig({
  plugins: [suppressKnownResizeObserverNoise(), vue(), tailwindcss()],
  server: headscaleE2eUrl
    ? {
        proxy: {
          "/__headscale-e2e": {
            target: headscaleE2eUrl,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/__headscale-e2e/, ""),
          },
        },
      }
    : undefined,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["e2e/**/*.test.ts"],
    // beforeEach does an IDB delete + hydrate (device key + legacy migration scan), adding
    // roughly 0.5-1s per test. Bump per-test timeout to absorb that overhead.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    deps: {
      optimizer: {
        web: {
          include: ["vue-router"],
        },
      },
    },
    browser: {
      enabled: true,
      headless: true,
      provider: webdriverio({
        capabilities: {
          "wdio:enforceWebDriverClassic": true,
        },
      }),
      instances: [{ browser: "chrome" }],
    },
  },
});
