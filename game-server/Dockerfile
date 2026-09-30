# Build context is the repo root (see ../fly.toml) so this can COPY the
# sibling shared/ directory that both this server and the Next.js app import.
FROM node:20-slim

WORKDIR /app

COPY game-server/package.json game-server/package-lock.json* ./game-server/
RUN cd game-server && npm install --omit=dev

COPY shared ./shared
COPY game-server ./game-server

WORKDIR /app/game-server

EXPOSE 2567

CMD ["node", "src/index.js"]
