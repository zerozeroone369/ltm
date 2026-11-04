FROM node:22-bookworm-slim

WORKDIR /app

# Install native compilation dependencies for SQLite
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for optimal caching
COPY server/package*.json ./server/

# Install server production dependencies
WORKDIR /app/server
RUN npm install --omit=dev

# Copy application source files
WORKDIR /app
COPY server/src ./server/src
COPY client ./client
COPY uploads ./uploads

# Ensure upload directory exists
RUN mkdir -p /app/server/uploads/documents

WORKDIR /app/server

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
