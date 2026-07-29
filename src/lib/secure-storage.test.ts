import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { __resetForTest, idbGetAll, idbPut, STORE_KEYS, STORE_META, STORE_PROFILES } from "./idb";
import { clearAllSecureData } from "./secure-storage";

function memoryStore(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTest();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memoryStore(),
  });
});

async function seedEveryStore(): Promise<void> {
  await idbPut(STORE_PROFILES, { id: "profile-a" });
  await idbPut(STORE_KEYS, "device-key", "key-a");
  await idbPut(STORE_META, "metadata", "meta-a");
}

describe("clearAllSecureData", () => {
  test("clears every IDB store and only owned session keys", async () => {
    await seedEveryStore();
    sessionStorage.setItem("headscale-ui-tab-id", "tab-a");
    sessionStorage.setItem("headscale-ui-session", "session-a");
    sessionStorage.setItem("other-app-session", "keep-me");

    await clearAllSecureData();

    expect(await idbGetAll(STORE_PROFILES)).toEqual([]);
    expect(await idbGetAll(STORE_KEYS)).toEqual([]);
    expect(await idbGetAll(STORE_META)).toEqual([]);
    expect(sessionStorage.getItem("headscale-ui-tab-id")).toBeNull();
    expect(sessionStorage.getItem("headscale-ui-session")).toBeNull();
    expect(sessionStorage.getItem("other-app-session")).toBe("keep-me");
  });

  test("still clears IDB when sessionStorage is unavailable", async () => {
    await seedEveryStore();
    Reflect.deleteProperty(globalThis, "sessionStorage");

    await clearAllSecureData();

    expect(await idbGetAll(STORE_PROFILES)).toEqual([]);
    expect(await idbGetAll(STORE_KEYS)).toEqual([]);
    expect(await idbGetAll(STORE_META)).toEqual([]);
  });
});
