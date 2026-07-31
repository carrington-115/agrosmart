# AgroSmart dashboard.
#
# Three stages. The runtime image contains Next's standalone output and nothing
# else — no pnpm store, no devDependencies, no source.

# ---------------------------------------------------------------- deps
FROM node:22-alpine AS deps

# COREPACK_ENABLE_DOWNLOAD_PROMPT=0 because corepack otherwise prompts before
# fetching the pnpm version pinned in package.json's `packageManager`, and a
# prompt in a non-interactive build just hangs or fails.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# Lockfile-only layer: dependencies reinstall only when the lockfile moves, not
# on every source edit. --frozen-lockfile makes a drifted lockfile a build
# failure rather than a silent resolution.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile

# ---------------------------------------------------------------- build
FROM node:22-alpine AS builder

# COREPACK_ENABLE_DOWNLOAD_PROMPT=0 because corepack otherwise prompts before
# fetching the pnpm version pinned in package.json's `packageManager`, and a
# prompt in a non-interactive build just hangs or fails.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present now — passing them at runtime would have no effect. They are
# publishable by definition: the anon key is already shipped to every browser.
#
# SUPABASE_SERVICE_ROLE_KEY is deliberately absent and must never be added here.
# It bypasses RLS, and a build arg would bake it into an image layer.
#
# The agroapi base URL is deliberately NOT here either, and should not be added
# during the frontend cutover. lib/queries.ts will call the backend from Server
# Components, which read ordinary runtime environment variables — only client
# code needs NEXT_PUBLIC_ inlining, and every client fetch in this app targets a
# relative path. Baking the API host in would force one image per environment for
# no benefit; leaving it out means one image deploys everywhere.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---------------------------------------------------------------- runtime
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 10001 nodejs \
 && adduser --system --uid 10001 --ingroup nodejs nextjs

WORKDIR /app

# `output: "standalone"` traces the actual import graph and emits only the files
# the server reaches, so node_modules never enters this stage. See next.config.ts.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
