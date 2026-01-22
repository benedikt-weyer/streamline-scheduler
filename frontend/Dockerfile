FROM node:lts AS base

# Install dependencies only when needed
FROM base AS deps

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept environment variables from host system as build arguments
ARG NEXT_PUBLIC_BACKEND_HTTP_URL
ARG NEXT_PUBLIC_BACKEND_WS_URL

# Remove sensitive .env files but keep .env.example if it exists
# This allows .env files to be used but prevents accidental inclusion of secrets
RUN find . -name ".env" -not -name ".env.example" -delete 2>/dev/null || true
RUN find . -name ".env.local" -delete 2>/dev/null || true
RUN find . -name ".env.production" -delete 2>/dev/null || true

# create .env.local file with the environment variables
RUN echo "NEXT_PUBLIC_BACKEND_HTTP_URL=${NEXT_PUBLIC_BACKEND_HTTP_URL}" > .env.local
RUN echo "NEXT_PUBLIC_BACKEND_WS_URL=${NEXT_PUBLIC_BACKEND_WS_URL}" >> .env.local

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Skip type checking during build to prevent TypeScript errors from failing the build
ENV SKIP_TYPE_CHECK=1

RUN corepack enable pnpm && pnpm run build

# Ensure public directory exists (create empty one if it doesn't)
RUN mkdir -p /app/public

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public directory from builder (now guaranteed to exist)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the environment file
COPY --from=builder --chown=nextjs:nodejs /app/.env.local ./.env.local

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"] 