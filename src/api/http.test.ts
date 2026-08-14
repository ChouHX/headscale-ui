import { describe, expect, test } from "bun:test";
import { explainHeadscaleError } from "./http";

describe("Headscale HTTP error explanations", () => {
  test("explains an empty file policy path", () => {
    expect(
      explainHeadscaleError('reading policy from path "": open : no such file or directory'),
    ).toBe(
      "Headscale ACL policy is misconfigured: policy.path is empty. Set policy.mode to database in the Headscale config, then restart Headscale.",
    );
  });

  test("preserves unrelated server errors", () => {
    expect(explainHeadscaleError("database connectivity failed")).toBe(
      "database connectivity failed",
    );
  });
});
