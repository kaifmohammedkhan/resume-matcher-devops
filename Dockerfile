# ========================================================
# Stage 1: Install deps (FAST + FIX rollup)
# ========================================================
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./

# Harden network configs BEFORE running any installs
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm i -g npm@11 && \
    npm ci --include=optional --no-audit --progress=false --legacy-peer-deps

# ========================================================
# Stage 2: Build (NO rebuild → faster)
# ========================================================
FROM node:20-bookworm-slim AS builder
# Bring in TARGETPLATFORM dynamically from Buildx
ARG TARGETPLATFORM
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dynamically ensure the correct rollup native binary exists based on target architecture
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
      npm install @rollup/rollup-linux-arm64-gnu --no-save; \
    else \
      npm install @rollup/rollup-linux-x64-gnu --no-save; \
    fi

RUN npm run build

# Ensure runtime dirs exist (fix COPY error)
RUN mkdir -p /app/uploads /app/logs

# ========================================================
# Stage 3: Production deps only
# ========================================================
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app

COPY package.json package-lock.json* ./

# Harden network configs BEFORE running any installs
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm i -g npm@11 && \
    npm ci --omit=dev --include=optional --no-audit --progress=false --legacy-peer-deps

# ========================================================
# Stage 4: Distroless Runtime (MINIMUM VULNS)
# ========================================================
FROM gcr.io/distroless/nodejs20-debian12

WORKDIR /app
ENV NODE_ENV=production

# Copy only what is needed
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/api ./api
COPY --from=builder /app/lib ./lib

# Copy dirs safely (now they exist)
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/logs ./logs

# Non-root already enforced in distroless
EXPOSE 3000

CMD ["server.js"]