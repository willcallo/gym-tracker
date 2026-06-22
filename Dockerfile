# Stage 1: install & compile native addons (better-sqlite3 needs python/make/g++)
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: build Next.js
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: lean runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy compiled node_modules (includes the pre-built .node binary)
COPY --from=builder /app/node_modules ./node_modules
# Copy Next.js build output and config
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Ensure the persistent data directory exists at startup
RUN mkdir -p /data

EXPOSE 3000
CMD ["npm", "start"]
