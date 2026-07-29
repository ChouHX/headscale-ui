import type { Locale } from "./locales";

export type CountMessage =
  | "teamMembers"
  | "devicesTagged"
  | "openAccessWarnings"
  | "orphanReferences"
  | "cleanupOrphans";

type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

const messages = {
  "en-US": {
    teamMembers: { one: "{count} member", other: "{count} members" },
    devicesTagged: { one: "{count} device", other: "{count} devices" },
    openAccessWarnings: {
      one: "{count} rule currently lets everyone reach every device.",
      other: "{count} rules currently let everyone reach every device.",
    },
    orphanReferences: {
      one: "{count} reference no longer matches an existing account, team, or device label.",
      other: "{count} references no longer match existing accounts, teams, or device labels.",
    },
    cleanupOrphans: {
      one: "Clean up {count} stale reference",
      other: "Clean up {count} stale references",
    },
  },
  "zh-Hans": {
    teamMembers: { other: "{count} 名成员" },
    devicesTagged: { other: "{count} 台设备" },
    openAccessWarnings: { other: "有 {count} 条规则允许所有人访问所有设备。" },
    orphanReferences: { other: "有 {count} 处引用无法匹配现有账号、团队或设备标签。" },
    cleanupOrphans: { other: "清理 {count} 处失效引用" },
  },
  "zh-Hant-TW": {
    teamMembers: { other: "{count} 位成員" },
    devicesTagged: { other: "{count} 台裝置" },
    openAccessWarnings: { other: "有 {count} 條規則允許所有人存取所有裝置。" },
    orphanReferences: { other: "有 {count} 個參照無法對應現有帳號、團隊或裝置標籤。" },
    cleanupOrphans: { other: "清除 {count} 個失效參照" },
  },
  "zh-Hant-HK": {
    teamMembers: { other: "{count} 位成員" },
    devicesTagged: { other: "{count} 部裝置" },
    openAccessWarnings: { other: "有 {count} 條規則容許所有人存取所有裝置。" },
    orphanReferences: { other: "有 {count} 個參照無法配對現有帳戶、團隊或裝置標籤。" },
    cleanupOrphans: { other: "清除 {count} 個失效參照" },
  },
  "ja-JP": {
    teamMembers: { other: "メンバー {count} 人" },
    devicesTagged: { other: "デバイス {count} 台" },
    openAccessWarnings: {
      other: "全員がすべてのデバイスにアクセスできるルールが {count} 件あります。",
    },
    orphanReferences: {
      other: "既存のアカウント、チーム、デバイスタグに一致しない参照が {count} 件あります。",
    },
    cleanupOrphans: { other: "無効な参照を {count} 件削除" },
  },
  "ko-KR": {
    teamMembers: { other: "멤버 {count}명" },
    devicesTagged: { other: "기기 {count}대" },
    openAccessWarnings: {
      other: "모든 사용자가 모든 기기에 접근할 수 있는 규칙이 {count}개 있습니다.",
    },
    orphanReferences: {
      other: "기존 계정, 팀 또는 기기 태그와 일치하지 않는 참조가 {count}개 있습니다.",
    },
    cleanupOrphans: { other: "유효하지 않은 참조 {count}개 정리" },
  },
  "fr-FR": {
    teamMembers: { one: "{count} membre", other: "{count} membres" },
    devicesTagged: { one: "{count} appareil", other: "{count} appareils" },
    openAccessWarnings: {
      one: "{count} règle permet à tout le monde d’accéder à tous les appareils.",
      other: "{count} règles permettent à tout le monde d’accéder à tous les appareils.",
    },
    orphanReferences: {
      one: "{count} référence ne correspond plus à un compte, une équipe ou une étiquette existante.",
      other:
        "{count} références ne correspondent plus à des comptes, équipes ou étiquettes existants.",
    },
    cleanupOrphans: {
      one: "Nettoyer {count} référence obsolète",
      other: "Nettoyer {count} références obsolètes",
    },
  },
  "ru-RU": {
    teamMembers: {
      one: "{count} участник",
      few: "{count} участника",
      many: "{count} участников",
      other: "{count} участника",
    },
    devicesTagged: {
      one: "{count} устройство",
      few: "{count} устройства",
      many: "{count} устройств",
      other: "{count} устройства",
    },
    openAccessWarnings: {
      one: "{count} правило открывает всем доступ ко всем устройствам.",
      few: "{count} правила открывают всем доступ ко всем устройствам.",
      many: "{count} правил открывают всем доступ ко всем устройствам.",
      other: "{count} правила открывают всем доступ ко всем устройствам.",
    },
    orphanReferences: {
      one: "{count} ссылка не соответствует существующей учётной записи, команде или метке устройства.",
      few: "{count} ссылки не соответствуют существующим учётным записям, командам или меткам устройств.",
      many: "{count} ссылок не соответствуют существующим учётным записям, командам или меткам устройств.",
      other:
        "{count} ссылки не соответствуют существующим учётным записям, командам или меткам устройств.",
    },
    cleanupOrphans: {
      one: "Удалить {count} недействительную ссылку",
      few: "Удалить {count} недействительные ссылки",
      many: "Удалить {count} недействительных ссылок",
      other: "Удалить {count} недействительные ссылки",
    },
  },
  "es-ES": {
    teamMembers: { one: "{count} miembro", other: "{count} miembros" },
    devicesTagged: { one: "{count} dispositivo", other: "{count} dispositivos" },
    openAccessWarnings: {
      one: "{count} regla permite que todo el mundo acceda a todos los dispositivos.",
      other: "{count} reglas permiten que todo el mundo acceda a todos los dispositivos.",
    },
    orphanReferences: {
      one: "{count} referencia ya no coincide con una cuenta, un equipo o una etiqueta existente.",
      other: "{count} referencias ya no coinciden con cuentas, equipos o etiquetas existentes.",
    },
    cleanupOrphans: {
      one: "Limpiar {count} referencia obsoleta",
      other: "Limpiar {count} referencias obsoletas",
    },
  },
  "it-IT": {
    teamMembers: { one: "{count} membro", other: "{count} membri" },
    devicesTagged: { one: "{count} dispositivo", other: "{count} dispositivi" },
    openAccessWarnings: {
      one: "{count} regola consente a tutti di accedere a tutti i dispositivi.",
      other: "{count} regole consentono a tutti di accedere a tutti i dispositivi.",
    },
    orphanReferences: {
      one: "{count} riferimento non corrisponde più a un account, un team o un’etichetta esistente.",
      other: "{count} riferimenti non corrispondono più ad account, team o etichette esistenti.",
    },
    cleanupOrphans: {
      one: "Rimuovi {count} riferimento obsoleto",
      other: "Rimuovi {count} riferimenti obsoleti",
    },
  },
  ar: {
    teamMembers: {
      zero: "لا يوجد أعضاء",
      one: "عضو واحد",
      two: "عضوان",
      few: "{count} أعضاء",
      many: "{count} عضوًا",
      other: "{count} عضو",
    },
    devicesTagged: {
      zero: "لا توجد أجهزة",
      one: "جهاز واحد",
      two: "جهازان",
      few: "{count} أجهزة",
      many: "{count} جهازًا",
      other: "{count} جهاز",
    },
    openAccessWarnings: {
      zero: "لا توجد قواعد وصول مفتوح.",
      one: "قاعدة واحدة تتيح للجميع الوصول إلى كل الأجهزة.",
      two: "قاعدتان تتيحان للجميع الوصول إلى كل الأجهزة.",
      few: "{count} قواعد تتيح للجميع الوصول إلى كل الأجهزة.",
      many: "{count} قاعدة تتيح للجميع الوصول إلى كل الأجهزة.",
      other: "{count} قاعدة تتيح للجميع الوصول إلى كل الأجهزة.",
    },
    orphanReferences: {
      zero: "لا توجد مراجع غير صالحة",
      one: "مرجع واحد غير صالح",
      two: "مرجعان غير صالحين",
      few: "{count} مراجع غير صالحة",
      many: "{count} مرجعًا غير صالح",
      other: "{count} مرجع غير صالح",
    },
    cleanupOrphans: {
      zero: "لا توجد مراجع لتنظيفها",
      one: "نظّف مرجعًا واحدًا غير صالح",
      two: "نظّف مرجعين غير صالحين",
      few: "نظّف {count} مراجع غير صالحة",
      many: "نظّف {count} مرجعًا غير صالح",
      other: "نظّف {count} مرجع غير صالح",
    },
  },
} satisfies Record<Locale, Record<CountMessage, PluralForms>>;

export function formatCount(locale: Locale, key: CountMessage, count: number): string {
  const forms: PluralForms = messages[locale][key];
  const category = new Intl.PluralRules(locale).select(count) as PluralCategory;
  return (forms[category] ?? forms.other).replace("{count}", String(count));
}
