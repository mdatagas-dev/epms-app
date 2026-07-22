FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM dependencies AS build

ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

COPY . .
RUN npm run build \
    && cp -r public .next/standalone/public \
    && mkdir -p .next/standalone/.next \
    && cp -r .next/static .next/standalone/.next/

FROM dependencies AS production-dependencies

RUN npm prune --omit=dev --no-audit --no-fund

FROM production-dependencies AS migration

COPY --from=build --chown=node:node /app/db ./db
COPY --from=build --chown=node:node /app/lib ./lib
COPY --from=build --chown=node:node /app/scripts ./scripts

USER node

CMD ["node", "--experimental-strip-types", "scripts/migrate.ts"]

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-calc-nogui libreoffice-writer-nogui \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build --chown=node:node /app/.next/standalone ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
