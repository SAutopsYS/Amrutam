FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig*.json nest-cli.json ./
COPY src ./src/
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV SERVICE_NAME=amrutam-backend

RUN apk add --no-cache wget \
  && addgroup -g 1001 -S amrutam \
  && adduser -S amrutam -u 1001 -G amrutam

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R amrutam:amrutam /app

USER amrutam

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health/live || exit 1

STOPSIGNAL SIGTERM

ENTRYPOINT ["./entrypoint.sh"]
