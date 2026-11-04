FROM node:20-bookworm-slim

WORKDIR /app

# Cài đặt build tools cho native SQLite addon
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY server/package*.json ./server/

WORKDIR /app/server
RUN npm install --production --build-from-source=better-sqlite3

# Copy application files
WORKDIR /app
COPY server ./server
COPY client ./client
COPY uploads ./uploads

WORKDIR /app/server

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
