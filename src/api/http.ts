import axios, { type AxiosError, type AxiosInstance } from "axios";

export interface ConnectionSettings {
  mode: "mock" | "real";
  baseUrl: string;
  apiKey: string;
}

export function explainHeadscaleError(message: string): string {
  if (/reading policy from path\s+["']{2}:\s*open\s*:\s*no such file or directory/i.test(message)) {
    return "Headscale ACL policy is misconfigured: policy.path is empty. Set policy.mode to database in the Headscale config, then restart Headscale.";
  }
  return message;
}

export function createHeadscaleHttp(settings: ConnectionSettings): AxiosInstance {
  const client = axios.create({
    baseURL: settings.baseUrl.replace(/\/$/, ""),
    timeout: 15_000,
  });

  client.interceptors.request.use((config) => {
    if (settings.apiKey) {
      config.headers.Authorization = `Bearer ${settings.apiKey}`;
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string }>) => {
      const message =
        error.response?.data?.message ??
        error.message ??
        "Headscale request failed. Check server URL and API key.";
      return Promise.reject(new Error(explainHeadscaleError(message)));
    },
  );

  return client;
}
