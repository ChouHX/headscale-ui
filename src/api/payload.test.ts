import { describe, expect, test } from "bun:test";
import type { OperationField } from "@/domain/headscale-operations";
import { compactPayload, createDefaultPayload, parseList } from "./payload";

describe("parseList", () => {
  test("accepts string arrays while removing non-string and blank items", () => {
    expect(parseList(["tag:test", "  ", true, " tag:second "])).toEqual([
      "tag:test",
      " tag:second ",
    ]);
  });

  test("splits and trims comma- or newline-delimited text", () => {
    expect(parseList("tag:first, tag:second\ntag:third\n")).toEqual([
      "tag:first",
      "tag:second",
      "tag:third",
    ]);
  });

  test("returns an empty list for unsupported values", () => {
    expect(parseList(undefined)).toEqual([]);
    expect(parseList(false)).toEqual([]);
  });
});

test("createDefaultPayload respects declared defaults and field types", () => {
  const fields: OperationField[] = [
    { name: "name", label: "Name", type: "text", defaultValue: "demo" },
    { name: "routes", label: "Routes", type: "list", defaultValue: "192.0.2.0/24" },
    { name: "enabled", label: "Enabled", type: "checkbox", defaultValue: true },
    { name: "optional", label: "Optional", type: "text" },
    { name: "reusable", label: "Reusable", type: "checkbox" },
  ];

  expect(createDefaultPayload(fields)).toEqual({
    name: "demo",
    routes: "192.0.2.0/24",
    enabled: true,
    optional: "",
    reusable: false,
  });
});

test("compactPayload removes only empty and undefined values", () => {
  expect(
    compactPayload({
      empty: "",
      missing: undefined,
      disabled: false,
      enabled: true,
      name: "demo",
      tags: [],
    }),
  ).toEqual({ disabled: false, enabled: true, name: "demo", tags: [] });
});
