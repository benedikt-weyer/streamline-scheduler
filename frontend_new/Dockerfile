# Build stage
FROM node:20-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build argument for backend URL
ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine as runner

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S sveltekit -u 1001

# Change ownership to nodejs user
RUN chown -R sveltekit:nodejs /app
USER sveltekit

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start the application
CMD ["node", "build"]
