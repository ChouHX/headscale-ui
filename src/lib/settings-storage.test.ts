import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { __resetForTest, idbGet, idbPut, openHeadscaleDb, STORE_META } from "./idb";
import {
  hydrateSettings,
  readSetting,
  settingsStorageTestingHandle,
  writeSetting,
} from "./settings-storage";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTest();
  settingsStorageTestingHandle.reset();
});

function replaceObjectStoreMethod(
  method: "get" | "put",
  replacement: (this: IDBObjectStore, ...args: unknown[]) => unknown,
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, method);
  Object.defineProperty(IDBObjectStore.prototype, method, {
    configurable: true,
    value: replacement,
  });
  return () => {
    if (descriptor) Object.defineProperty(IDBObjectStore.prototype, method, descriptor);
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("settings storage", () => {
  test("rejects synchronous access before hydration", () => {
    expect(() => readSetting("theme")).toThrow("accessed before hydrateSettings");
    expect(() => writeSetting("theme", "dark")).toThrow("accessed before hydrateSettings");
  });

  test("hydrates string settings, ignores invalid values, and persists snapshots", async () => {
    await idbPut(STORE_META, { theme: "dark", locale: "test-locale", invalid: 42 }, "ui-settings");
    await hydrateSettings();

    expect(readSetting("theme")).toBe("dark");
    expect(readSetting("locale")).toBe("test-locale");
    expect(readSetting("invalid")).toBeNull();
    expect(readSetting("missing")).toBeNull();

    writeSetting("theme", "light");
    await settle();
    expect(await idbGet(STORE_META, "ui-settings")).toEqual({
      theme: "light",
      locale: "test-locale",
    });
  });

  test("falls back to memory when IndexedDB is unavailable", async () => {
    const warnings: unknown[][] = [];
    const errors: unknown[][] = [];
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args) => void warnings.push(args);
    console.error = (...args) => void errors.push(args);
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    __resetForTest();

    try {
      await hydrateSettings();
      writeSetting("theme", "dark");
      await settle();
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
    }

    expect(readSetting("theme")).toBe("dark");
    expect(warnings[0]?.[0]).toContain("settings kept in-memory only");
    expect(errors[0]?.[0]).toContain("writeSetting theme failed");
  });

  test("keeps an empty cache when the settings read fails", async () => {
    await openHeadscaleDb();
    const restore = replaceObjectStoreMethod("get", () => {
      throw new Error("simulated settings read failure");
    });
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args) => void warnings.push(args);

    try {
      await hydrateSettings();
    } finally {
      restore();
      console.warn = originalWarn;
    }

    expect(readSetting("theme")).toBeNull();
    expect(warnings[0]?.[0]).toContain("settings hydrate read failed");
  });

  test("keeps the in-memory value when a persistence write fails", async () => {
    await hydrateSettings();
    const restore = replaceObjectStoreMethod("put", () => {
      throw new Error("simulated settings write failure");
    });
    const errors: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args) => void errors.push(args);

    try {
      writeSetting("theme", "dark");
      await settle();
    } finally {
      restore();
      console.error = originalError;
    }

    expect(readSetting("theme")).toBe("dark");
    expect(errors[0]?.[0]).toContain("writeSetting theme failed");
    expect(await idbGet(STORE_META, "ui-settings")).toBeUndefined();
  });
});
