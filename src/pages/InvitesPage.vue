<script setup lang="ts">
import {
  Clock,
  Copy,
  EllipsisVertical,
  Filter,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-vue-next";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { HeadscaleClient, HeadscaleUser, PreAuthKey } from "@/api/types";
import CreateAuthKeyDialog from "@/components/CreateAuthKeyDialog.vue";
import type {
  AuthKeyDialogDefaults,
  AuthKeyDialogLabels,
  AuthKeyDialogPayload,
} from "@/components/create-auth-key-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ActionFeedbackKey, useActionFeedback } from "@/composables/useActionFeedback";
import { useDeviceSetup } from "@/composables/useDeviceSetup";
import { useDisplayHelpers } from "@/composables/useDisplayHelpers";
import { useHeadscaleClient } from "@/composables/useHeadscaleClient";
import { useMutation } from "@/composables/useMutation";
import { useProductCopy } from "@/composables/useProductCopy";
import { useRefreshGuard } from "@/composables/useRefreshGuard";
import { useSnapshot } from "@/composables/useSnapshot";
import { useSegment } from "@/composables/useSnapshotSegment";
import { isTimestampExpired as isExpired } from "@/domain/node-status";
import { useHeadscaleI18n } from "@/i18n";
import { keyEphemeralClass, keyKindClass, keyStatusClass, keyTagClass } from "@/utils/status-class";
import { normalizedBaseUrl } from "@/utils/strings";

type InviteFilter = "all" | "ready" | "used" | "expired" | "tagged";
type InviteActionTarget = {
  kind: "expire" | "delete";
  key: PreAuthKey;
};

const { t, locale } = useHeadscaleI18n();
const { copy } = useProductCopy();
const { snapshot, refreshSnapshot } = useSnapshot();
const { isRefreshing: isRefreshingSnapshot, refresh: refreshInvites } = useSegment("identity");
const { settings } = useHeadscaleClient();
const { isActionPending, actionError, clearActionFeedback } = useActionFeedback();
const { lastCreatedInvite } = useDeviceSetup();

const router = useRouter();

const inviteSearch = ref("");
const inviteFilter = ref<InviteFilter>("all");
const inviteDialogOpen = ref(false);
const pendingInviteAction = ref<InviteActionTarget | null>(null);
const copiedKey = ref("");

const inviteForm = reactive({
  user: "1",
  reusable: true,
  ephemeral: false,
  expiration: "2026-12-31T23:59:00Z",
  aclTags: "",
});

const inviteDialogGuard = useRefreshGuard();

const isCreatingInvite = computed(() => isActionPending("create-invite"));

const { formatDate, userLabel, keyStatus, shortSecret, hasVisibleUser, isTagManagedDeviceUser } =
  useDisplayHelpers();

const visibleUsers = computed(() => snapshot.value.users.filter((user) => hasVisibleUser(user)));

const filteredPreAuthKeys = computed(() => {
  const query = inviteSearch.value.trim().toLowerCase();
  return snapshot.value.preAuthKeys.filter((key) => {
    const searchable = [
      key.key,
      userLabel(key.user),
      key.user?.name,
      key.user?.email,
      keyStatus(key),
      key.reusable ? copy.value.reusable : copy.value.oneTimeKey,
      key.ephemeral ? copy.value.ephemeral : "",
      key.expiration,
      key.createdAt,
      key.aclTags.join(" "),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesFilter =
      inviteFilter.value === "all" ||
      (inviteFilter.value === "ready" && !key.used && !isExpired(key.expiration)) ||
      (inviteFilter.value === "used" && key.used) ||
      (inviteFilter.value === "expired" && isExpired(key.expiration)) ||
      (inviteFilter.value === "tagged" && key.aclTags.length > 0);

    return matchesSearch && matchesFilter;
  });
});

const authKeyDialogUsers = computed(() =>
  visibleUsers.value.map((user) => ({
    id: user.id,
    label: userLabel(user),
  })),
);

const authKeyDialogDefaults = computed<AuthKeyDialogDefaults>(() => ({
  user: inviteForm.user,
  reusable: inviteForm.reusable,
  ephemeral: inviteForm.ephemeral,
  expiration: inviteForm.expiration,
  aclTags: inviteForm.aclTags,
}));

const authKeyDialogLabels = computed<AuthKeyDialogLabels>(() => ({
  title: copy.value.createInvite,
  description: copy.value.invitesSubtitle,
  owner: copy.value.inviteOwner,
  expiration: copy.value.inviteExpiration,
  aclTags: copy.value.aclTags,
  reusable: copy.value.reusable,
  ephemeral: copy.value.ephemeral,
  cancel: copy.value.cancel,
  submit: copy.value.createInvite,
  noUsers: copy.value.noUsers,
  time: copy.value.time,
  hour: copy.value.hour,
  minute: copy.value.minute,
}));

const installCommand = computed(() => {
  if (!lastCreatedInvite.value) {
    return "";
  }
  return `tailscale up --login-server ${normalizedBaseUrl(settings.baseUrl)} --authkey ${lastCreatedInvite.value}`;
});

const { mutate, mutateWith } = useMutation();

function openInviteDialog() {
  clearActionFeedback("create-invite");
  const token = inviteDialogGuard.next();
  inviteDialogOpen.value = true;
  void inviteDialogGuard.refresh(token, () => {
    if (!inviteDialogOpen.value) return;
    if (!authKeyDialogUsers.value.some((user) => user.id === inviteForm.user)) {
      inviteForm.user = authKeyDialogUsers.value[0]?.id ?? "";
    }
  });
}

function handleInviteDialogOpen(open: boolean) {
  if (!open && isActionPending("create-invite")) {
    return;
  }
  inviteDialogOpen.value = open;
  if (!open) {
    clearActionFeedback("create-invite");
    inviteDialogGuard.cancel();
  }
}

async function createInvite(payload: AuthKeyDialogPayload) {
  inviteForm.user = payload.user;
  inviteForm.reusable = payload.reusable;
  inviteForm.ephemeral = payload.ephemeral;
  inviteForm.expiration = payload.expiration;
  inviteForm.aclTags = payload.aclTags;
  lastCreatedInvite.value = "";
  const created = await mutateWith("create-invite", (client) => client.createPreAuthKey(payload));
  if (created.ok) {
    lastCreatedInvite.value = created.result.preAuthKey.key;
    handleInviteDialogOpen(false);
  }
}

function requestInviteAction(kind: InviteActionTarget["kind"], key: PreAuthKey) {
  clearActionFeedback("invite-action");
  pendingInviteAction.value = { kind, key };
}

function handleInviteActionDialogOpen(open: boolean) {
  if (!open && isActionPending("invite-action")) {
    return;
  }
  if (!open) {
    pendingInviteAction.value = null;
    clearActionFeedback("invite-action");
  }
}

async function confirmInviteAction() {
  const target = pendingInviteAction.value;
  if (!target) {
    return;
  }
  const completed = await mutate("invite-action", (client) =>
    target.kind === "expire"
      ? client.expirePreAuthKey({ id: target.key.id })
      : client.deletePreAuthKey({ id: target.key.id }),
  );
  if (completed) {
    handleInviteActionDialogOpen(false);
  }
}

function openUserDetails(user?: HeadscaleUser) {
  if (!hasVisibleUser(user)) {
    return;
  }
  void router.push({ name: "members", query: { user: user.id, from: "invites", popup: "user" } });
}

async function copyInviteKey(value: string) {
  await navigator.clipboard.writeText(value);
  copiedKey.value = value;
  window.setTimeout(() => {
    copiedKey.value = "";
  }, 1200);
}
</script>

<template>
  <section class="space-y-3 lg:space-y-4">
    <div class="grid gap-3">
      <div>
        <h1 class="text-xl font-semibold">{{ copy.invitesTitle }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ copy.invitesSubtitle }}</p>
      </div>
    </div>

    <div class="space-y-2" data-testid="invite-table-shell">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center" data-testid="invite-toolbar">
        <div class="w-full sm:max-w-sm">
          <Label for="invite-search" class="sr-only">{{ copy.searchAuthKeys }}</Label>
          <div class="relative">
            <Search class="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="invite-search"
              v-model="inviteSearch"
              data-testid="invite-search"
              class="ps-8"
              :placeholder="copy.searchAuthKeys"
            />
          </div>
        </div>
        <div class="w-full sm:w-40">
          <Label for="invite-filter" class="sr-only">{{ copy.filters }}</Label>
          <div class="relative">
            <Filter class="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <NativeSelect id="invite-filter" v-model="inviteFilter" data-testid="invite-filter" class="ps-8">
              <NativeSelectOption value="all">{{ copy.invitesTitle }}</NativeSelectOption>
              <NativeSelectOption value="ready">{{ copy.readyKeys }}</NativeSelectOption>
              <NativeSelectOption value="used">{{ copy.used }}</NativeSelectOption>
              <NativeSelectOption value="expired">{{ copy.expiredOnly }}</NativeSelectOption>
              <NativeSelectOption value="tagged">{{ copy.taggedKeys }}</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        <p class="whitespace-nowrap text-xs text-muted-foreground sm:ms-auto">{{ filteredPreAuthKeys.length }} / {{ snapshot.preAuthKeys.length }}</p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          data-testid="refresh-auth-keys"
          :aria-label="copy.refreshData"
          :title="copy.refreshData"
          :disabled="isRefreshingSnapshot"
          @click="refreshInvites"
        >
          <LoaderCircle v-if="isRefreshingSnapshot" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <RefreshCw v-else class="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button data-testid="open-create-invite" @click="openInviteDialog">
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ copy.createInvite }}
        </Button>
      </div>
      <Card class="min-w-0 overflow-hidden" data-testid="invite-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ copy.status }}</TableHead>
              <TableHead>{{ copy.inviteOwner }}</TableHead>
              <TableHead>{{ copy.inviteKey }}</TableHead>
              <TableHead>{{ copy.expires }}</TableHead>
              <TableHead>{{ copy.aclTags }}</TableHead>
              <TableHead>{{ copy.actions }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="key in filteredPreAuthKeys"
              :key="key.id"
              :data-testid="`invite-${key.id}`"
            >
              <TableCell class="w-28">
                <Badge variant="outline" :class="keyStatusClass(key)" :data-testid="`invite-status-${key.id}`">{{ keyStatus(key) }}</Badge>
              </TableCell>
              <TableCell class="min-w-36 font-medium">
                <button
                  v-if="hasVisibleUser(key.user)"
                  type="button"
                  class="text-start underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  :data-testid="`invite-owner-link-${key.id}`"
                  @click="openUserDetails(key.user)"
                >
                  <bdi dir="auto">{{ userLabel(key.user) }}</bdi>
                </button>
                <bdi v-else dir="auto">{{ userLabel(key.user) }}</bdi>
              </TableCell>
              <TableCell class="min-w-64">
                <code dir="ltr" class="break-all rounded bg-secondary px-1.5 py-0.5 text-xs">{{ key.key }}</code>
                <div class="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline" :class="keyKindClass(key)" :data-testid="`invite-kind-${key.id}`">{{ key.reusable ? copy.reusable : copy.oneTimeKey }}</Badge>
                  <Badge v-if="key.ephemeral" variant="outline" :class="keyEphemeralClass()" :data-testid="`invite-ephemeral-${key.id}`">{{ copy.ephemeral }}</Badge>
                </div>
              </TableCell>
              <TableCell class="min-w-40 text-sm text-muted-foreground">
                {{ formatDate(key.expiration) }}
              </TableCell>
              <TableCell class="min-w-36">
                <div v-if="key.aclTags.length" class="flex flex-wrap gap-1">
                  <Badge
                    v-for="(tag, tagIndex) in key.aclTags"
                    :key="tag"
                    variant="outline"
                    :class="keyTagClass(tag)"
                    :data-testid="`invite-tag-${key.id}-${tagIndex}`"
                  >
                    {{ tag }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell class="min-w-16">
                <div class="flex justify-start">
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="outline"
                        size="icon"
                        :data-testid="`invite-actions-trigger-${key.id}`"
                        :aria-label="`${copy.actions}: ${shortSecret(key.key)}`"
                      >
                        <EllipsisVertical class="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-56" :data-testid="`invite-actions-menu-${key.id}`">
                      <DropdownMenuLabel>{{ copy.actions }}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem :data-testid="`expire-invite-${key.id}`" @click="requestInviteAction('expire', key)">
                        <Clock class="h-4 w-4" aria-hidden="true" />
                        {{ copy.expireInvite }}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        :data-testid="`delete-invite-${key.id}`"
                        @click="requestInviteAction('delete', key)"
                      >
                        <Trash2 class="h-4 w-4" aria-hidden="true" />
                        {{ copy.deleteInvite }}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
            <TableRow v-if="filteredPreAuthKeys.length === 0">
              <TableCell colspan="6" class="py-6 text-sm text-muted-foreground">
                {{ copy.noAuthKeys }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <Card v-if="lastCreatedInvite" class="p-3" data-testid="created-invite">
        <p class="text-sm text-muted-foreground">{{ copy.inviteKey }}</p>
        <div class="mt-2 grid gap-2">
          <code class="min-w-0 flex-1 break-all rounded-md bg-secondary px-2 py-1 text-xs">{{ lastCreatedInvite }}</code>
          <Button size="sm" variant="outline" class="w-full" data-testid="copy-created-invite" @click="copyInviteKey(lastCreatedInvite)">
            <Copy class="h-4 w-4" aria-hidden="true" />
            {{ copiedKey === lastCreatedInvite ? copy.copied : copy.copy }}
          </Button>
        </div>
        <p class="mt-4 text-sm text-muted-foreground">{{ copy.installCommand }}</p>
        <div class="mt-2 grid gap-2">
          <code class="break-all rounded-md bg-secondary px-2 py-1 text-xs">{{ installCommand }}</code>
          <Button size="sm" variant="outline" class="w-full" data-testid="copy-created-install-command" @click="copyInviteKey(installCommand)">
            <Copy class="h-4 w-4" aria-hidden="true" />
            {{ copiedKey === installCommand ? copy.copied : copy.copyCommand }}
          </Button>
        </div>
      </Card>
    </div>

    <CreateAuthKeyDialog
      :open="inviteDialogOpen"
      :users="authKeyDialogUsers"
      :defaults="authKeyDialogDefaults"
      :labels="authKeyDialogLabels"
      :is-submitting="isCreatingInvite"
      :error="actionError('create-invite')"
      @update:open="handleInviteDialogOpen"
      @submit="createInvite"
    />

    <AlertDialog :open="Boolean(pendingInviteAction)" @update:open="handleInviteActionDialogOpen">
      <AlertDialogContent v-if="pendingInviteAction" :data-testid="pendingInviteAction.kind === 'expire' ? 'expire-invite-dialog' : 'delete-invite-dialog'">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ pendingInviteAction.kind === "expire" ? copy.expireInviteTitle : copy.deleteInviteTitle }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ pendingInviteAction.kind === "expire" ? copy.expireInviteDescription : copy.deleteInviteDescription }}
            <span class="mt-2 block font-mono text-xs text-foreground">{{ shortSecret(pendingInviteAction.key.key) }}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-invite-action" :disabled="isActionPending('invite-action')">{{ copy.cancel }}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            data-testid="confirm-invite-action"
            :disabled="isActionPending('invite-action')"
            @click="confirmInviteAction"
          >
            <LoaderCircle v-if="isActionPending('invite-action')" class="h-4 w-4 animate-spin" aria-hidden="true" />
            {{ pendingInviteAction.kind === "expire" ? copy.confirmExpireInvite : copy.confirmDeleteInvite }}
          </Button>
        </AlertDialogFooter>
        <p
          v-if="actionError('invite-action')"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          data-testid="invite-action-error"
        >
          {{ actionError("invite-action") }}
        </p>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>
