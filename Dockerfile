# Stage 1: Build
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@11.13.1

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json nest-cli.json ./

# Copy all sources and configuration
COPY src/ ./src
COPY scripts/ ./scripts
COPY test/ ./test
COPY .eslintrc.js .prettierrc .dependency-cruiser.js knip.json jest*.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the NestJS app
RUN pnpm build

# Prune dev dependencies for production
RUN pnpm install --prod --frozen-lockfile

# Stage 2: Production Run
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# Set Node environment
ENV NODE_ENV=production

# Create a non-root system user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy build artifacts and pruned dependencies from builder
COPY --from=builder --chown=appuser:appgroup /usr/src/app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /usr/src/app/package.json ./package.json

# Use non-root user
USER appuser

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
