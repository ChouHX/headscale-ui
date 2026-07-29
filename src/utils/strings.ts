/**
 * Trim a base URL: removes outer whitespace and a single trailing slash.
 * `http://x.com/` → `http://x.com`
 */
export function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, "");
}

/**
 * Truncate long secrets for table display while keeping head + tail for recognition.
 * `<= 18` chars are returned as-is; longer values become `<first-12>...<last-4>`.
 * Returns `fallback` for empty input.
 */
export function shortSecret(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value.length <= 18) return value;
  return `${value.slice(0, 12)}...${value.slice(-4)}`;
}
