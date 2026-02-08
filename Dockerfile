# Build stage
FROM node:18-alpine AS builder

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

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy backend build
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/prisma ./backend/prisma

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Install production dependencies only
RUN cd backend && npm install --production

# Generate Prisma client
RUN cd backend && npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3001

WORKDIR /app/backend

CMD ["node", "dist/index.js"]