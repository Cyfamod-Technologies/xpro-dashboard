FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack install --global pnpm@11.0.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
RUN pnpm build:icons && pnpm msw:init
RUN pnpm build

FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="Xpro Frontend" \
      org.opencontainers.image.description="Xpro operations dashboard frontend"

COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --spider --quiet http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
