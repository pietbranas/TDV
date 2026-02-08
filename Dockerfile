# Build stage
FROM node:18-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

# Production stage - use node:18-slim instead of alpine for better Prisma compatibility
FROM node:18-slim AS production

# Install OpenSSL and other required libraries
RUN apt-get update && apt-get install -y openssl libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend build
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Install production dependencies only
RUN cd backend && npm install --omit=dev

# Generate Prisma client for the correct platform
RUN cd backend && npx prisma generate

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nodejs
USER nodejs

EXPOSE 3001

WORKDIR /app/backend

CMD ["node", "dist/index.js"]