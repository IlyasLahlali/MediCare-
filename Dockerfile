FROM node:20-bookworm-slim

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY frontend /app/frontend

ENV NODE_ENV=production

CMD ["node", "server.js"]
