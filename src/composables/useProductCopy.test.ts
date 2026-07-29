import { beforeEach, describe, expect, test } from "bun:test";
import { createRenderer, defineComponent } from "vue";
import { i18n } from "@/i18n";
import { useProductCopy } from "./useProductCopy";

function mountComposable<T>(setup: () => T): T {
  let result: T | undefined;
  const renderer = createRenderer({
    patchProp() {},
    insert() {},
    remove() {},
    createElement: () => ({}),
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setElementText() {},
    parentNode: () => null,
    nextSibling: () => null,
  });
  const app = renderer.createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => null;
      },
    }),
  );
  app.use(i18n);
  app.mount({});
  if (result === undefined) throw new Error("Composable setup did not run");
  return result;
}

beforeEach(() => {
  (i18n.global.locale as unknown as { value: string }).value = "en-US";
});

describe("useProductCopy", () => {
  test("tracks the product copy for the active locale", () => {
    const { copy } = mountComposable(useProductCopy);

    expect(copy.value.nav.devices).toBe("Machines");
    (i18n.global.locale as unknown as { value: string }).value = "zh-Hans";
    expect(copy.value.nav.devices).toBe("设备");
  });
});
