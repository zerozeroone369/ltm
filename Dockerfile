FROM node:20-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./server/

WORKDIR /app/server
RUN npm install --production

# Copy source and client
WORKDIR /app
COPY server ./server
COPY client ./client
COPY uploads ./uploads

WORKDIR /app/server

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["npm", "start"]

