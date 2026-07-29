# ========================================================
# Stage 1: Install Dependencies
# ========================================================
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# Apply latest Debian security updates
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

# Configure npm for reliable installs
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci \
      --include=optional \
      --legacy-peer-deps \
      --no-audit \
      --progress=false

# ========================================================
# Stage 2: Build Application
# ========================================================
FROM node:20-bookworm-slim AS builder

ARG TARGETPLATFORM

WORKDIR /app

# Apply latest Debian security updates
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install correct Rollup native binary
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
      npm install --no-save @rollup/rollup-linux-arm64-gnu; \
    else \
      npm install --no-save @rollup/rollup-linux-x64-gnu; \
    fi

RUN npm run build

# Runtime directories
RUN mkdir -p /app/uploads /app/logs

# ========================================================
# Stage 3: Production Dependencies
# ========================================================
FROM node:20-bookworm-slim AS prod-deps

WORKDIR /app

# Apply latest Debian security updates
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 10 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci \
      --omit=dev \
      --include=optional \
      --legacy-peer-deps \
      --no-audit \
      --progress=false

# ========================================================
# Stage 4: Runtime
# ========================================================
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

# Apply latest Debian security updates
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/api ./api
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/logs ./logs

USER node

EXPOSE 3000

CMD ["node", "server.js"]