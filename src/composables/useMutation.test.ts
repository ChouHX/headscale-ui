import { beforeEach, describe, expect, test } from "bun:test";
import { resetAllSingletons } from "./__testing";
import { useHeadscaleClient } from "./useHeadscaleClient";
import { useMutation } from "./useMutation";
import { useSnapshot } from "./useSnapshot";

beforeEach(resetAllSingletons);

describe("useMutation", () => {
  test("runs against the active client and refreshes after success", async () => {
    const snapshot = useSnapshot();
    snapshot.isAuthorized.value = true;
    let refreshes = 0;
    snapshot.setOnApplySnapshot(() => void refreshes++);
    const expectedClient = useHeadscaleClient().mockClient;

    const result = await useMutation().mutateWith("create-member", async (client) => {
      expect(client).toBe(expectedClient);
      return 42;
    });

    expect(result).toEqual({ ok: true, result: 42 });
    expect(refreshes).toBe(1);
  });

  test("can skip refresh and reports mutation failures as false", async () => {
    const snapshot = useSnapshot();
    snapshot.isAuthorized.value = true;
    let refreshes = 0;
    snapshot.setOnApplySnapshot(() => void refreshes++);
    const mutation = useMutation({ skipRefresh: true });

    expect(await mutation.mutate("rename-member", async () => undefined)).toBe(true);
    expect(refreshes).toBe(0);
    expect(
      await mutation.mutate("delete-member", async () => {
        throw new Error("denied");
      }),
    ).toBe(false);
  });
});
