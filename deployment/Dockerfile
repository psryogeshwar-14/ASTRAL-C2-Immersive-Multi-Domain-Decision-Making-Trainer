# Multi-stage Dockerfile for Astral-C2 Tactical Training Environment
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --only=production && npm install -g tsx

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

EXPOSE 3001 5173

CMD ["npx", "tsx", "server/index.ts"]
