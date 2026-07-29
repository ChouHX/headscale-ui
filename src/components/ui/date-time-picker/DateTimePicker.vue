<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import { fromDate, getLocalTimeZone } from "@internationalized/date";
import { CalendarClock } from "lucide-vue-next";
import type { HTMLAttributes } from "vue";
import { computed, ref, useAttrs, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    id?: string;
    modelValue: string;
    locale?: string;
    placeholder?: string;
    timeLabel?: string;
    hourLabel?: string;
    minuteLabel?: string;
    required?: boolean;
    testId?: string;
    class?: HTMLAttributes["class"];
  }>(),
  {
    id: undefined,
    locale: "en-US",
    placeholder: undefined,
    timeLabel: undefined,
    hourLabel: undefined,
    minuteLabel: undefined,
    required: false,
    testId: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const timeZone = getLocalTimeZone();
const attrs = useAttrs();
const calendarOpen = ref(false);
const selectedDate = ref<DateValue>();
const calendarPlaceholder = ref<DateValue>();
const selectedTime = ref("00:00");
const resolvedTestId = computed(() => props.testId ?? String(attrs["data-testid"] ?? ""));
const resolvedLocale = computed(() => props.locale);
const localizedCopy = computed(() => resolveLocalizedCopy(props.locale));
const placeholderText = computed(() => props.placeholder ?? localizedCopy.value.placeholder);
const resolvedTimeLabel = computed(() => props.timeLabel ?? localizedCopy.value.time);
const resolvedHourLabel = computed(() => props.hourLabel ?? localizedCopy.value.hour);
const resolvedMinuteLabel = computed(() => props.minuteLabel ?? localizedCopy.value.minute);
const timeLabelId = computed(() => {
  const prefix = props.id ?? resolvedTestId.value;
  return prefix ? `${prefix}-time-label` : undefined;
});

const displayValue = computed(() => {
  if (!selectedDate.value) {
    return placeholderText.value;
  }

  const date = selectedDate.value.toDate(timeZone);
  const { hour, minute } = parseTime(selectedTime.value);
  date.setHours(Number(hour), Number(minute), 0, 0);

  return new Intl.DateTimeFormat(resolvedLocale.value, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
});

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function resolveLocalizedCopy(locale: string) {
  const language = locale.split("-")[0];
  const copy = {
    ar: {
      hour: "الساعة",
      minute: "الدقيقة",
      placeholder: "اختر التاريخ والوقت",
      time: "الوقت",
    },
    en: {
      hour: "Hour",
      minute: "Minute",
      placeholder: "Pick date and time",
      time: "Time",
    },
    es: {
      hour: "Hora",
      minute: "Minuto",
      placeholder: "Elige fecha y hora",
      time: "Hora",
    },
    fr: {
      hour: "Heure",
      minute: "Minute",
      placeholder: "Choisir la date et l'heure",
      time: "Heure",
    },
    it: {
      hour: "Ora",
      minute: "Minuto",
      placeholder: "Scegli data e ora",
      time: "Ora",
    },
    ja: {
      hour: "時",
      minute: "分",
      placeholder: "日時を選択",
      time: "時刻",
    },
    ko: {
      hour: "시",
      minute: "분",
      placeholder: "날짜와 시간 선택",
      time: "시간",
    },
    ru: {
      hour: "Час",
      minute: "Минута",
      placeholder: "Выберите дату и время",
      time: "Время",
    },
    zh: {
      hour: "小时",
      minute: "分钟",
      placeholder: "选择日期和时间",
      time: "时间",
    },
  } as const;

  return copy[language as keyof typeof copy] ?? copy.en;
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return {
    hour: match?.[1] ?? "00",
    minute: match?.[2] ?? "00",
  };
}

function toLocalDateTimeValue(date: DateValue, time: string) {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}T${time}`;
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const parsedDate = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
      )
    : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return {
    date: fromDate(parsedDate, timeZone),
    time: `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`,
  };
}

function syncFromModel(value: string) {
  const parsed = parseLocalDateTime(value);
  if (!parsed) {
    selectedDate.value = undefined;
    calendarPlaceholder.value = undefined;
    selectedTime.value = "00:00";
    return;
  }

  selectedDate.value = parsed.date;
  calendarPlaceholder.value = parsed.date;
  selectedTime.value = parsed.time;
}

function emitValue(date: DateValue | undefined = selectedDate.value, time = selectedTime.value) {
  if (!date) {
    emit("update:modelValue", "");
    return;
  }

  emit("update:modelValue", toLocalDateTimeValue(date, time));
}

function selectDate(value: DateValue | undefined) {
  if (!value) {
    return;
  }

  selectedDate.value = value;
  calendarPlaceholder.value = value;
  emitValue(value);
}

function selectTime(value: string) {
  selectedTime.value = value;
  emitValue(selectedDate.value, value);
}

watch(
  () => props.modelValue,
  (value) => syncFromModel(value),
  { immediate: true },
);
</script>

<template>
  <div :class="cn('grid gap-2', props.class)" data-slot="date-time-picker">
    <Popover v-model:open="calendarOpen">
      <PopoverTrigger as-child>
        <Button
          :id="id"
          type="button"
          variant="outline"
          :data-testid="resolvedTestId || undefined"
          :aria-required="required"
          class="w-full justify-start text-start font-normal"
        >
          <CalendarClock class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ displayValue }}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent class="max-h-[var(--reka-popover-content-available-height)] w-auto overflow-auto p-0" align="start">
        <div class="grid">
          <Calendar
            :model-value="selectedDate"
            v-model:placeholder="calendarPlaceholder"
            :locale="resolvedLocale"
            layout="month-and-year"
            @update:model-value="selectDate"
          />
          <div class="sticky bottom-0 z-10 border-t bg-popover p-3">
            <p
              :id="timeLabelId"
              class="mb-2 text-sm font-medium"
              :data-testid="resolvedTestId ? `${resolvedTestId}-time-label` : undefined"
            >
              {{ resolvedTimeLabel }}
            </p>
            <TimePicker
              :model-value="selectedTime"
              :locale="resolvedLocale"
              :hour-label="resolvedHourLabel"
              :minute-label="resolvedMinuteLabel"
              :test-id-prefix="resolvedTestId || undefined"
              :aria-labelledby="timeLabelId"
              @update:model-value="selectTime"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
