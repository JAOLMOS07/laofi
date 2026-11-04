FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile --filter @laofi/client...
COPY packages/shared packages/shared
COPY apps/client apps/client
EXPOSE 5173
CMD ["pnpm", "--filter", "@laofi/client", "dev", "--host", "0.0.0.0"]
