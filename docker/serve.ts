const DIST = new URL("./dist/", import.meta.url);
const INDEX = new URL("index.html", DIST);
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

function normalizeBasePath(value: string | undefined): string {
  const path = value?.trim() || "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
}

function stripBasePath(pathname: string): string {
  if (BASE_PATH === "/") return pathname;
  const withoutTrailingSlash = BASE_PATH.slice(0, -1);
  if (pathname === withoutTrailingSlash || pathname === BASE_PATH) return "/";
  if (pathname.startsWith(BASE_PATH)) return `/${pathname.slice(BASE_PATH.length)}`;
  // Some reverse proxies strip the location prefix before forwarding.
  return pathname;
}

function resolveSafe(pathname: string): URL | null {
  const decoded = decodeURIComponent(pathname);
  const target = new URL(decoded.replace(/^\/+/, ""), DIST);
  if (!target.pathname.startsWith(DIST.pathname)) {
    return null;
  }
  return target;
}

if (!(await Bun.file(INDEX).exists())) {
  throw new Error(`Static assets not found at ${INDEX.pathname}`);
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const appPath = stripBasePath(pathname);
    const target = resolveSafe(appPath === "/" ? "/index.html" : appPath);
    if (!target) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(target);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response(Bun.file(INDEX));
  },
});

console.info(`[headscale-ui] listening on http://${HOST}:${PORT}${BASE_PATH}`);
