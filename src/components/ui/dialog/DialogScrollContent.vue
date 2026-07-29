<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import { X } from "lucide-vue-next";
import type { DialogContentEmits, DialogContentProps } from "reka-ui";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui";
import type { HTMLAttributes } from "vue";
import { useHeadscaleI18n } from "@/i18n";
import { cn } from "@/lib/utils";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<DialogContentProps & { class?: HTMLAttributes["class"] }>();
const emits = defineEmits<DialogContentEmits>();
const { t } = useHeadscaleI18n();

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80 p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:p-8"
    >
      <DialogContent
        :class="
          cn(
            'relative z-50 grid max-h-[calc(100svh-2rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-4 shadow-lg duration-200 sm:max-h-[calc(100svh-4rem)] sm:max-w-lg sm:p-6 md:w-full',
            props.class,
          )
        "
        v-bind="{ ...$attrs, ...forwarded }"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
            event.preventDefault();
          }
        }"
      >
        <slot />

        <DialogClose
          data-slot="dialog-close"
          class="absolute top-4 end-4 cursor-pointer rounded-md p-0.5 transition-colors hover:bg-secondary"
        >
          <X class="w-4 h-4" />
          <span class="sr-only">{{ t("close") }}</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
