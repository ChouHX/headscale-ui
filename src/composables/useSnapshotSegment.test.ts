import { beforeEach, describe, expect, test } from "bun:test";
import { resetAllSingletons } from "./__testing";
import { useSegment } from "./useSnapshotSegment";

beforeEach(resetAllSingletons);

describe("useSegment", () => {
  test("tracks a segment refresh until the snapshot request settles", async () => {
    const segment = useSegment("identity", "policy");

    const pending = segment.refresh();
    expect(segment.isRefreshing.value).toBe(true);
    await pending;
    expect(segment.isRefreshing.value).toBe(false);
  });
});
