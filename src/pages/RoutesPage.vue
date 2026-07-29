<script setup lang="ts">
import { LoaderCircle, RefreshCw, Router } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import type { HeadscaleNode, HeadscaleUser } from "@/api/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useActionFeedback } from "@/composables/useActionFeedback";
import { useDisplayHelpers } from "@/composables/useDisplayHelpers";
import { useMutation } from "@/composables/useMutation";
import { useProductCopy } from "@/composables/useProductCopy";
import { useRefreshGuard } from "@/composables/useRefreshGuard";
import { useSnapshot } from "@/composables/useSnapshot";
import { useSegment } from "@/composables/useSnapshotSegment";
import { nodePendingRoutes } from "@/utils/node";
import { isExitRoute, pendingRouteClass } from "@/utils/status-class";

type RouteApprovalTarget = {
  node: HeadscaleNode;
  route: string;
};

const { copy } = useProductCopy();
const { routeNodes, refreshSnapshot, nodeById: currentNode } = useSnapshot();
const { isRefreshing: isRefreshingSnapshot, refresh: refreshRoutes } = useSegment("fabric");
const { isActionPending, actionError, clearActionFeedback } = useActionFeedback();
const router = useRouter();

const routeApprovalDialogOpen = ref(false);
const selectedRouteApproval = ref<RouteApprovalTarget | null>(null);
const selectedRoutesApprovalNode = ref<HeadscaleNode | null>(null);

const selectedRoutesApprovalPending = computed(() =>
  selectedRoutesApprovalNode.value ? nodePendingRoutes(selectedRoutesApprovalNode.value) : [],
);
const selectedRoutesApprovalHasExitRoute = computed(() =>
  selectedRoutesApprovalPending.value.some((route) => isExitRoute(route)),
);

const { userLabel, nodeDisplayName, nodeOwner, hasVisibleUser } = useDisplayHelpers();

function approvedRoutesWith(node: HeadscaleNode, route: string) {
  return Array.from(new Set([...node.approvedRoutes, route]));
}

const { mutate } = useMutation();

function jumpToMachine(node: HeadscaleNode) {
  void router.push({ name: "devices", query: { search: nodeDisplayName(node) } }).catch(() => {});
}

function jumpToUser(user?: HeadscaleUser) {
  if (!hasVisibleUser(user)) {
    return;
  }
  void router.push({ name: "members", query: { user: user.id, from: "routes" } }).catch(() => {});
}

function requestApproveRoutes(node: HeadscaleNode) {
  clearActionFeedback("approve-routes");
  selectedRoutesApprovalNode.value = node;
}

function handleApproveRoutesDialogOpen(open: boolean) {
  if (!open && isActionPending("approve-routes")) {
    return;
  }
  if (!open) {
    selectedRoutesApprovalNode.value = null;
    clearActionFeedback("approve-routes");
  }
}

async function approveRoutes(node: HeadscaleNode) {
  return mutate("approve-routes", (client) =>
    client.setApprovedRoutes({
      nodeId: node.id,
      routes: node.availableRoutes.join(","),
    }),
  );
}

async function confirmApproveRoutes() {
  const node = selectedRoutesApprovalNode.value;
  if (!node) {
    return;
  }
  const approved = await approveRoutes(node);
  if (approved) {
    handleApproveRoutesDialogOpen(false);
  }
}

const routeApprovalGuard = useRefreshGuard();

function openRouteApprovalDialog(node: HeadscaleNode, route: string) {
  clearActionFeedback("approve-route");
  const token = routeApprovalGuard.next();
  selectedRouteApproval.value = { node, route };
  routeApprovalDialogOpen.value = true;
  void routeApprovalGuard.refresh(token, () => {
    if (
      !routeApprovalDialogOpen.value ||
      selectedRouteApproval.value?.node.id !== node.id ||
      selectedRouteApproval.value?.route !== route
    ) {
      return;
    }
    const nextNode = currentNode(node.id);
    if (!nextNode?.availableRoutes.includes(route)) {
      handleRouteApprovalDialogOpen(false);
      return;
    }
    selectedRouteApproval.value = { node: nextNode, route };
  });
}

function handleRouteApprovalDialogOpen(open: boolean) {
  if (!open && isActionPending("approve-route")) {
    return;
  }
  routeApprovalDialogOpen.value = open;
  if (!open) {
    routeApprovalGuard.cancel();
    selectedRouteApproval.value = null;
    clearActionFeedback("approve-route");
  }
}

async function confirmApproveRoute() {
  const target = selectedRouteApproval.value;
  if (!target) {
    return;
  }
  const approved = await mutate("approve-route", (client) =>
    client.setApprovedRoutes({
      nodeId: target.node.id,
      routes: approvedRoutesWith(target.node, target.route).join(","),
    }),
  );
  if (approved) {
    handleRouteApprovalDialogOpen(false);
  }
}
</script>

<template>
  <section class="space-y-3 sm:space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">{{ copy.routesTitle }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ copy.routesSubtitle }}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        data-testid="refresh-routes"
        :aria-label="copy.refreshData"
        :title="copy.refreshData"
        :disabled="isRefreshingSnapshot"
        @click="refreshRoutes"
      >
        <LoaderCircle v-if="isRefreshingSnapshot" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <RefreshCw v-else class="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>

    <div class="grid gap-2">
      <Card v-for="node in routeNodes" :key="node.id" class="overflow-hidden" :data-testid="`route-node-${node.id}`">
        <div class="grid gap-3 p-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-semibold">
                <button
                  type="button"
                  class="inline-flex max-w-full items-center text-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  :data-testid="`route-machine-link-${node.id}`"
                  :aria-label="`${copy.viewMachine}: ${nodeDisplayName(node)}`"
                  @click="jumpToMachine(node)"
                >
                  <span class="truncate">{{ nodeDisplayName(node) }}</span>
                </button>
              </h2>
              <button
                v-if="hasVisibleUser(node.user)"
                type="button"
                class="mt-1 inline-flex max-w-full text-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :data-testid="`route-user-link-${node.id}`"
                :aria-label="`${copy.viewUser}: ${nodeOwner(node)}`"
                @click="jumpToUser(node.user)"
              >
                <span class="truncate">{{ nodeOwner(node) }}</span>
              </button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              class="text-muted-foreground hover:text-foreground"
              :disabled="nodePendingRoutes(node).length === 0"
              :data-testid="`approve-routes-${node.id}`"
              @click="requestApproveRoutes(node)"
            >
              <Router class="h-4 w-4" aria-hidden="true" />
              {{ nodePendingRoutes(node).length === 0 ? copy.routesApproved : copy.approveAll }}
            </Button>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="grid gap-2">
              <p class="text-xs font-medium text-muted-foreground">{{ copy.availableRoutes }}</p>
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="(route, routeIndex) in node.availableRoutes"
                  :key="route"
                  variant="outline"
                  class="max-w-full justify-start whitespace-normal break-all font-mono"
                  :data-testid="`route-available-${node.id}-${routeIndex}`"
                >
                  {{ route }}
                </Badge>
                <span v-if="node.availableRoutes.length === 0" class="text-xs text-muted-foreground">
                  {{ copy.noRouteValues }}
                </span>
              </div>
            </div>
            <div class="grid gap-2">
              <p class="text-xs font-medium text-muted-foreground">{{ copy.approvedRoutes }}</p>
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="(route, routeIndex) in node.approvedRoutes"
                  :key="route"
                  variant="secondary"
                  class="max-w-full justify-start whitespace-normal break-all font-mono"
                  :data-testid="`route-approved-${node.id}-${routeIndex}`"
                >
                  {{ route }}
                </Badge>
                <span v-if="node.approvedRoutes.length === 0" class="text-xs text-muted-foreground">
                  {{ copy.noRouteValues }}
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="nodePendingRoutes(node).length > 0"
            class="overflow-hidden rounded-md border bg-background/45"
            :data-testid="`pending-routes-list-${node.id}`"
          >
            <div
              v-for="(route, routeIndex) in nodePendingRoutes(node)"
              :key="route"
              class="grid gap-2 border-t px-3 py-2 first:border-t-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
              :data-testid="`pending-route-${node.id}-${routeIndex}`"
            >
              <Badge :variant="isExitRoute(route) ? 'destructive' : 'outline'" class="justify-self-start">
                {{ isExitRoute(route) ? copy.exitRoute : copy.pendingRoutes }}
              </Badge>
              <Badge
                variant="secondary"
                class="max-w-full justify-self-start whitespace-normal break-all font-mono"
                :data-testid="`pending-route-value-${node.id}-${routeIndex}`"
              >
                {{ route }}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                class="justify-self-start sm:justify-self-end"
                :class="isExitRoute(route) ? 'border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined"
                :data-testid="`approve-route-${node.id}-${routeIndex}`"
                @click="openRouteApprovalDialog(node, route)"
              >
                <Router class="h-4 w-4" aria-hidden="true" />
                {{ copy.approveRoute }}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <p v-if="routeNodes.length === 0" class="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
        {{ copy.noRoutes }}
      </p>
    </div>

    <AlertDialog :open="routeApprovalDialogOpen" @update:open="handleRouteApprovalDialogOpen">
      <AlertDialogContent v-if="selectedRouteApproval" data-testid="approve-route-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{
              isExitRoute(selectedRouteApproval.route)
                ? copy.approveExitRouteTitle
                : copy.approveRouteTitle
            }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{
              isExitRoute(selectedRouteApproval.route)
                ? copy.approveExitRouteDescription
                : copy.approveRouteDescription
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div class="text-muted-foreground">{{ nodeDisplayName(selectedRouteApproval.node) }}</div>
          <div class="mt-1 break-all font-medium" data-testid="approve-route-target">
            {{ selectedRouteApproval.route }}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="approve-route-cancel" :disabled="isActionPending('approve-route')">{{ copy.cancel }}</AlertDialogCancel>
          <Button
            :variant="isExitRoute(selectedRouteApproval.route) ? 'destructive' : 'default'"
            data-testid="approve-route-confirm"
            :disabled="isActionPending('approve-route')"
            @click="confirmApproveRoute"
          >
            <LoaderCircle v-if="isActionPending('approve-route')" class="h-4 w-4 animate-spin" aria-hidden="true" />
            <Router v-else class="h-4 w-4" aria-hidden="true" />
            {{ copy.approveRoute }}
          </Button>
        </AlertDialogFooter>
        <p
          v-if="actionError('approve-route')"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="approve-route-error"
        >
          {{ actionError("approve-route") }}
        </p>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog :open="Boolean(selectedRoutesApprovalNode)" @update:open="handleApproveRoutesDialogOpen">
      <AlertDialogContent v-if="selectedRoutesApprovalNode" data-testid="approve-routes-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ selectedRoutesApprovalHasExitRoute ? copy.approveExitRoutesTitle : copy.approveRoutesTitle }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ selectedRoutesApprovalHasExitRoute ? copy.approveExitRoutesDescription : copy.approveRoutesDescription }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="grid gap-2 rounded-md border bg-muted/30 p-3">
          <p class="text-sm font-medium">{{ nodeDisplayName(selectedRoutesApprovalNode) }}</p>
          <Badge
            v-for="(route, routeIndex) in selectedRoutesApprovalPending"
            :key="route"
            variant="outline"
            class="w-fit max-w-full whitespace-normal break-all font-mono"
            :class="pendingRouteClass(route)"
            :data-testid="`approve-routes-target-${routeIndex}`"
          >
            {{ route }}
          </Badge>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="approve-routes-cancel" :disabled="isActionPending('approve-routes')">{{ copy.cancel }}</AlertDialogCancel>
          <Button
            type="button"
            :variant="selectedRoutesApprovalHasExitRoute ? 'destructive' : 'default'"
            data-testid="approve-routes-confirm"
            :disabled="isActionPending('approve-routes')"
            @click="confirmApproveRoutes"
          >
            <LoaderCircle v-if="isActionPending('approve-routes')" class="h-4 w-4 animate-spin" aria-hidden="true" />
            <Router v-else class="h-4 w-4" aria-hidden="true" />
            {{ copy.confirmApproveRoutes }}
          </Button>
        </AlertDialogFooter>
        <p
          v-if="actionError('approve-routes')"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="approve-routes-error"
        >
          {{ actionError("approve-routes") }}
        </p>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
