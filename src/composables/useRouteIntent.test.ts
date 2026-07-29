import { describe, expect, test } from "bun:test";
import { createRenderer, defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { useRouteIntent } from "./useRouteIntent";

function mountIntent(router: ReturnType<typeof createRouter>) {
  let result: ReturnType<typeof useRouteIntent> | undefined;
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
        result = useRouteIntent();
        return () => null;
      },
    }),
  );
  app.use(router);
  app.mount({});
  if (result === undefined) throw new Error("Composable setup did not run");
  return result;
}

describe("useRouteIntent", () => {
  test("narrows the cross-page query protocol and rejects malformed values", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/devices", component: { render: () => null } }],
    });
    await router.push(
      "/devices?from=home&popup=node&user=user-1&node=node-1&search=alpha&profile=profile-1",
    );
    const intent = mountIntent(router);

    expect({
      from: intent.from.value,
      popup: intent.popup.value,
      user: intent.userId.value,
      node: intent.nodeId.value,
      search: intent.search.value,
      profile: intent.profileId.value,
    }).toEqual({
      from: "home",
      popup: "node",
      user: "user-1",
      node: "node-1",
      search: "alpha",
      profile: "profile-1",
    });

    await router.replace({
      path: "/devices",
      query: {
        from: "elsewhere",
        popup: "",
        user: ["one", "two"],
        node: null,
        search: "",
      },
    });
    expect({
      from: intent.from.value,
      popup: intent.popup.value,
      user: intent.userId.value,
      node: intent.nodeId.value,
      search: intent.search.value,
      profile: intent.profileId.value,
    }).toEqual({ from: null, popup: null, user: null, node: null, search: null, profile: null });
  });
});
