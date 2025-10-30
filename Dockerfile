# 🔧 Stage 1: Build frontend and prepare backend
FROM node:18-bullseye AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build frontend
COPY . .
RUN npm run build

# 🧼 Stage 2: Runtime container (glibc-based for native modules)
FROM node:18-bullseye
WORKDIR /app

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy backend files
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/api ./api
COPY --from=builder /app/lib ./lib

# Copy package files and install only production deps
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Optional cleanup for smaller image
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Expose port and start server
EXPOSE 3000
CMD ["node", "server.js"]
