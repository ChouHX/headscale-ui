import { beforeEach, describe, expect, test } from "bun:test";
import { createRenderer, defineComponent } from "vue";
import type { HeadscaleNode, HeadscaleUser } from "@/api/types";
import { i18n } from "@/i18n";
import { useDisplayHelpers } from "./useDisplayHelpers";

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

function node(overrides: Partial<HeadscaleNode> = {}): HeadscaleNode {
  return {
    id: "node-1",
    ipAddresses: [],
    name: "node-1",
    online: false,
    approvedRoutes: [],
    availableRoutes: [],
    subnetRoutes: [],
    tags: [],
    ...overrides,
  };
}

beforeEach(() => {
  (i18n.global.locale as unknown as { value: string }).value = "en-US";
});

describe("useDisplayHelpers", () => {
  test("binds shared display utilities to the active English copy", () => {
    const helpers = mountComposable(useDisplayHelpers);
    const user: HeadscaleUser = { id: "user-1", name: "alice", displayName: "Alice" };

    expect(helpers.formatDate(undefined)).toBe("Never");
    expect(helpers.userLabel(undefined)).toBe("Unknown");
    expect(helpers.nodeDisplayName(node({ name: "raw-host", givenName: "renamed-host" }))).toBe(
      "renamed-host",
    );
    expect(helpers.nodeOwner(node({ user }))).toBe("Alice");
    expect(helpers.nodeStatusLabel(node({ online: true }))).toBe("Online");
    expect(helpers.shortSecret(undefined)).toBe("Unknown");
    expect(helpers.hasVisibleUser(user)).toBe(true);
    expect(helpers.isTagManagedDeviceUser({ id: "tagged", name: "tagged-devices" })).toBe(true);
  });

  test("reports used, expired, and ready auth keys", () => {
    const { keyStatus } = mountComposable(useDisplayHelpers);

    expect(keyStatus({ used: true })).toBe("Used");
    expect(keyStatus({ used: false, expiration: "2000-01-01T00:00:00.000Z" })).toBe("Disconnected");
    expect(keyStatus({ used: false, expiration: "2999-01-01T00:00:00.000Z" })).toBe("Ready");
  });
});
