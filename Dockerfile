FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable \
    && pnpm install --prod --frozen-lockfile
COPY src ./src
COPY scripts ./scripts

USER node
EXPOSE 3000

CMD ["node", "src/server.js"]
