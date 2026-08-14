/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface Window {
  __headscaleUiOperationCalls?: Array<{
    id: string;
    method: string;
    url: string;
    payload: unknown;
  }>;
}

interface ImportMetaEnv {
  readonly BASE_URL: string;
}
