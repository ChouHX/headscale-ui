import { beforeEach, describe, expect, test } from "bun:test";
import { actionFeedbackTestingHandle, useActionFeedback } from "./useActionFeedback";

beforeEach(() => actionFeedbackTestingHandle.reset());

describe("useActionFeedback", () => {
  test("shares state and exposes empty feedback by default", () => {
    const feedback = useActionFeedback();

    expect(useActionFeedback()).toBe(feedback);
    expect(feedback.isActionPending("create-member")).toBe(false);
    expect(feedback.actionError("create-member")).toBe("");

    feedback.actionErrors["create-member"] = "stale";
    feedback.clearActionFeedback("create-member");
    expect(feedback.actionError("create-member")).toBe("");
  });

  test("returns a result and rejects re-entry while an action is pending", async () => {
    const feedback = useActionFeedback();
    let resolveAction!: (value: number) => void;
    const action = new Promise<number>((resolve) => {
      resolveAction = resolve;
    });

    const pending = feedback.runAction("create-member", () => action);
    expect(feedback.isActionPending("create-member")).toBe(true);
    expect(await feedback.runAction("create-member", async () => 99)).toEqual({ ok: false });

    resolveAction(42);
    expect(await pending).toEqual({ ok: true, result: 42 });
    expect(feedback.isActionPending("create-member")).toBe(false);
  });

  test("maps thrown values, supports a custom mapper, and clears stale errors", async () => {
    const feedback = useActionFeedback();

    expect(
      await feedback.runAction("create-member", async () => {
        throw new Error("failed");
      }),
    ).toEqual({ ok: false });
    expect(feedback.actionError("create-member")).toBe("failed");
    expect(feedback.lastError.value).toBe("failed");

    await feedback.runAction("delete-member", async () => {
      throw 404;
    });
    expect(feedback.actionError("delete-member")).toBe("404");

    feedback.setErrorMapper(() => "friendly");
    await feedback.runAction("rename-member", async () => {
      throw new Error("hidden");
    });
    expect(feedback.actionError("rename-member")).toBe("friendly");

    expect(await feedback.runAction("rename-member", async () => "ok")).toEqual({
      ok: true,
      result: "ok",
    });
    expect(feedback.actionError("rename-member")).toBe("");
    expect(feedback.lastError.value).toBe("");
  });
});
