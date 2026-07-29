import { beforeEach, describe, expect, test } from "bun:test";
import { RestHeadscaleClient } from "@/api/headscale-client";
import { MockHeadscaleClient } from "@/api/mock-headscale-client";
import { headscaleClientTestingHandle, useHeadscaleClient } from "./useHeadscaleClient";

beforeEach(() => {
  headscaleClientTestingHandle.reset();
});

describe("useHeadscaleClient", () => {
  test("reuses its mock client until the test singleton is reset", () => {
    const first = useHeadscaleClient();

    expect(first.settings).toEqual({
      mode: "mock",
      baseUrl: "http://127.0.0.1:8080",
      apiKey: "mock-api-key",
    });
    expect(first.createClient()).toBe(first.mockClient);
    expect(first.createClient()).toBeInstanceOf(MockHeadscaleClient);
    expect(useHeadscaleClient()).toBe(first);

    headscaleClientTestingHandle.reset();
    expect(useHeadscaleClient()).not.toBe(first);
  });

  test("updates the live settings and builds REST clients from live or override settings", () => {
    const api = useHeadscaleClient();
    const live = {
      mode: "real" as const,
      baseUrl: "https://headscale.example.test",
      apiKey: "live-key",
    };

    api.setSettings(live);

    expect(api.settings).toEqual(live);
    expect(api.createClient()).toBeInstanceOf(RestHeadscaleClient);
    expect(
      api.createClient({
        mode: "real",
        baseUrl: "https://override.example.test",
        apiKey: "override-key",
      }),
    ).toBeInstanceOf(RestHeadscaleClient);
    expect(
      api.createClient({
        mode: "mock",
        baseUrl: "https://ignored.example.test",
        apiKey: "ignored-key",
      }),
    ).toBe(api.mockClient);
  });
});
