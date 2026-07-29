import { describe, expect, test } from "bun:test";
import { emptyState } from "./policy-designer";
import { applyTemplate, POLICY_TEMPLATES, type PolicyTemplate } from "./policy-templates";

describe("policy templates", () => {
  test("builds every supported template with independent policy objects", () => {
    expect(POLICY_TEMPLATES.map((template) => template.id)).toEqual([
      "self-only",
      "small-team",
      "split-env",
    ]);

    const selfOnly = POLICY_TEMPLATES[0].build();
    expect(
      selfOnly.rules?.map(({ source, destination, ports }) => ({ source, destination, ports })),
    ).toEqual([{ source: "*", destination: "tag:personal", ports: "*" }]);
    expect(selfOnly.groups).toEqual([]);
    expect(selfOnly.tagOwners?.map(({ tag, owners }) => ({ tag, owners }))).toEqual([
      { tag: "tag:personal", owners: [] },
    ]);

    const smallTeam = POLICY_TEMPLATES[1].build();
    expect(smallTeam.groups?.map((group) => group.name)).toEqual(["group:team"]);
    expect(smallTeam.tagOwners?.map(({ tag, owners }) => ({ tag, owners }))).toEqual([
      { tag: "tag:shared", owners: [{ kind: "group", value: "group:team" }] },
    ]);
    expect(smallTeam.rules?.[0]).toMatchObject({
      source: "group:team",
      destination: "tag:shared",
      ports: "22,80,443",
    });

    const splitEnv = POLICY_TEMPLATES[2].build();
    expect(splitEnv.groups?.map((group) => group.name)).toEqual(["group:dev", "group:ops"]);
    expect(splitEnv.tagOwners?.map((owner) => owner.tag)).toEqual([
      "tag:dev-server",
      "tag:prod-server",
    ]);
    expect(
      splitEnv.rules?.map(({ source, destination, ports }) => ({ source, destination, ports })),
    ).toEqual([
      { source: "group:dev", destination: "tag:dev-server", ports: "22,80,443" },
      {
        source: "group:ops",
        destination: "tag:dev-server,tag:prod-server",
        ports: "*",
      },
    ]);

    expect(POLICY_TEMPLATES[2].build().groups?.[0]?.id).not.toBe(splitEnv.groups?.[0]?.id);
  });

  test("appends template content while preserving existing state and optional omissions", () => {
    const state = emptyState();
    state.extras = { hosts: { demo: "192.0.2.10" } };

    const merged = applyTemplate(state, POLICY_TEMPLATES[1]);
    expect(merged.rules).toHaveLength(state.rules.length + 1);
    expect(merged.groups.map((group) => group.name)).toEqual(["group:team"]);
    expect(merged.tagOwners.map((owner) => owner.tag)).toEqual(["tag:shared"]);
    expect(merged.extras).toBe(state.extras);
    expect(state.groups).toEqual([]);

    const emptyTemplate: PolicyTemplate = {
      id: "self-only",
      titleKey: "unusedTitle",
      descriptionKey: "unusedDescription",
      build: () => ({}),
    };
    expect(applyTemplate(state, emptyTemplate)).toEqual(state);
  });
});
