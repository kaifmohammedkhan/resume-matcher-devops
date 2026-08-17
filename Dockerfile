# ========================================================
# Stage 1: Install Dependencies
# ========================================================
FROM node:20-bookworm-slim AS deps

WORKDIR /app

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
      --progress=false \
      --ignore-scripts

# ========================================================
# Stage 2: Build Application
# ========================================================
FROM node:20-bookworm-slim AS builder

ARG TARGETPLATFORM

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install correct Rollup native binary
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
      npm install --no-save --ignore-scripts @rollup/rollup-linux-arm64-gnu@4.62.3; \
    else \
      npm install --no-save --ignore-scripts @rollup/rollup-linux-x64-gnu@4.62.3; \
    fi

RUN npm run build

# Runtime directories
RUN mkdir -p /app/uploads /app/logs

# ========================================================
# Stage 3: Production Dependencies
# ========================================================
FROM node:20-bookworm-slim AS prod-deps

WORKDIR /app

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
      --progress=false \
      --ignore-scripts

# ========================================================
# Stage 4: Runtime
# ========================================================
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Apply latest Debian security updates
RUN apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy only production application files
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/api ./api
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/uploads ./uploads
COPY --from=builder /app/logs ./logs

# Remove npm from the final runtime image.
# npm is required during build stages but is not required
# to execute the production application.
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /root/.npm \
      /home/node/.npm

USER node

EXPOSE 3000

CMD ["node", "server.js"]