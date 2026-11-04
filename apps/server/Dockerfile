FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# El esquema va antes de instalar: el postinstall genera el cliente de Prisma.
COPY apps/server/prisma apps/server/prisma
RUN pnpm install --frozen-lockfile --filter @laofi/server...
COPY packages/shared packages/shared
COPY apps/server apps/server
ENV SERVER_PORT=2567 API_PORT=2568
EXPOSE 2567 2568
WORKDIR /app/apps/server
# Aplica las migraciones pendientes y arranca. Los datos de ejemplo se cargan aparte (ver README).
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
