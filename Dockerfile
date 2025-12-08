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

# Install all dependencies including dev dependencies for tsx
RUN npm ci --include=optional

COPY server ./server
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
