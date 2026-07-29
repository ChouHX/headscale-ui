import { recordOperationCall } from "./operation-log";
import { parseList } from "./payload";
import type {
  ApiKey,
  HeadscaleClient,
  HeadscaleNode,
  HeadscaleSnapshot,
  HeadscaleUser,
  OperationPayload,
  PolicyResponse,
  PreAuthKey,
} from "./types";

function nowIso() {
  return new Date().toISOString();
}

function stringValue(payload: OperationPayload, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function booleanValue(payload: OperationPayload, key: string) {
  return payload[key] === true;
}

function nextId(items: Array<{ id: string }>) {
  const max = items.reduce((current, item) => Math.max(current, Number(item.id) || 0), 0);
  return String(max + 1);
}

function defaultPolicy() {
  return JSON.stringify(
    {
      acls: [{ action: "accept", src: ["*"], dst: ["*:*"] }],
      groups: { "group:ops": ["alice@example.com"] },
      tagOwners: { "tag:server": ["alice@"] },
      autoApprovers: { routes: { "10.42.0.0/16": ["alice@"] } },
      ssh: [{ action: "accept", src: ["group:ops"], dst: ["tag:server"], users: ["root"] }],
    },
    null,
    2,
  );
}

export function createInitialSnapshot(): HeadscaleSnapshot {
  const users: HeadscaleUser[] = [
    {
      id: "1",
      name: "alice",
      displayName: "Alice Ops",
      email: "alice@example.com",
      provider: "cli",
      createdAt: "2026-02-04T09:00:00Z",
    },
    {
      id: "2",
      name: "tagged-devices",
      provider: "system",
      createdAt: "2026-02-04T09:00:00Z",
    },
    {
      id: "3",
      name: "charlie",
      displayName: "Charlie",
      email: "charlie@example.com",
      providerId: "oidc",
      createdAt: "2026-02-04T09:30:00Z",
    },
  ];

  const preAuthKeys: PreAuthKey[] = [
    {
      id: "1",
      key: "preauthkey-demo-alice",
      user: users[0],
      reusable: true,
      ephemeral: false,
      used: false,
      expiration: "2026-12-31T23:59:00Z",
      createdAt: "2026-02-04T10:00:00Z",
      aclTags: ["tag:server"],
    },
    {
      id: "2",
      key: "preauthkey-demo-once",
      user: users[2],
      reusable: false,
      ephemeral: true,
      used: true,
      expiration: "2026-03-01T00:00:00Z",
      createdAt: "2026-02-04T10:15:00Z",
      aclTags: [],
    },
  ];

  const nodes: HeadscaleNode[] = [
    {
      id: "1",
      name: "alice-laptop",
      givenName: "alice-laptop",
      ipAddresses: ["100.64.0.1", "fd7a:115c:a1e0::1"],
      user: users[0],
      online: true,
      lastSeen: "2026-05-04T02:00:00Z",
      expiry: "2026-12-31T23:59:00Z",
      registerMethod: "REGISTER_METHOD_AUTH_KEY",
      approvedRoutes: [],
      availableRoutes: [],
      subnetRoutes: [],
      tags: ["tag:workstation"],
    },
    {
      id: "2",
      name: "edge-router",
      givenName: "edge-router",
      ipAddresses: ["100.64.0.2", "fd7a:115c:a1e0::2"],
      user: users[1],
      online: false,
      lastSeen: "2026-05-03T21:00:00Z",
      expiry: "2026-12-31T23:59:00Z",
      registerMethod: "REGISTER_METHOD_CLI",
      approvedRoutes: ["10.42.0.0/16"],
      availableRoutes: ["10.42.0.0/16", "0.0.0.0/0", "::/0"],
      subnetRoutes: ["10.42.0.0/16"],
      tags: ["tag:server"],
    },
    {
      id: "3",
      name: "old-phone",
      givenName: "old-phone",
      ipAddresses: ["100.64.0.3"],
      user: users[2],
      online: false,
      lastSeen: "2026-04-20T12:00:00Z",
      expiry: "2026-04-21T00:00:00Z",
      registerMethod: "REGISTER_METHOD_OIDC",
      approvedRoutes: [],
      availableRoutes: ["192.168.88.0/24"],
      subnetRoutes: [],
      tags: [],
    },
  ];

  return {
    health: {
      checkedAt: nowIso(),
      databaseConnectivity: true,
      latencyMs: 32,
      serverReachable: true,
    },
    version: { version: "0.28.0" },
    users,
    preAuthKeys,
    nodes,
    apiKeys: [
      {
        id: "1",
        prefix: "ak_live_demo",
        createdAt: "2026-02-04T11:00:00Z",
        expiration: "2026-12-31T23:59:00Z",
        lastSeen: "2026-05-04T01:30:00Z",
      },
      {
        id: "2",
        prefix: "ak_old_demo",
        createdAt: "2026-02-04T11:30:00Z",
        expiration: "2026-06-01T00:00:00Z",
      },
    ],
    policy: {
      policy: defaultPolicy(),
      updatedAt: "2026-02-04T12:00:00Z",
    },
  };
}

export class MockHeadscaleClient implements HeadscaleClient {
  readonly snapshot: HeadscaleSnapshot;

  constructor() {
    this.snapshot = createInitialSnapshot();
  }

  async health() {
    recordOperationCall("health.check", "GET", "/api/v1/health", {});
    const nextHealth = {
      checkedAt: nowIso(),
      databaseConnectivity: this.snapshot.health?.databaseConnectivity ?? false,
      latencyMs: 32,
      serverReachable: true,
    };
    this.snapshot.health = nextHealth;
    return nextHealth;
  }

  async version() {
    recordOperationCall("version.get", "GET", "/version", {});
    return this.snapshot.version ?? { version: "unknown" };
  }

  async listUsers(payload: OperationPayload) {
    recordOperationCall("user.list", "GET", "/api/v1/user", payload);
    const id = stringValue(payload, "id");
    const name = stringValue(payload, "name");
    const email = stringValue(payload, "email");
    const users = this.snapshot.users.filter((user) => {
      return (
        (!id || user.id === id) &&
        (!name || user.name.includes(name)) &&
        (!email || user.email?.includes(email))
      );
    });
    return { users };
  }

  async createUser(payload: OperationPayload) {
    const user: HeadscaleUser = {
      id: nextId(this.snapshot.users),
      name: stringValue(payload, "name") || `user-${this.snapshot.users.length + 1}`,
      displayName: stringValue(payload, "displayName"),
      email: stringValue(payload, "email"),
      profilePicUrl: stringValue(payload, "pictureUrl"),
      provider: "cli",
      createdAt: nowIso(),
    };
    recordOperationCall("user.create", "POST", "/api/v1/user", payload);
    this.snapshot.users.push(user);
    return { user };
  }

  async renameUser(payload: OperationPayload) {
    recordOperationCall("user.rename", "POST", "/api/v1/user/{old_id}/rename/{new_name}", payload);
    const user = this.snapshot.users.find((item) => item.id === stringValue(payload, "id"));
    if (!user) {
      throw new Error("User not found");
    }
    user.name = stringValue(payload, "newName");
    return { user };
  }

  async deleteUser(payload: OperationPayload) {
    recordOperationCall("user.delete", "DELETE", "/api/v1/user/{id}", payload);
    const userId = stringValue(payload, "id");
    const ownsNodes = this.snapshot.nodes.some((node) => node.user?.id === userId);
    const ownsAuthKeys = this.snapshot.preAuthKeys.some((key) => key.user?.id === userId);
    if (ownsNodes || ownsAuthKeys) {
      await new Promise((resolve) => setTimeout(resolve, 160));
      throw new Error("User still owns machines or auth keys. Remove them before deleting.");
    }

    this.snapshot.users = this.snapshot.users.filter((user) => user.id !== userId);
    return {};
  }

  async listPreAuthKeys() {
    recordOperationCall("preauthkey.list", "GET", "/api/v1/preauthkey", {});
    return { preAuthKeys: this.snapshot.preAuthKeys };
  }

  async createPreAuthKey(payload: OperationPayload) {
    const user = this.snapshot.users.find((item) => item.id === stringValue(payload, "user"));
    const preAuthKey: PreAuthKey = {
      id: nextId(this.snapshot.preAuthKeys),
      key: `preauthkey-demo-${crypto.randomUUID().slice(0, 8)}`,
      user,
      reusable: booleanValue(payload, "reusable"),
      ephemeral: booleanValue(payload, "ephemeral"),
      used: false,
      expiration: stringValue(payload, "expiration"),
      createdAt: nowIso(),
      aclTags: parseList(payload.aclTags),
    };
    recordOperationCall("preauthkey.create", "POST", "/api/v1/preauthkey", payload);
    this.snapshot.preAuthKeys.push(preAuthKey);
    return { preAuthKey };
  }

  async expirePreAuthKey(payload: OperationPayload) {
    recordOperationCall("preauthkey.expire", "POST", "/api/v1/preauthkey/expire", payload);
    const key = this.snapshot.preAuthKeys.find((item) => item.id === stringValue(payload, "id"));
    if (key) {
      key.expiration = nowIso();
    }
    return {};
  }

  async deletePreAuthKey(payload: OperationPayload) {
    recordOperationCall("preauthkey.delete", "DELETE", "/api/v1/preauthkey", payload);
    this.snapshot.preAuthKeys = this.snapshot.preAuthKeys.filter(
      (key) => key.id !== stringValue(payload, "id"),
    );
    return {};
  }

  async listNodes(payload: OperationPayload) {
    recordOperationCall("node.list", "GET", "/api/v1/node", payload);
    const userFilter = stringValue(payload, "user");
    const nodes = this.snapshot.nodes.filter((node) => {
      return !userFilter || node.user?.id === userFilter || node.user?.name.includes(userFilter);
    });
    return { nodes };
  }

  async getNode(payload: OperationPayload) {
    recordOperationCall("node.get", "GET", "/api/v1/node/{node_id}", payload);
    const node = this.findNode(payload);
    return { node };
  }

  async registerNode(payload: OperationPayload) {
    recordOperationCall("node.register", "POST", "/api/v1/node/register", payload);
    const user = this.findUser(stringValue(payload, "user")) ?? this.snapshot.users[0];
    const node = this.createNode(user, stringValue(payload, "key") || "registered-node");
    this.snapshot.nodes.push(node);
    return { node };
  }

  async debugCreateNode(payload: OperationPayload) {
    recordOperationCall("node.debugCreate", "POST", "/api/v1/debug/node", payload);
    const user = this.findUser(stringValue(payload, "user")) ?? this.snapshot.users[0];
    const node = this.createNode(user, stringValue(payload, "name") || "debug-node");
    node.availableRoutes = parseList(payload.routes);
    node.subnetRoutes = node.availableRoutes.filter((route) => !route.includes("/0"));
    this.snapshot.nodes.push(node);
    return { node };
  }

  async renameNode(payload: OperationPayload) {
    recordOperationCall("node.rename", "POST", "/api/v1/node/{node_id}/rename/{new_name}", payload);
    const node = this.findNode(payload);
    node.givenName = stringValue(payload, "newName");
    return { node };
  }

  async expireNode(payload: OperationPayload) {
    recordOperationCall("node.expire", "POST", "/api/v1/node/{node_id}/expire", payload);
    const node = this.findNode(payload);
    if (booleanValue(payload, "disableExpiry")) {
      node.expiry = undefined;
      return { node };
    }
    node.expiry = stringValue(payload, "expiry") || nowIso();
    node.online = false;
    return { node };
  }

  async deleteNode(payload: OperationPayload) {
    recordOperationCall("node.delete", "DELETE", "/api/v1/node/{node_id}", payload);
    this.snapshot.nodes = this.snapshot.nodes.filter(
      (node) => node.id !== stringValue(payload, "nodeId"),
    );
    return {};
  }

  async setTags(payload: OperationPayload) {
    recordOperationCall("node.setTags", "POST", "/api/v1/node/{node_id}/tags", payload);
    const node = this.findNode(payload);
    node.tags = parseList(payload.tags);
    return { node };
  }

  async setApprovedRoutes(payload: OperationPayload) {
    recordOperationCall(
      "node.setApprovedRoutes",
      "POST",
      "/api/v1/node/{node_id}/approve_routes",
      payload,
    );
    const node = this.findNode(payload);
    node.approvedRoutes = parseList(payload.routes);
    return { node };
  }

  async backfillNodeIps(payload: OperationPayload) {
    recordOperationCall("node.backfillIps", "POST", "/api/v1/node/backfillips", payload);
    return { changes: ["100.64.0.88 reserved for backfilled node"] };
  }

  async listApiKeys() {
    recordOperationCall("apikey.list", "GET", "/api/v1/apikey", {});
    return { apiKeys: this.snapshot.apiKeys };
  }

  async createApiKey(payload: OperationPayload) {
    const id = nextId(this.snapshot.apiKeys);
    const apiKey: ApiKey = {
      id,
      prefix: `ak_demo_${id}`,
      createdAt: nowIso(),
      expiration: stringValue(payload, "expiration"),
    };
    recordOperationCall("apikey.create", "POST", "/api/v1/apikey", payload);
    this.snapshot.apiKeys.push(apiKey);
    return { apiKey: `${apiKey.prefix}.${crypto.randomUUID()}` };
  }

  async expireApiKey(payload: OperationPayload) {
    const prefix = stringValue(payload, "prefix");
    const id = stringValue(payload, "id");
    if (!prefix && !id) throw new Error("API key prefix or ID is required");
    const identifier = prefix ? { prefix } : { id };
    recordOperationCall("apikey.expire", "POST", "/api/v1/apikey/expire", identifier);
    const key = this.findApiKey(identifier);
    if (key) {
      key.expiration = nowIso();
    }
    return {};
  }

  async deleteApiKey(payload: OperationPayload) {
    const prefix = stringValue(payload, "prefix");
    if (!prefix) throw new Error("API key prefix is required");
    recordOperationCall("apikey.delete", "DELETE", "/api/v1/apikey/{prefix}", { prefix });
    this.snapshot.apiKeys = this.snapshot.apiKeys.filter((key) => key.prefix !== prefix);
    return {};
  }

  async getPolicy() {
    recordOperationCall("policy.get", "GET", "/api/v1/policy", {});
    return this.snapshot.policy ?? { policy: "", updatedAt: undefined };
  }

  async setPolicy(payload: OperationPayload) {
    recordOperationCall("policy.set", "PUT", "/api/v1/policy", payload);
    const policy: PolicyResponse = {
      policy: stringValue(payload, "policy"),
      updatedAt: nowIso(),
    };
    this.snapshot.policy = policy;
    return policy;
  }

  private findNode(payload: OperationPayload) {
    const node = this.snapshot.nodes.find((item) => item.id === stringValue(payload, "nodeId"));
    if (!node) {
      throw new Error("Node not found");
    }

    return node;
  }

  private findUser(value: string) {
    return this.snapshot.users.find(
      (item) => item.id === value || item.name === value || item.email === value,
    );
  }

  private findApiKey(payload: OperationPayload) {
    const prefix = stringValue(payload, "prefix");
    const id = stringValue(payload, "id");
    return this.snapshot.apiKeys.find((key) => key.prefix === prefix || (id && key.id === id));
  }

  private createNode(user: HeadscaleUser, name: string): HeadscaleNode {
    const id = nextId(this.snapshot.nodes);
    return {
      id,
      name,
      givenName: name,
      ipAddresses: [`100.64.0.${Number(id) + 10}`],
      user,
      online: true,
      lastSeen: nowIso(),
      expiry: "2026-12-31T23:59:00Z",
      registerMethod: "REGISTER_METHOD_CLI",
      approvedRoutes: [],
      availableRoutes: [],
      subnetRoutes: [],
      tags: [],
    };
  }
}
