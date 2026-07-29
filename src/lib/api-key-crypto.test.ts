import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import {
  clearCanary,
  DeviceKeyPersistError,
  decryptApiKey,
  deriveKeyFromPassword,
  encryptApiKey,
  generateCanarySalt,
  getOrCreateDeviceKey,
  hasCanary,
  isEncryptedApiKey,
  PBKDF2_DEFAULT_ITERATIONS,
  readCanaryMeta,
  verifyCanary,
  writeCanary,
} from "./api-key-crypto";
import { __resetForTest } from "./idb";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTest();
});

describe("isEncryptedApiKey", () => {
  test("rejects strings, null, undefined, primitives", () => {
    expect(isEncryptedApiKey("plaintext")).toBe(false);
    expect(isEncryptedApiKey(null)).toBe(false);
    expect(isEncryptedApiKey(undefined)).toBe(false);
    expect(isEncryptedApiKey(42)).toBe(false);
  });

  test("accepts well-formed device and password secrets", () => {
    expect(isEncryptedApiKey({ v: 1, scheme: "device", iv: "x", ct: "y" })).toBe(true);
    expect(isEncryptedApiKey({ v: 1, scheme: "password", iv: "x", ct: "y" })).toBe(true);
  });

  test("rejects malformed objects", () => {
    expect(isEncryptedApiKey({ scheme: "device", iv: "x", ct: "y" })).toBe(false);
    expect(isEncryptedApiKey({ v: 2, scheme: "device", iv: "x", ct: "y" })).toBe(false);
    expect(isEncryptedApiKey({ v: 1, scheme: "bogus", iv: "x", ct: "y" })).toBe(false);
    expect(isEncryptedApiKey({ v: 1, scheme: "device", iv: 1, ct: "y" })).toBe(false);
  });
});

describe("encrypt/decrypt round-trip", () => {
  test("device scheme round-trips", async () => {
    const key = await getOrCreateDeviceKey();
    const secret = await encryptApiKey("hs_token_abc123", key, "device");
    expect(secret.v).toBe(1);
    expect(secret.scheme).toBe("device");
    expect(typeof secret.iv).toBe("string");
    expect(typeof secret.ct).toBe("string");
    expect(secret.iv).not.toEqual(secret.ct);
    expect(await decryptApiKey(secret, key)).toBe("hs_token_abc123");
  });

  test("password scheme round-trips", async () => {
    const salt = generateCanarySalt();
    const key = await deriveKeyFromPassword("correct horse battery staple", salt, 10_000);
    const secret = await encryptApiKey("hs_token_xyz", key, "password");
    expect(secret.scheme).toBe("password");
    expect(await decryptApiKey(secret, key)).toBe("hs_token_xyz");
  });

  test("each encrypt call produces a fresh IV", async () => {
    const key = await getOrCreateDeviceKey();
    const a = await encryptApiKey("same-plain", key, "device");
    const b = await encryptApiKey("same-plain", key, "device");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  test("decrypting with the wrong key throws", async () => {
    const right = await getOrCreateDeviceKey();
    const salt = generateCanarySalt();
    const wrong = await deriveKeyFromPassword("not-it", salt, 10_000);
    const secret = await encryptApiKey("secret", right, "device");
    await expect(decryptApiKey(secret, wrong)).rejects.toBeDefined();
  });
});

describe("getOrCreateDeviceKey", () => {
  // Subsequent calls clone the CryptoKey via IDB structured-clone, so reference equality
  // does not hold. The contract is that both keys decrypt material encrypted by the other.
  test("returns the same key material on repeated calls", async () => {
    const a = await getOrCreateDeviceKey();
    const b = await getOrCreateDeviceKey();
    const secret = await encryptApiKey("payload", a, "device");
    expect(await decryptApiKey(secret, b)).toBe("payload");
  });

  test("generated key is non-extractable", async () => {
    const key = await getOrCreateDeviceKey();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toBeDefined();
  });

  test("reports a persistence failure without losing its cause", async () => {
    const cause = new Error("simulated IndexedDB write failure");
    const descriptor = Object.getOwnPropertyDescriptor(IDBObjectStore.prototype, "put");
    Object.defineProperty(IDBObjectStore.prototype, "put", {
      configurable: true,
      value() {
        throw cause;
      },
    });

    let thrown: unknown;
    try {
      await getOrCreateDeviceKey();
    } catch (error) {
      thrown = error;
    } finally {
      if (descriptor) Object.defineProperty(IDBObjectStore.prototype, "put", descriptor);
    }

    expect(thrown).toBeInstanceOf(DeviceKeyPersistError);
    expect((thrown as DeviceKeyPersistError).name).toBe("DeviceKeyPersistError");
    expect((thrown as DeviceKeyPersistError).message).toBe(
      "Failed to persist device key to IndexedDB",
    );
    expect((thrown as Error & { cause?: unknown }).cause).toBe(cause);
  });

  test("does not invent a cause when none was supplied", () => {
    const error = new DeviceKeyPersistError();
    expect("cause" in error).toBe(false);
  });
});

describe("canary", () => {
  const ITER = 10_000;

  test("write + verify succeeds with the correct key", async () => {
    const salt = generateCanarySalt();
    const key = await deriveKeyFromPassword("hunter2", salt, ITER);
    await writeCanary(key, salt, ITER);
    expect(await hasCanary()).toBe(true);
    expect(await verifyCanary(key)).toBe(true);
  });

  test("verify returns false with a wrong passphrase", async () => {
    const salt = generateCanarySalt();
    const right = await deriveKeyFromPassword("hunter2", salt, ITER);
    const wrong = await deriveKeyFromPassword("password1", salt, ITER);
    await writeCanary(right, salt, ITER);
    expect(await verifyCanary(wrong)).toBe(false);
  });

  test("verify returns false when no canary is stored", async () => {
    const salt = generateCanarySalt();
    const key = await deriveKeyFromPassword("hunter2", salt, ITER);
    expect(await verifyCanary(key)).toBe(false);
  });

  test("readCanaryMeta exposes salt and iteration count", async () => {
    const salt = generateCanarySalt();
    const key = await deriveKeyFromPassword("hunter2", salt, ITER);
    await writeCanary(key, salt, ITER);
    const meta = await readCanaryMeta();
    expect(meta).not.toBeNull();
    expect(meta?.iterations).toBe(ITER);
    expect(Array.from(meta?.salt ?? [])).toEqual(Array.from(salt));
  });

  test("clearCanary removes the record", async () => {
    const salt = generateCanarySalt();
    const key = await deriveKeyFromPassword("hunter2", salt, ITER);
    await writeCanary(key, salt, ITER);
    await clearCanary();
    expect(await hasCanary()).toBe(false);
    expect(await readCanaryMeta()).toBeNull();
  });

  test("default iteration count matches OWASP recommendation", () => {
    expect(PBKDF2_DEFAULT_ITERATIONS).toBe(310_000);
  });
});
