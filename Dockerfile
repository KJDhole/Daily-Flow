# Multi-stage build for Daily Flow
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package configurations
COPY package.json package-lock.json* bun.lock* ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build frontend static bundle
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Shanghai

COPY package.json ./
RUN npm install --omit=dev

# Copy built frontend assets and bundled server from builder
COPY --from=builder /app/dist ./dist

# Ensure data directory for persistent SQLite database
ENV DAILY_FLOW_DATA_DIR=/app/data
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "dist/server.js"]
