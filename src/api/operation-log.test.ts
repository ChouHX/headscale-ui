import { expect, test } from "bun:test";
import { recordOperationCall } from "./operation-log";

function restoreEnvironment(name: "DEV" | "MODE", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("records calls only in development or test browsers", () => {
  const originalDev = process.env.DEV;
  const originalMode = process.env.MODE;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  try {
    const browserWindow = { __headscaleUiOperationCalls: [] } as unknown as Window &
      typeof globalThis;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: browserWindow,
    });

    process.env.DEV = "";
    process.env.MODE = "production";
    recordOperationCall("health.check", "GET", "/api/v1/health", {});
    expect(window.__headscaleUiOperationCalls).toEqual([]);

    process.env.MODE = "test";
    recordOperationCall("version.get", "GET", "/version", { source: "test" });
    expect(window.__headscaleUiOperationCalls).toEqual([
      { id: "version.get", method: "GET", url: "/version", payload: { source: "test" } },
    ]);

    process.env.MODE = "production";
    process.env.DEV = "1";
    recordOperationCall("user.list", "GET", "/api/v1/user", {});
    expect(window.__headscaleUiOperationCalls).toHaveLength(2);

    Reflect.deleteProperty(globalThis, "window");
    expect(() => recordOperationCall("health.check", "GET", "/api/v1/health", {})).not.toThrow();
  } finally {
    restoreEnvironment("DEV", originalDev);
    restoreEnvironment("MODE", originalMode);
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
