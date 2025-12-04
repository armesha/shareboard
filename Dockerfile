# Stage 1: Build frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY shared ./shared

RUN npm ci --include=optional

COPY client ./client
COPY vite.config.js ./

RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY shared ./shared

RUN npm ci --omit=dev --include=optional

COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
