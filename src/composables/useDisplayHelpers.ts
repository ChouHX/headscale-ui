import { isTimestampExpired } from "@/domain/node-status";
import { useHeadscaleI18n } from "@/i18n";
import { formatDate as rawFormatDate } from "@/utils/format";
import {
  nodeDisplayName as rawNodeDisplayName,
  nodeOwner as rawNodeOwner,
  nodeStatusLabel as rawNodeStatusLabel,
} from "@/utils/node";
import { shortSecret as rawShortSecret } from "@/utils/strings";
import { hasVisibleUser, isTagManagedDeviceUser, userLabel as rawUserLabel } from "@/utils/user";
import { useProductCopy } from "./useProductCopy";

/**
 * I18n-aware display helpers shared by every page. Pure utilities live in
 * `@/utils/*`; this composable binds them to the active locale + copy so
 * template code can stay as terse as `{{ formatDate(v) }}` with one source
 * of truth for translations.
 *
 * Consumers needing the return shape can use `ReturnType<typeof useDisplayHelpers>`.
 */
export function useDisplayHelpers() {
  const { copy } = useProductCopy();
  const { t, locale } = useHeadscaleI18n();
  return {
    formatDate: (value: string | undefined) => rawFormatDate(value, locale.value, copy.value.never),
    userLabel: (user: Parameters<typeof rawUserLabel>[0]) => rawUserLabel(user, copy.value.unknown),
    nodeDisplayName: (node: Parameters<typeof rawNodeDisplayName>[0]) => rawNodeDisplayName(node),
    nodeOwner: (node: Parameters<typeof rawNodeOwner>[0]) => rawNodeOwner(node, copy.value.unknown),
    nodeStatusLabel: (node: Parameters<typeof rawNodeStatusLabel>[0]) =>
      rawNodeStatusLabel(node, {
        online: t("online"),
        offline: t("offline"),
        expired: copy.value.expiredOnly,
      }),
    shortSecret: (value: string | undefined) => rawShortSecret(value, copy.value.unknown),
    keyStatus: (key: { used: boolean; expiration?: string }) => {
      if (key.used) return copy.value.used;
      if (isTimestampExpired(key.expiration)) return t("disconnected");
      return copy.value.unused;
    },
    hasVisibleUser,
    isTagManagedDeviceUser,
  };
}
