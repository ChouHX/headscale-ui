import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { __resetForTest } from "@/lib/idb";
import {
  hydrateSettings,
  readSetting,
  settingsStorageTestingHandle,
  writeSetting,
} from "@/lib/settings-storage";
import { isThemeMode, themeTestingHandle, useTheme } from "./useTheme";

const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function restoreGlobal(name: "document" | "window", descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTest();
  settingsStorageTestingHandle.reset();
  themeTestingHandle.reset();
  await hydrateSettings();
});

afterEach(() => {
  restoreGlobal("document", documentDescriptor);
  restoreGlobal("window", windowDescriptor);
});

describe("useTheme", () => {
  test("recognizes supported modes", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("auto")).toBe(true);
    expect(isThemeMode("sepia")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  test("loads the saved mode and applies browser color-scheme changes", () => {
    const toggles: boolean[] = [];
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        documentElement: {
          classList: {
            toggle: (_name: string, enabled: boolean) => void toggles.push(enabled),
          },
        },
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: true }) },
    });
    writeSetting("theme", "dark");

    const theme = useTheme();
    expect(useTheme()).toBe(theme);
    expect(theme.colorMode.value).toBe("dark");
    expect(theme.themeModes).toEqual(["light", "dark", "auto"]);

    theme.setTheme("auto");
    expect(toggles.at(-1)).toBe(true);
    theme.setTheme("light");
    expect(toggles.at(-1)).toBe(false);
    expect(readSetting("theme")).toBe("light");
  });

  test("falls back to auto without browser globals for an invalid saved value", () => {
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
    writeSetting("theme", "sepia");

    const theme = useTheme();

    expect(theme.colorMode.value).toBe("auto");
    expect(readSetting("theme")).toBe("auto");
  });
});
