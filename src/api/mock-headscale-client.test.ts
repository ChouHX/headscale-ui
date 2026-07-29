import { describe, expect, test } from "bun:test";
import { createInitialSnapshot, MockHeadscaleClient } from "./mock-headscale-client";

describe("createInitialSnapshot", () => {
  test("returns a complete, isolated demo topology", () => {
    const first = createInitialSnapshot();
    const second = createInitialSnapshot();

    expect(first.version).toEqual({ version: "0.28.0" });
    expect(first.users).toHaveLength(3);
    expect(first.preAuthKeys).toHaveLength(2);
    expect(first.nodes).toHaveLength(3);
    expect(first.apiKeys).toHaveLength(2);
    expect(JSON.parse(first.policy?.policy ?? "{}")).toMatchObject({
      groups: { "group:ops": ["alice@example.com"] },
      tagOwners: { "tag:server": ["alice@"] },
    });

    first.users[0].name = "changed-only-in-first";
    expect(second.users[0].name).toBe("alice");
  });
});

describe("MockHeadscaleClient connection metadata", () => {
  test("refreshes health and supplies defaults for missing metadata", async () => {
    const client = new MockHeadscaleClient();
    const health = await client.health();
    expect(health.databaseConnectivity).toBe(true);
    expect(health.serverReachable).toBe(true);
    expect(health.latencyMs).toBe(32);
    expect(Number.isNaN(Date.parse(health.checkedAt ?? ""))).toBe(false);
    expect(await client.version()).toEqual({ version: "0.28.0" });

    client.snapshot.health = null;
    client.snapshot.version = null;
    expect((await client.health()).databaseConnectivity).toBe(false);
    expect(await client.version()).toEqual({ version: "unknown" });
  });
});

describe("MockHeadscaleClient users", () => {
  test("filters users and persists explicit and default creation fields", async () => {
    const client = new MockHeadscaleClient();

    expect((await client.listUsers({})).users).toHaveLength(3);
    expect((await client.listUsers({ id: "2" })).users.map((user) => user.name)).toEqual([
      "tagged-devices",
    ]);
    expect((await client.listUsers({ name: "lic" })).users.map((user) => user.name)).toEqual([
      "alice",
    ]);
    expect((await client.listUsers({ email: "charlie@" })).users.map((user) => user.name)).toEqual([
      "charlie",
    ]);

    const explicit = (
      await client.createUser({
        name: "tester",
        displayName: "Test User",
        email: "tester@example.test",
        pictureUrl: "https://assets.example.test/avatar.png",
      })
    ).user;
    expect(explicit).toMatchObject({
      id: "4",
      name: "tester",
      displayName: "Test User",
      email: "tester@example.test",
      profilePicUrl: "https://assets.example.test/avatar.png",
      provider: "cli",
    });
    expect(client.snapshot.users.at(-1)).toBe(explicit);

    const defaults = (await client.createUser({ name: true })).user;
    expect(defaults).toMatchObject({
      id: "5",
      name: "user-5",
      displayName: "",
      email: "",
      profilePicUrl: "",
    });
  });

  test("renames existing users, rejects unknown users, and protects ownership", async () => {
    const client = new MockHeadscaleClient();
    const user = (await client.createUser({ name: "temporary" })).user;

    expect((await client.renameUser({ id: user.id, newName: "renamed" })).user.name).toBe(
      "renamed",
    );
    await expect(client.renameUser({ id: "999", newName: "unused" })).rejects.toThrow(
      "User not found",
    );
    await expect(client.deleteUser({ id: "1" })).rejects.toThrow(
      "User still owns machines or auth keys",
    );

    await client.deleteUser({ id: user.id });
    expect(client.snapshot.users.some((item) => item.id === user.id)).toBe(false);
    await expect(client.deleteUser({ id: "999" })).resolves.toEqual({});
  });
});

describe("MockHeadscaleClient pre-auth keys", () => {
  test("lists, creates, expires, and deletes keys with their ownership and options", async () => {
    const client = new MockHeadscaleClient();
    expect((await client.listPreAuthKeys()).preAuthKeys).toHaveLength(2);

    const created = (
      await client.createPreAuthKey({
        user: "2",
        reusable: true,
        ephemeral: true,
        expiration: "2030-01-01T00:00:00Z",
        aclTags: "tag:test, tag:service",
      })
    ).preAuthKey;
    expect(created).toMatchObject({
      id: "3",
      user: { id: "2" },
      reusable: true,
      ephemeral: true,
      used: false,
      expiration: "2030-01-01T00:00:00Z",
      aclTags: ["tag:test", "tag:service"],
    });
    expect(created.key.startsWith("preauthkey-demo-")).toBe(true);

    const ownerless = (await client.createPreAuthKey({ user: "missing" })).preAuthKey;
    expect(ownerless.user).toBeUndefined();
    expect(ownerless.reusable).toBe(false);
    expect(ownerless.ephemeral).toBe(false);

    await client.expirePreAuthKey({ id: created.id });
    expect(Number.isNaN(Date.parse(created.expiration ?? ""))).toBe(false);
    await expect(client.expirePreAuthKey({ id: "999" })).resolves.toEqual({});

    await client.deletePreAuthKey({ id: created.id });
    expect(client.snapshot.preAuthKeys.some((key) => key.id === created.id)).toBe(false);
  });
});

describe("MockHeadscaleClient nodes", () => {
  test("filters and looks up nodes with missing-node errors", async () => {
    const client = new MockHeadscaleClient();
    expect((await client.listNodes({})).nodes).toHaveLength(3);
    expect((await client.listNodes({ user: "2" })).nodes.map((node) => node.id)).toEqual(["2"]);
    expect((await client.listNodes({ user: "tagged" })).nodes.map((node) => node.id)).toEqual([
      "2",
    ]);
    expect((await client.getNode({ nodeId: "1" })).node.name).toBe("alice-laptop");
    await expect(client.getNode({ nodeId: "999" })).rejects.toThrow("Node not found");
  });

  test("registers regular and debug nodes with safe defaults", async () => {
    const client = new MockHeadscaleClient();

    const registered = (await client.registerNode({ user: "2", key: "machine-test" })).node;
    expect(registered).toMatchObject({
      id: "4",
      name: "machine-test",
      givenName: "machine-test",
      user: { id: "2" },
      registerMethod: "REGISTER_METHOD_CLI",
      online: true,
    });
    expect(registered.ipAddresses).toEqual(["100.64.0.14"]);

    const defaultRegistered = (await client.registerNode({ user: "missing" })).node;
    expect(defaultRegistered.name).toBe("registered-node");
    expect(defaultRegistered.user?.id).toBe("1");

    const emailRegistered = (
      await client.registerNode({ user: "charlie@example.com", key: "email-owned-node" })
    ).node;
    expect(emailRegistered.user?.id).toBe("3");

    const debug = (
      await client.debugCreateNode({
        user: "tagged-devices",
        name: "debug-test",
        routes: ["192.0.2.0/24", "0.0.0.0/0", "::/0"],
      })
    ).node;
    expect(debug.user?.id).toBe("2");
    expect(debug.availableRoutes).toEqual(["192.0.2.0/24", "0.0.0.0/0", "::/0"]);
    expect(debug.subnetRoutes).toEqual(["192.0.2.0/24"]);

    const defaultDebug = (await client.debugCreateNode({ user: "missing" })).node;
    expect(defaultDebug.name).toBe("debug-node");
    expect(defaultDebug.user?.id).toBe("1");
    expect(defaultDebug.availableRoutes).toEqual([]);
  });

  test("renames, expires, tags, routes, backfills, and deletes nodes", async () => {
    const client = new MockHeadscaleClient();
    const node = (await client.debugCreateNode({ name: "mutable-node" })).node;

    const renamed = (await client.renameNode({ nodeId: node.id, newName: "renamed-node" })).node;
    expect(renamed.name).toBe("mutable-node");
    expect(renamed.givenName).toBe("renamed-node");

    const withoutExpiry = (await client.expireNode({ nodeId: node.id, disableExpiry: true })).node;
    expect(withoutExpiry.expiry).toBeUndefined();
    expect(withoutExpiry.online).toBe(true);

    const expired = (await client.expireNode({ nodeId: node.id, expiry: "2031-01-01T00:00:00Z" }))
      .node;
    expect(expired.expiry).toBe("2031-01-01T00:00:00Z");
    expect(expired.online).toBe(false);

    const fallbackExpiry = (await client.expireNode({ nodeId: "1" })).node;
    expect(Number.isNaN(Date.parse(fallbackExpiry.expiry ?? ""))).toBe(false);
    expect(fallbackExpiry.online).toBe(false);

    expect(
      (await client.setTags({ nodeId: node.id, tags: "tag:test,tag:service" })).node.tags,
    ).toEqual(["tag:test", "tag:service"]);
    expect(
      (await client.setApprovedRoutes({ nodeId: node.id, routes: ["192.0.2.0/24"] })).node
        .approvedRoutes,
    ).toEqual(["192.0.2.0/24"]);
    expect(await client.backfillNodeIps({})).toEqual({
      changes: ["100.64.0.88 reserved for backfilled node"],
    });

    await client.deleteNode({ nodeId: node.id });
    expect(client.snapshot.nodes.some((item) => item.id === node.id)).toBe(false);
    await expect(client.renameNode({ nodeId: "999", newName: "unused" })).rejects.toThrow(
      "Node not found",
    );
  });
});

describe("MockHeadscaleClient API keys and policy", () => {
  test("lists, creates, expires, and deletes API keys by prefix or ID", async () => {
    const client = new MockHeadscaleClient();
    expect((await client.listApiKeys()).apiKeys).toHaveLength(2);

    const secret = (await client.createApiKey({ expiration: "2030-01-01T00:00:00Z" })).apiKey;
    expect(secret.startsWith("ak_demo_3.")).toBe(true);
    expect(client.snapshot.apiKeys.at(-1)).toMatchObject({
      id: "3",
      prefix: "ak_demo_3",
      expiration: "2030-01-01T00:00:00Z",
    });

    await client.expireApiKey({ prefix: "ak_demo_3" });
    expect(Number.isNaN(Date.parse(client.snapshot.apiKeys.at(-1)?.expiration ?? ""))).toBe(false);
    await client.expireApiKey({ id: "1" });
    expect(Number.isNaN(Date.parse(client.snapshot.apiKeys[0].expiration ?? ""))).toBe(false);
    await expect(client.expireApiKey({ id: "999" })).resolves.toEqual({});
    await expect(client.expireApiKey({})).rejects.toThrow("API key prefix or ID is required");

    await client.deleteApiKey({ prefix: "ak_demo_3" });
    expect(client.snapshot.apiKeys.some((key) => key.prefix === "ak_demo_3")).toBe(false);
    await client.deleteApiKey({ prefix: "not-a-prefix", id: "2" });
    expect(client.snapshot.apiKeys.map((key) => key.id)).toEqual(["1", "2"]);
    await client.deleteApiKey({ prefix: "not-a-prefix" });
    expect(client.snapshot.apiKeys.map((key) => key.id)).toEqual(["1", "2"]);
    await expect(client.deleteApiKey({ id: "2" })).rejects.toThrow("API key prefix is required");
  });

  test("reads, replaces, and defaults policy state", async () => {
    const client = new MockHeadscaleClient();
    expect(JSON.parse((await client.getPolicy()).policy).acls).toHaveLength(1);

    const saved = await client.setPolicy({ policy: '{"acls":[]}' });
    expect(saved.policy).toBe('{"acls":[]}');
    expect(Number.isNaN(Date.parse(saved.updatedAt ?? ""))).toBe(false);
    expect(await client.getPolicy()).toBe(saved);

    client.snapshot.policy = null;
    expect(await client.getPolicy()).toEqual({ policy: "", updatedAt: undefined });
  });
});
