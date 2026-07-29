import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { IDBFactory } from "fake-indexeddb";
import { createRenderer, nextTick } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { i18n } from "@/i18n";
import { __resetForTest } from "@/lib/idb";
import {
  type ConnectionProfile,
  hydrate,
  profileStorage,
  profileStorageTestingHandle,
} from "@/lib/profile-storage";
import { actionFeedbackTestingHandle, useActionFeedback } from "./useActionFeedback";
import { headscaleClientTestingHandle, useHeadscaleClient } from "./useHeadscaleClient";
import { masterPasswordTestingHandle, useMasterPassword } from "./useMasterPassword";
import { policyDesignerTestingHandle, usePolicyDesigner } from "./usePolicyDesigner";
import { profilesTestingHandle, useProfiles } from "./useProfiles";
import { useSessionRestore } from "./useSessionRestore";
import { snapshotTestingHandle, useSnapshot } from "./useSnapshot";

const memoryStore = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, String(value)),
  };
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetForTest();
  profileStorageTestingHandle.reset();
  masterPasswordTestingHandle.reset();
  actionFeedbackTestingHandle.reset();
  headscaleClientTestingHandle.reset();
  policyDesignerTestingHandle.reset();
  profilesTestingHandle.reset();
  snapshotTestingHandle.reset();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: memoryStore(),
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStore(),
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout(callback: () => void) {
        queueMicrotask(callback);
        return 1;
      },
    },
  });
});

async function prepareStorage() {
  const masterPassword = useMasterPassword();
  await masterPassword.initialize();
  await hydrate({ encryptLegacy: (plain) => masterPassword.encryptWithDeviceKey(plain) });
  return masterPassword;
}

async function saveProfile(id: string) {
  const profile: ConnectionProfile = {
    id,
    name: `Profile ${id}`,
    mode: "mock",
    baseUrl: "http://127.0.0.1:8080",
    apiKey: await useMasterPassword().encryptApiKey(`${id}-key`),
    updatedAt: new Date().toISOString(),
    scope: "persistent",
  };
  profileStorage.saveProfile(profile, "persistent");
  await new Promise((resolve) => setTimeout(resolve, 5));
  return profile;
}

async function createTestRouter(initial: string) {
  const component = { render: () => null };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/login", name: "login", component, meta: { requiresAuth: false } },
      { path: "/public", name: "public", component, meta: { requiresAuth: false } },
      { path: "/secure", name: "secure", component, meta: { requiresAuth: true } },
      { path: "/secure-two", name: "secure-two", component, meta: { requiresAuth: true } },
    ],
  });
  await router.push(initial);
  await router.isReady();
  return router;
}

function mountSessionRestore(router: Router) {
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
  const app = renderer.createApp({
    setup() {
      useSessionRestore();
      return () => null;
    },
  });
  app.use(i18n);
  app.use(router);
  app.mount({});
  return app;
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("condition was not reached");
}

describe("useSessionRestore", () => {
  test("restores a profile and wires policy, errors, route refresh, and logout", async () => {
    await prepareStorage();
    const profile = await saveProfile("active");
    profileStorage.setActiveProfile(profile.id, "persistent");
    const router = await createTestRouter("/secure");
    const app = mountSessionRestore(router);

    const snapshot = useSnapshot();
    const profiles = useProfiles();
    const policy = usePolicyDesigner();
    const feedback = useActionFeedback();
    await waitFor(() => snapshot.isAuthorized.value && !profiles.isRestoringSession.value);

    expect(profileStorage.readActiveProfile()).toBe(profile.id);
    expect(snapshot.snapshot.value.users).toHaveLength(3);
    expect(policy.policyDraft.value).toContain('"acls"');

    snapshot.applyPatch({ policy: null });
    expect(policy.policyDraft.value).toBe("");
    const failed = await feedback.runAction("save-policy", async () => {
      throw new Error("Node not found");
    });
    expect(failed).toEqual({ ok: false });
    expect(feedback.lastError.value).not.toBe("");

    let refreshes = 0;
    const refreshSnapshot = snapshot.refreshSnapshot;
    snapshot.refreshSnapshot = async () => {
      refreshes += 1;
      await refreshSnapshot();
    };
    await router.push({ name: "secure-two" });
    await nextTick();
    await waitFor(() => refreshes === 1);
    await router.push({ name: "public" });
    await nextTick();
    expect(refreshes).toBe(1);

    profiles.logout();
    await waitFor(() => router.currentRoute.value.name === "login");
    expect(snapshot.isAuthorized.value).toBe(false);
    expect(snapshot.snapshot.value.health?.serverReachable).toBe(false);
    app.unmount();
  });

  test("finishes restoration without navigation when no profile was requested or active", async () => {
    await prepareStorage();
    const router = await createTestRouter("/public");
    const app = mountSessionRestore(router);
    const profiles = useProfiles();

    await waitFor(() => !profiles.isRestoringSession.value);

    expect(router.currentRoute.value.name).toBe("public");
    expect(useSnapshot().isAuthorized.value).toBe(false);
    app.unmount();
  });

  test("does not start a second restoration when authorization already exists", async () => {
    await prepareStorage();
    const router = await createTestRouter("/secure");
    useSnapshot().isAuthorized.value = true;
    const app = mountSessionRestore(router);
    const profiles = useProfiles();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(profiles.isRestoringSession.value).toBe(true);
    expect(router.currentRoute.value.name).toBe("secure");
    app.unmount();
  });

  test("ignores a stale active ID on a public route", async () => {
    await prepareStorage();
    profileStorage.setActiveProfile("missing", "persistent");
    const router = await createTestRouter("/public");
    const app = mountSessionRestore(router);

    await waitFor(() => !useProfiles().isRestoringSession.value);

    expect(router.currentRoute.value.name).toBe("public");
    expect(useSnapshot().isAuthorized.value).toBe(false);
    app.unmount();
  });

  test("redirects when a URL-requested profile does not exist", async () => {
    await prepareStorage();
    const router = await createTestRouter("/public?profile=missing-from-url");
    const app = mountSessionRestore(router);

    await waitFor(() => router.currentRoute.value.name === "login");

    expect(useProfiles().isRestoringSession.value).toBe(false);
    expect(useSnapshot().isAuthorized.value).toBe(false);
    app.unmount();
  });

  test("redirects an authenticated route when restoring its profile fails", async () => {
    await prepareStorage();
    const profile = await saveProfile("failing");
    profileStorage.setActiveProfile(profile.id, "persistent");
    useHeadscaleClient().mockClient.health = async () => {
      throw "restore failed";
    };
    const router = await createTestRouter("/secure");
    const app = mountSessionRestore(router);

    await waitFor(() => router.currentRoute.value.name === "login");

    expect(useProfiles().isRestoringSession.value).toBe(false);
    expect(useActionFeedback().lastError.value).toBe("restore failed");
    expect(useSnapshot().isAuthorized.value).toBe(false);
    app.unmount();
  });
});
