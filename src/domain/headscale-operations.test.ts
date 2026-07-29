import { describe, expect, test } from "bun:test";
import { HEADSCALE_OPERATIONS, OPERATION_IDS } from "./headscale-operations";

describe("headscale operation registry", () => {
  test("keeps operation ids unique and all entries executable", () => {
    expect(new Set(OPERATION_IDS).size).toBe(OPERATION_IDS.length);
    expect(HEADSCALE_OPERATIONS.every((operation) => operation.path.length > 0)).toBe(true);
    expect(HEADSCALE_OPERATIONS.every((operation) => operation.method.length > 0)).toBe(true);
  });

  test("matches the exact Headscale v0.28 REST contract plus the version endpoint", () => {
    expect(HEADSCALE_OPERATIONS.map(({ id, method, path }) => ({ id, method, path }))).toEqual([
      { id: "health.check", method: "GET", path: "/api/v1/health" },
      { id: "version.get", method: "GET", path: "/version" },
      { id: "user.list", method: "GET", path: "/api/v1/user" },
      { id: "user.create", method: "POST", path: "/api/v1/user" },
      {
        id: "user.rename",
        method: "POST",
        path: "/api/v1/user/{old_id}/rename/{new_name}",
      },
      { id: "user.delete", method: "DELETE", path: "/api/v1/user/{id}" },
      { id: "preauthkey.list", method: "GET", path: "/api/v1/preauthkey" },
      { id: "preauthkey.create", method: "POST", path: "/api/v1/preauthkey" },
      { id: "preauthkey.expire", method: "POST", path: "/api/v1/preauthkey/expire" },
      {
        id: "preauthkey.delete",
        method: "DELETE",
        path: "/api/v1/preauthkey?id={id}",
      },
      { id: "node.list", method: "GET", path: "/api/v1/node" },
      { id: "node.get", method: "GET", path: "/api/v1/node/{node_id}" },
      { id: "node.register", method: "POST", path: "/api/v1/node/register" },
      { id: "node.debugCreate", method: "POST", path: "/api/v1/debug/node" },
      {
        id: "node.rename",
        method: "POST",
        path: "/api/v1/node/{node_id}/rename/{new_name}",
      },
      { id: "node.expire", method: "POST", path: "/api/v1/node/{node_id}/expire" },
      { id: "node.delete", method: "DELETE", path: "/api/v1/node/{node_id}" },
      { id: "node.setTags", method: "POST", path: "/api/v1/node/{node_id}/tags" },
      {
        id: "node.setApprovedRoutes",
        method: "POST",
        path: "/api/v1/node/{node_id}/approve_routes",
      },
      { id: "node.backfillIps", method: "POST", path: "/api/v1/node/backfillips" },
      { id: "apikey.list", method: "GET", path: "/api/v1/apikey" },
      { id: "apikey.create", method: "POST", path: "/api/v1/apikey" },
      { id: "apikey.expire", method: "POST", path: "/api/v1/apikey/expire" },
      { id: "apikey.delete", method: "DELETE", path: "/api/v1/apikey/{prefix}" },
      { id: "policy.get", method: "GET", path: "/api/v1/policy" },
      { id: "policy.set", method: "PUT", path: "/api/v1/policy" },
    ]);
  });

  test("does not expose policy editing as a raw JSON payload field", () => {
    const policySet = HEADSCALE_OPERATIONS.find((operation) => operation.id === "policy.set");

    expect(policySet).toBeDefined();
    expect(policySet?.fields).toEqual([]);
    expect(JSON.stringify(HEADSCALE_OPERATIONS)).not.toContain('"textarea"');
  });

  test("uses usernames for node registration contracts", () => {
    for (const id of ["node.register", "node.debugCreate"] as const) {
      const operation = HEADSCALE_OPERATIONS.find((candidate) => candidate.id === id);
      const user = operation?.fields.find((field) => field.name === "user");

      expect(user?.label).toBe("Username");
      expect(user?.defaultValue).toBe("alice");
    }
  });

  test("identifies API keys with exactly one supported selector", () => {
    const expire = HEADSCALE_OPERATIONS.find((operation) => operation.id === "apikey.expire");
    const remove = HEADSCALE_OPERATIONS.find((operation) => operation.id === "apikey.delete");

    expect(expire?.description).toContain("prefix or ID");
    expect(expire?.fields.map((field) => field.name)).toEqual(["prefix", "id"]);
    expect(remove?.description).toBe("Delete an API key by prefix.");
    expect(remove?.fields.map((field) => field.name)).toEqual(["prefix"]);
  });
});
