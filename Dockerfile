FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
EXPOSE 3000
# Applies migrations unless RUN_MIGRATIONS=false (the hosted setup migrates from GitHub Actions before each deploy),
# then starts the custom server (Next.js + SSH/RDP WebSocket gateways) in a single Node process.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" != \"false\" ]; then npx prisma migrate deploy || exit 1; fi; exec node --import tsx server.ts"]
