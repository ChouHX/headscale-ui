import { computed } from "vue";
import { createI18n, useI18n as useVueI18n } from "vue-i18n";
import type { OperationGroup, OperationId } from "@/domain/headscale-operations";
import { readSetting, writeSetting } from "@/lib/settings-storage";
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  type Locale,
  resolveLocale,
  SUPPORTED_LOCALES,
} from "./locales";
import { commonMessages, getGroupLabel, getOperationMessage, type MessageKey } from "./messages";

const LOCALE_SETTING_KEY = "locale";

export const i18n = createI18n<[Record<MessageKey, string>], Locale>({
  legacy: false,
  globalInjection: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: false,
  messages: commonMessages,
});

function syncDocument(locale: Locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALE_META[locale].dir;
  }
  writeSetting(LOCALE_SETTING_KEY, locale);
}

/**
 * Pulls the persisted locale out of settings-storage and applies it. Called
 * by main.ts once hydrateSettings() has resolved, before the app mounts.
 */
export function applyStoredLocale(): void {
  const next = resolveLocale(readSetting(LOCALE_SETTING_KEY));
  // With legacy: false the global is a Composer where locale is a
  // WritableComputedRef<Locale>; vue-i18n's union typing forces a narrow cast.
  (i18n.global.locale as unknown as { value: Locale }).value = next;
  syncDocument(next);
}

export function useHeadscaleI18n() {
  const composer = useVueI18n<[Record<MessageKey, string>], Locale>({
    useScope: "global",
  });
  const locale = computed(() => composer.locale.value);
  const meta = computed(() => LOCALE_META[composer.locale.value]);

  function setLocale(localeValue: Locale) {
    composer.locale.value = localeValue;
    syncDocument(localeValue);
  }

  function t(key: MessageKey, named?: Record<string, string | number>): string {
    return named !== undefined ? composer.t(key, named) : composer.t(key);
  }

  function tg(group: OperationGroup) {
    return getGroupLabel(composer.locale.value, group);
  }

  function toperation(id: OperationId) {
    return getOperationMessage(composer.locale.value, id);
  }

  return {
    locale,
    meta,
    setLocale,
    t,
    tg,
    toperation,
  };
}

export type { Locale };
export { LOCALE_META, SUPPORTED_LOCALES };
