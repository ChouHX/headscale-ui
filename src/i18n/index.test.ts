import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { createRenderer, defineComponent } from "vue";
import { __resetForTest } from "@/lib/idb";
import {
  hydrateSettings,
  readSetting,
  settingsStorageTestingHandle,
  writeSetting,
} from "@/lib/settings-storage";
import { applyStoredLocale, i18n, useHeadscaleI18n } from "./index";

function mountComposable<T>(setup: () => T): T {
  let result: T | undefined;
  const renderer = createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
  });
  const app = renderer.createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => null;
      },
    }),
  );
  app.use(i18n);
  app.mount({});
  if (result === undefined) throw new Error("Composable setup did not run");
  return result;
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTest();
  settingsStorageTestingHandle.reset();
  await hydrateSettings();
  (i18n.global.locale as unknown as { value: string }).value = "en-US";
});

describe("applyStoredLocale", () => {
  test("does not fall back to English for missing localized keys", () => {
    expect((i18n.global.fallbackLocale as unknown as { value: unknown }).value).toBe(false);
  });

  test("migrates a legacy locale and writes back its canonical tag", () => {
    writeSetting("locale", "fr");

    applyStoredLocale();

    expect((i18n.global.locale as unknown as { value: string }).value).toBe("fr-FR");
    expect(readSetting("locale")).toBe("fr-FR");
  });

  test("binds composer helpers and synchronizes locale metadata to the document", () => {
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    const documentElement = { lang: "", dir: "" };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { documentElement },
    });

    try {
      const headscaleI18n = mountComposable(useHeadscaleI18n);
      expect(headscaleI18n.locale.value).toBe("en-US");
      expect(headscaleI18n.meta.value.dir).toBe("ltr");
      expect(headscaleI18n.t("light")).toBe("Light");
      expect(headscaleI18n.t("restoringSession", { name: "Alpha" })).toContain("Alpha");
      expect(headscaleI18n.tg("nodes")).toBe("Nodes");
      expect(headscaleI18n.toperation("health.check").title).toBe("Check health");

      headscaleI18n.setLocale("ar");
      expect(headscaleI18n.locale.value).toBe("ar");
      expect(headscaleI18n.meta.value.dir).toBe("rtl");
      expect(documentElement).toEqual({ lang: "ar", dir: "rtl" });
      expect(readSetting("locale")).toBe("ar");
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, "document", documentDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
    }
  });
});
