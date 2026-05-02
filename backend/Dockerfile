# =============================================================================
# Backend Dockerfile for LangGraph Server (TypeScript/Node.js)
# =============================================================================
# Generic LangGraph container for local development or non-Vercel workers.
#
# NOTE: This application uses LangGraph.js (TypeScript implementation).
# PostgreSQL is used by LangGraph for its internal state management.
# The PostgreSQL connection is injected via the DATABASE_URI environment variable.
#
# LangGraph uses PostgreSQL for:
# - Storing graph execution state
# - Managing checkpoints and interrupts
# - Persisting agent memory across sessions

# =============================================================================
# Build Stage
# =============================================================================
FROM node:20-slim AS base

# Build arguments for versioning
ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Set environment variables for build
ENV VERSION=${VERSION}
ENV COMMIT_SHA=${COMMIT_SHA}

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install yarn globally
RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# Copy package files from root (monorepo structure)
COPY package.json yarn.lock ./
COPY backend/ ./backend/
COPY langgraph.json ./
COPY tsconfig.json ./

# Install Node.js dependencies
RUN yarn install --frozen-lockfile

# Install Playwright with dependencies for screenshot capabilities
RUN npx -y playwright@1.57.0 install --with-deps chromium

# Build TypeScript
RUN yarn build

# =============================================================================
# Production Stage
# =============================================================================
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    # Playwright browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # PostgreSQL client libraries
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from base stage
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/backend ./backend
COPY --from=base /app/package.json ./
COPY --from=base /app/langgraph.json ./
COPY --from=base /app/tsconfig.json ./

# Create empty .env file (environment variables come from container runtime)
RUN touch .env

# Copy Playwright browsers
COPY --from=base /root/.cache/ms-playwright /root/.cache/ms-playwright

# Create non-root user for security
RUN groupadd -r flowpost && useradd -r -g flowpost flowpost
RUN chown -R flowpost:flowpost /app

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:54367/ok || exit 1

# Expose port
EXPOSE 54367

# =============================================================================
# Environment Variables
# =============================================================================
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=54367

# PostgreSQL connection for LangGraph state management
# DATABASE_URI is injected at runtime.
# Format: postgresql://user:password@host:5432/database
# This enables LangGraph to persist:
# - Graph execution checkpoints
# - Agent state and memory
# - Interrupt handling state

# =============================================================================
# Run Configuration
# =============================================================================
# Run as non-root user (commented out due to Playwright browser requirements)
# USER flowpost

# Start LangGraph server
CMD ["npx", "@langchain/langgraph-cli", "dev", "--host", "0.0.0.0", "--port", "54367"]
