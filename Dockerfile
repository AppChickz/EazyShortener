FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY prisma ./prisma
RUN pnpm run prisma:generate

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY public ./public
COPY views ./views

RUN pnpm run build \
  && pnpm prune --prod

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/views ./views

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
