# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY index.html env.d.ts tsconfig.json tsconfig.app.json vite.config.ts components.json ./
COPY public ./public
COPY src ./src

RUN bun run build

FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY docker/serve.ts ./serve.ts

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:8080/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "serve.ts"]
