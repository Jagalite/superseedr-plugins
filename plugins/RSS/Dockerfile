# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Final stage
FROM node:20-slim

WORKDIR /app

# Copy production dependencies
COPY --from=builder /app/node_modules ./node_modules
# Copy application code
COPY . .

# Environment variables
ENV PORT=3000
ENV WATCH_DIR=/superseedr-watch
ENV DATA_DIR=/data

# Ensure directories exist
RUN mkdir -p /superseedr-watch /data

EXPOSE 3000

CMD ["node", "server.js"]
