import { describe, expect, test } from "bun:test";
import type { HeadscaleNode, HeadscaleUser, PreAuthKey } from "@/api/types";
import { englishCopy, type ProductCopy } from "@/i18n/product-copy";
import { csvCell, downloadCsv } from "./csv";
import { mapErrorToCopy } from "./error-mapping";
import { formatDate } from "./format";
import { nodeDisplayName, nodeOwner, nodePendingRoutes, nodeStatusLabel } from "./node";
import {
  approvedRouteClass,
  deviceTagClass,
  isExitRoute,
  keyEphemeralClass,
  keyKindClass,
  keyStatusClass,
  keyTagClass,
  nodeStatusClass,
  pendingRouteClass,
} from "./status-class";
import { normalizedBaseUrl, shortSecret } from "./strings";
import { hasVisibleUser, isTagManagedDeviceUser, userLabel } from "./user";

function buildUser(overrides: Partial<HeadscaleUser> = {}): HeadscaleUser {
  return { id: "user-a", name: "user-a", ...overrides };
}

function buildNode(overrides: Partial<HeadscaleNode> = {}): HeadscaleNode {
  return {
    id: "node-a",
    ipAddresses: ["100.64.0.1"],
    name: "node-a",
    online: false,
    approvedRoutes: [],
    availableRoutes: [],
    subnetRoutes: [],
    tags: [],
    ...overrides,
  };
}

function buildKey(overrides: Partial<PreAuthKey> = {}): PreAuthKey {
  return {
    id: "key-a",
    key: "test-key",
    reusable: false,
    ephemeral: false,
    used: false,
    aclTags: [],
    ...overrides,
  };
}

describe("CSV", () => {
  test("quotes every cell and escapes embedded quotes", () => {
    expect(csvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(false)).toBe('"false"');
    expect(csvCell(0)).toBe('"0"');
  });

  test("downloads the rendered CSV and revokes its object URL", async () => {
    let blob: Blob | undefined;
    let revokedUrl = "";
    let clicks = 0;
    const link = {
      download: "",
      href: "",
      click: () => void clicks++,
    };
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => link },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (value: Blob) => {
        blob = value;
        return "blob:test-csv";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: (value: string) => {
        revokedUrl = value;
      },
    });

    try {
      downloadCsv("devices.csv", [
        { name: 'A "quoted" device', active: true, count: 2 },
        { name: "Second", active: undefined, count: 3 },
      ]);
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, "document", documentDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
    }

    expect(link.download).toBe("devices.csv");
    expect(link.href).toBe("blob:test-csv");
    expect(clicks).toBe(1);
    expect(revokedUrl).toBe("blob:test-csv");
    expect(blob?.type).toBe("text/csv;charset=utf-8");
    expect(await blob?.text()).toBe(
      '"name","active","count"\n"A ""quoted"" device","true","2"\n"Second","","3"',
    );
  });

  test("uses a stable header for an empty export", async () => {
    let blob: Blob | undefined;
    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { createElement: () => ({ href: "", download: "", click() {} }) },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (value: Blob) => {
        blob = value;
        return "blob:empty-csv";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value() {} });

    try {
      downloadCsv("empty.csv", []);
    } finally {
      if (documentDescriptor) {
        Object.defineProperty(globalThis, "document", documentDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
    }

    expect(await blob?.text()).toBe('"empty"');
  });
});

describe("error mapping", () => {
  const copy: ProductCopy = {
    ...englishCopy,
    errorUserNotFound: "localized user missing",
    errorUserStillOwns: "localized user owns resources",
    errorNodeNotFound: "localized node missing",
    errorRequestFailed: "localized request failed",
  };

  test("maps every known English API error into product copy", () => {
    expect(mapErrorToCopy(new Error(englishCopy.errorUserNotFound), copy)).toBe(
      copy.errorUserNotFound,
    );
    expect(mapErrorToCopy(new Error(englishCopy.errorUserStillOwns), copy)).toBe(
      copy.errorUserStillOwns,
    );
    expect(mapErrorToCopy(new Error(englishCopy.errorNodeNotFound), copy)).toBe(
      copy.errorNodeNotFound,
    );
    expect(mapErrorToCopy(new Error(englishCopy.errorRequestFailed), copy)).toBe(
      copy.errorRequestFailed,
    );
  });

  test("preserves unknown Error messages and non-Error values", () => {
    expect(mapErrorToCopy(new Error("unknown failure"), copy)).toBe("unknown failure");
    expect(mapErrorToCopy("plain failure", copy)).toBe("plain failure");
  });
});

describe("date formatting", () => {
  test("uses the fallback for empty values and preserves invalid input", () => {
    expect(formatDate(undefined, "en-US", "Never")).toBe("Never");
    expect(formatDate("not-a-date", "en-US", "Never")).toBe("not-a-date");
  });

  test("formats valid values with the requested locale", () => {
    const value = "2024-01-02T03:04:00.000Z";
    const expected = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
    expect(formatDate(value, "en-US", "Never")).toBe(expected);
  });
});

describe("node display helpers", () => {
  test("prefers the administrator-assigned name over the original hostname", () => {
    expect(nodeDisplayName(buildNode({ name: "raw-host", givenName: "renamed-host" }))).toBe(
      "renamed-host",
    );
    expect(nodeDisplayName(buildNode({ name: "raw-host" }))).toBe("raw-host");
  });

  test("returns only routes awaiting approval", () => {
    expect(
      nodePendingRoutes(
        buildNode({
          availableRoutes: ["10.0.0.0/24", "10.1.0.0/24"],
          approvedRoutes: ["10.0.0.0/24"],
        }),
      ),
    ).toEqual(["10.1.0.0/24"]);
  });

  test("hides absent and tag-managed owners, otherwise resolves their label", () => {
    expect(nodeOwner(buildNode(), "Unknown")).toBe("");
    expect(nodeOwner(buildNode({ user: buildUser({ name: "tagged-devices" }) }), "Unknown")).toBe(
      "",
    );
    expect(
      nodeOwner(buildNode({ user: buildUser({ displayName: "Visible User" }) }), "Unknown"),
    ).toBe("Visible User");
  });

  test("selects labels for online, offline, and expired nodes", () => {
    const labels = { online: "Online", offline: "Offline", expired: "Expired" };
    expect(nodeStatusLabel(buildNode({ online: true }), labels)).toBe("Online");
    expect(nodeStatusLabel(buildNode(), labels)).toBe("Offline");
    expect(
      nodeStatusLabel(buildNode({ expiry: new Date(Date.now() - 60_000).toISOString() }), labels),
    ).toBe("Expired");
  });
});

describe("status classes", () => {
  test("recognizes both exit-route forms", () => {
    expect(isExitRoute("0.0.0.0/0")).toBe(true);
    expect(isExitRoute("::/0")).toBe(true);
    expect(isExitRoute("10.0.0.0/24")).toBe(false);
  });

  test("maps all node states", () => {
    expect(nodeStatusClass(buildNode({ online: true }))).toContain("emerald");
    expect(nodeStatusClass(buildNode())).toContain("slate");
    expect(
      nodeStatusClass(buildNode({ expiry: new Date(Date.now() - 60_000).toISOString() })),
    ).toContain("rose");
  });

  test("maps auth-key status and kind", () => {
    expect(keyStatusClass(buildKey({ used: true }))).toContain("sky");
    expect(
      keyStatusClass(buildKey({ expiration: new Date(Date.now() - 60_000).toISOString() })),
    ).toContain("rose");
    expect(keyStatusClass(buildKey())).toContain("emerald");
    expect(keyKindClass(buildKey({ reusable: true }))).toContain("teal");
    expect(keyKindClass(buildKey())).toContain("violet");
    expect(keyEphemeralClass()).toContain("amber");
  });

  test("distinguishes approved, pending subnet, and pending exit routes", () => {
    expect(approvedRouteClass()).toContain("emerald");
    expect(pendingRouteClass("10.0.0.0/24")).toContain("amber");
    expect(pendingRouteClass("::/0")).toContain("rose");
  });

  test("maps device tag keywords and falls back for unknown tags", () => {
    expect(deviceTagClass("tag:server")).toContain("cyan");
    expect(deviceTagClass("tag:workstation")).toContain("fuchsia");
    expect(deviceTagClass("tag:desktop")).toContain("fuchsia");
    expect(deviceTagClass("tag:mobile")).toContain("pink");
    expect(deviceTagClass("tag:phone")).toContain("pink");
    expect(deviceTagClass("tag:db")).toContain("indigo");
    expect(deviceTagClass("tag:database")).toContain("indigo");
    expect(deviceTagClass("tag:unknown")).toContain("emerald");
  });

  test("uses the narrower auth-key tag palette", () => {
    expect(keyTagClass("tag:server")).toContain("cyan");
    expect(keyTagClass("tag:mobile")).toContain("pink");
    expect(keyTagClass("tag:db")).toContain("indigo");
    expect(keyTagClass("tag:desktop")).toContain("slate");
  });
});

describe("string helpers", () => {
  test("normalizes whitespace and one trailing slash", () => {
    expect(normalizedBaseUrl("  https://example.invalid/  ")).toBe("https://example.invalid");
    expect(normalizedBaseUrl("https://example.invalid//")).toBe("https://example.invalid/");
  });

  test("uses a fallback, preserves short secrets, and truncates long ones", () => {
    expect(shortSecret(undefined, "Unavailable")).toBe("Unavailable");
    expect(shortSecret("short-value", "Unavailable")).toBe("short-value");
    expect(shortSecret("abcdefghijklmnopqrstuvwx", "Unavailable")).toBe("abcdefghijkl...uvwx");
  });
});

describe("user helpers", () => {
  test("identifies tag-managed users and visible users", () => {
    const tagged = buildUser({ name: "tagged-devices" });
    const visible = buildUser();
    expect(isTagManagedDeviceUser()).toBe(false);
    expect(isTagManagedDeviceUser(tagged)).toBe(true);
    expect(isTagManagedDeviceUser(visible)).toBe(false);
    expect(hasVisibleUser()).toBe(false);
    expect(hasVisibleUser(tagged)).toBe(false);
    expect(hasVisibleUser(visible)).toBe(true);
  });

  test("uses display name, name, email, then fallback in order", () => {
    expect(
      userLabel(buildUser({ displayName: "Display", email: "email@example.invalid" }), "X"),
    ).toBe("Display");
    expect(userLabel(buildUser({ name: "Name", email: "email@example.invalid" }), "X")).toBe(
      "Name",
    );
    expect(userLabel(buildUser({ name: "", email: "email@example.invalid" }), "X")).toBe(
      "email@example.invalid",
    );
    expect(userLabel(buildUser({ name: "", email: "" }), "Fallback")).toBe("Fallback");
    expect(userLabel(undefined, "Fallback")).toBe("Fallback");
  });
});
