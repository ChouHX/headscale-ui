import { describe, expect, test } from "bun:test";
import type { HeadscaleUser } from "@/api/types";
import { PrincipalIndex, toPrincipal } from "./principal";

function makeUser(over: Partial<HeadscaleUser>): HeadscaleUser {
  return {
    id: "1",
    name: "",
    displayName: "",
    email: "",
    providerId: "",
    provider: "",
    createdAt: "",
    profilePicUrl: "",
    ...over,
  } as HeadscaleUser;
}

describe("toPrincipal", () => {
  test("normalizes whitespace and case", () => {
    expect(toPrincipal("  Alice@Example.COM  ")).toBe("alice@example.com");
    expect(toPrincipal("Bob")).toBe("bob");
  });
});

describe("PrincipalIndex", () => {
  test("trims whitespace but keeps Headscale's case-sensitive matching", () => {
    const index = new PrincipalIndex(["Alice@Example.COM", "  bob  "]);
    expect(index.has("alice@example.com")).toBe(false);
    expect(index.has(" Alice@Example.COM ")).toBe(true);
    expect(index.has("BOB")).toBe(false);
    expect(index.has(" bob ")).toBe(true);
    expect(index.has("carol")).toBe(false);
  });

  test("ignores empty strings", () => {
    const index = new PrincipalIndex(["", "alice@example.com", ""]);
    expect(index.has("")).toBe(false);
    expect(index.has("alice@example.com")).toBe(true);
  });

  test("fromUsers harvests both email and name", () => {
    const index = PrincipalIndex.fromUsers([
      makeUser({ email: "alice@example.com", name: "alice" }),
      makeUser({ email: "", name: "bob" }),
      makeUser({ email: "carol@example.com", name: "" }),
    ]);
    expect(index.has("ALICE@example.com")).toBe(false);
    expect(index.has("alice@example.com")).toBe(true);
    expect(index.has("alice")).toBe(true);
    expect(index.has("BOB")).toBe(false);
    expect(index.has("bob@")).toBe(true);
    expect(index.has("carol@example.com")).toBe(true);
    expect(index.has("nobody")).toBe(false);
  });

  test("fromUsers recognizes email, name, and name@ aliases", () => {
    const index = PrincipalIndex.fromUsers([
      makeUser({ email: " Alice@Example.COM ", name: " Alice " }),
      makeUser({ email: "", name: " corp " }),
    ]);

    expect(index.has("Alice@Example.COM")).toBe(true);
    expect(index.has("Alice@Example.COM@")).toBe(true);
    expect(index.has(" Alice ")).toBe(true);
    expect(index.has(" Alice@ ")).toBe(true);
    expect(index.has("alice@example.com")).toBe(false);
    expect(index.has("CORP@")).toBe(false);
    expect(index.has("corp@")).toBe(true);
    expect(index.has("corp@@")).toBe(false);
    expect(index.has("ghost@")).toBe(false);
  });

  test("fromUsers mirrors Headscale v0.28 suffix resolution and exact provider identifiers", () => {
    const index = PrincipalIndex.fromUsers([
      makeUser({
        email: "alice@example.com",
        name: "alice@idp.example",
        providerId: "https://idp.example/Subject",
      }),
      makeUser({ name: "bob", providerId: "urn:bob@idp" }),
    ]);

    expect(index.has("alice@idp.example")).toBe(true);
    expect(index.has("alice@idp.example@")).toBe(true);
    expect(index.has("alice@example.com@")).toBe(true);
    expect(index.has("https://idp.example/Subject@")).toBe(true);
    expect(index.has("https://idp.example/subject@")).toBe(false);
    expect(index.has("urn:bob@idp")).toBe(true);
    expect(index.has("urn:bob@idp@")).toBe(true);
  });
});
