import { createApp, h } from "vue";
import App from "./App.vue";
import ErrorScreen from "./components/ErrorScreen.vue";
import { applyStoredLocale, i18n } from "./i18n";
import { hydrate } from "./lib/profile-storage";
import { hydrateSettings } from "./lib/settings-storage";
import { router } from "./router";
import "./styles/globals.css";
import { useMasterPassword } from "./composables/useMasterPassword";

async function bootstrap() {
  console.info("[headscale-ui] bootstrap: hydrating settings and profiles from IndexedDB");
  // Settings (theme/locale) load first so applyStoredLocale and any composable
  // running during component setup see hydrated values from the start.
  await hydrateSettings();
  const mp = useMasterPassword();
  await mp.initialize();
  await hydrate({
    encryptLegacy: (plain) => mp.encryptWithDeviceKey(plain),
  });
  applyStoredLocale();
  console.info("[headscale-ui] bootstrap: ready");
  createApp(App).use(i18n).use(router).mount("#app");
}

bootstrap().catch((err) => {
  console.error("[headscale-ui] bootstrap failed", err);
  createApp({
    render: () => h(ErrorScreen, { error: err }),
  }).mount("#app");
});
