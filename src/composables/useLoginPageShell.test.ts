import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { createRenderer, defineComponent } from "vue";
import { i18n } from "@/i18n";
import { __resetForTest } from "@/lib/idb";
import { hydrateSettings, readSetting, settingsStorageTestingHandle } from "@/lib/settings-storage";
import { useLoginPageShell } from "./useLoginPageShell";
import { themeTestingHandle } from "./useTheme";

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
  themeTestingHandle.reset();
  await hydrateSettings();
  (i18n.global.locale as unknown as { value: string }).value = "en-US";
});

describe("useLoginPageShell", () => {
  test("labels themes and applies locale and theme choices", () => {
    const shell = mountComposable(useLoginPageShell);

    expect(shell.themeModeLabel("dark")).toBe("Dark");
    expect(shell.themeModeLabel("light")).toBe("Light");
    expect(shell.themeModeLabel("auto")).toBe("System");
    expect(shell.themeLabel.value).toBe("System");
    expect(shell.themeModes).toEqual(["light", "dark", "auto"]);

    shell.chooseLocale("zh-Hans");
    expect((i18n.global.locale as unknown as { value: string }).value).toBe("zh-Hans");
    expect(readSetting("locale")).toBe("zh-Hans");

    shell.chooseTheme("dark");
    expect(shell.colorMode.value).toBe("dark");
    expect(readSetting("theme")).toBe("dark");
  });
});
