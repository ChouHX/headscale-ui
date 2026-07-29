import { type ComputedRef, computed, type Ref, reactive, ref } from "vue";
import type {
  HeadscaleClient,
  HeadscaleNode,
  HeadscaleSnapshot,
  HeadscaleUser,
  PreAuthKey,
} from "@/api/types";
import { isTimestampExpired } from "@/domain/node-status";
import { nodeDisplayName } from "@/utils/node";
import { useActionFeedback } from "./useActionFeedback";
import { useHeadscaleClient } from "./useHeadscaleClient";

type ApplySnapshotHook = (next: HeadscaleSnapshot) => void;

export type SnapshotSegment = "identity" | "fabric" | "policy";

export const ALL_SEGMENTS: readonly SnapshotSegment[] = ["identity", "fabric", "policy"];

interface UseSnapshotReturn {
  snapshot: Ref<HeadscaleSnapshot>;
  isAuthorized: Ref<boolean>;
  isRefreshing: ComputedRef<boolean>;
  refreshSnapshotInFlight: Ref<number>;
  renameDrafts: Record<string, string>;
  onlineNodes: ComputedRef<HeadscaleNode[]>;
  openInvites: ComputedRef<PreAuthKey[]>;
  routeNodes: ComputedRef<HeadscaleNode[]>;
  /** Find a node by id in the current snapshot (returns `undefined` if absent). */
  nodeById(id: string): HeadscaleNode | undefined;
  /** Find a user by id in the current snapshot (returns `undefined` if absent). */
  userById(id: string): HeadscaleUser | undefined;
  applySnapshot(next: HeadscaleSnapshot): void;
  applyPatch(patch: Partial<HeadscaleSnapshot>): void;
  applyOfflineHealth(): void;
  refreshSnapshot(): Promise<void>;
  refreshSegments(segments: readonly SnapshotSegment[]): Promise<void>;
  setOnApplySnapshot(hook: ApplySnapshotHook | null): void;
}

let instance: UseSnapshotReturn | null = null;

/** Internal: invoked by `__testing.ts` only. */
export const snapshotTestingHandle = {
  reset() {
    instance = null;
  },
};

const SEGMENT_FETCHERS: Record<
  SnapshotSegment,
  (client: HeadscaleClient) => Promise<Partial<HeadscaleSnapshot>>
> = {
  identity: async (client) => {
    const [users, preAuthKeys, apiKeys] = await Promise.all([
      client.listUsers({}),
      client.listPreAuthKeys(),
      client.listApiKeys(),
    ]);
    return {
      users: users.users,
      preAuthKeys: preAuthKeys.preAuthKeys,
      apiKeys: apiKeys.apiKeys,
    };
  },
  fabric: async (client) => {
    const [health, version, nodes] = await Promise.all([
      client.health(),
      client.version(),
      client.listNodes({}),
    ]);
    return { health, version, nodes: nodes.nodes };
  },
  policy: async (client) => {
    const policy = await client.getPolicy();
    return { policy };
  },
};

export async function fetchSegments(
  client: HeadscaleClient,
  segments: readonly SnapshotSegment[],
): Promise<Partial<HeadscaleSnapshot>> {
  const parts = await Promise.all(segments.map((s) => SEGMENT_FETCHERS[s](client)));
  return Object.assign({}, ...parts);
}

export async function fetchSnapshot(client: HeadscaleClient): Promise<HeadscaleSnapshot> {
  const merged = await fetchSegments(client, ALL_SEGMENTS);
  return merged as HeadscaleSnapshot;
}

export function useSnapshot(): UseSnapshotReturn {
  if (instance) return instance;

  const { mockClient, createClient } = useHeadscaleClient();
  const { lastError } = useActionFeedback();

  const snapshot = ref<HeadscaleSnapshot>(mockClient.snapshot);
  const isAuthorized = ref(false);
  const refreshSnapshotInFlight = ref(0);
  const renameDrafts = reactive<Record<string, string>>({});

  const isRefreshing = computed(() => refreshSnapshotInFlight.value > 0);
  const onlineNodes = computed(() => snapshot.value.nodes.filter((node) => node.online));
  const openInvites = computed(() =>
    snapshot.value.preAuthKeys.filter((key) => !key.used && !isTimestampExpired(key.expiration)),
  );
  const routeNodes = computed(() =>
    snapshot.value.nodes.filter(
      (node) => node.availableRoutes.length > 0 || node.approvedRoutes.length > 0,
    ),
  );

  let onApplySnapshot: ApplySnapshotHook | null = null;

  function applyPatch(patch: Partial<HeadscaleSnapshot>) {
    snapshot.value = { ...snapshot.value, ...patch };
    if (patch.nodes) {
      // Reset rename drafts to the fresh node set: drop entries for deleted nodes
      // and replace all values in a single reactive flush.
      for (const key of Object.keys(renameDrafts)) delete renameDrafts[key];
      for (const node of patch.nodes) {
        renameDrafts[node.id] = nodeDisplayName(node);
      }
    }
    onApplySnapshot?.(snapshot.value);
  }

  function applySnapshot(nextSnapshot: HeadscaleSnapshot) {
    applyPatch(nextSnapshot);
  }

  function applyOfflineHealth() {
    snapshot.value = {
      ...snapshot.value,
      health: {
        checkedAt: new Date().toISOString(),
        databaseConnectivity: false,
        serverReachable: false,
      },
    };
  }

  async function refreshSegments(segments: readonly SnapshotSegment[]) {
    if (!isAuthorized.value) {
      return;
    }

    refreshSnapshotInFlight.value += 1;
    try {
      applyPatch(await fetchSegments(createClient(), segments));
      lastError.value = "";
    } catch (error) {
      applyOfflineHealth();
      lastError.value = error instanceof Error ? error.message : String(error);
    } finally {
      refreshSnapshotInFlight.value = Math.max(0, refreshSnapshotInFlight.value - 1);
    }
  }

  async function refreshSnapshot() {
    await refreshSegments(ALL_SEGMENTS);
  }

  function setOnApplySnapshot(hook: ApplySnapshotHook | null) {
    onApplySnapshot = hook;
  }

  instance = {
    snapshot,
    isAuthorized,
    isRefreshing,
    refreshSnapshotInFlight,
    renameDrafts,
    onlineNodes,
    openInvites,
    routeNodes,
    nodeById: (id) => snapshot.value.nodes.find((n) => n.id === id),
    userById: (id) => snapshot.value.users.find((u) => u.id === id),
    applySnapshot,
    applyPatch,
    applyOfflineHealth,
    refreshSnapshot,
    refreshSegments,
    setOnApplySnapshot,
  };
  return instance;
}
