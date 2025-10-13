FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml drizzle.config.ts ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .
