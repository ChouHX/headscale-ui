import { beforeEach, describe, expect, test } from "bun:test";
import { resetAllSingletons } from "./__testing";
import { useRefreshGuard } from "./useRefreshGuard";

beforeEach(resetAllSingletons);

describe("useRefreshGuard", () => {
  test("only applies the latest refresh epoch and cancel invalidates it", async () => {
    const guard = useRefreshGuard();
    const applied: string[] = [];
    const stale = guard.next();
    const current = guard.next();

    await guard.refresh(stale, () => applied.push("stale"));
    await guard.refresh(current, () => applied.push("current"));
    guard.cancel();
    await guard.refresh(current, () => applied.push("cancelled"));

    expect(applied).toEqual(["current"]);
  });
});
