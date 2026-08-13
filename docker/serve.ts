const DIST = new URL("../dist/", import.meta.url);
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";

function resolveSafe(pathname: string): URL | null {
  const decoded = decodeURIComponent(pathname);
  const target = new URL(decoded.replace(/^\/+/, ""), DIST);
  if (!target.pathname.startsWith(DIST.pathname)) {
    return null;
  }
  return target;
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const target = resolveSafe(pathname === "/" ? "/index.html" : pathname);
    if (!target) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(target);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response(Bun.file(new URL("index.html", DIST)));
  },
});

console.info(`[headscale-ui] listening on http://${HOST}:${PORT}`);
