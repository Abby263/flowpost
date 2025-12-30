# =============================================================================
# Backend Dockerfile for LangGraph Server
# =============================================================================
# Optimized for Azure Container Apps with PostgreSQL support
#
# NOTE: This application does not directly use PostgreSQL in its own code.
# Instead, PostgreSQL is used by LangGraph Platform API for its internal
# state management. The PostgreSQL connection is injected to LangGraph
# via the DATABASE_URI environment variable.
#
# LangGraph API uses PostgreSQL for:
# - Storing graph execution state
# - Managing checkpoints and interrupts
# - Persisting agent memory across sessions

# =============================================================================
# Build Stage
# =============================================================================
FROM langchain/langgraph-api:3.12 AS base

# Build arguments for versioning
ARG VERSION=dev
ARG COMMIT_SHA=unknown

# Set environment variables for build
ENV VERSION=${VERSION}
ENV COMMIT_SHA=${COMMIT_SHA}

WORKDIR /app

# Copy package files from root (monorepo structure)
COPY package.json yarn.lock ./
COPY backend/ ./backend/
COPY langgraph.json ./
COPY tsconfig.json ./

# Install dependencies
RUN pip install --no-cache-dir psycopg2-binary

# Install Node.js dependencies
RUN yarn install --frozen-lockfile

# Install Playwright with dependencies for screenshot capabilities
RUN npx -y playwright@1.57.0 install --with-deps chromium

# Build TypeScript
RUN yarn build

# =============================================================================
# Production Stage
# =============================================================================
FROM langchain/langgraph-api:3.12 AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
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
    # PostgreSQL client libraries for psycopg2
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Install psycopg2-binary for PostgreSQL connectivity
RUN pip install --no-cache-dir psycopg2-binary

WORKDIR /app

# Copy built application
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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:54367/ok || exit 1

# Expose port
EXPOSE 54367

# =============================================================================
# Environment Variables
# =============================================================================
# Standard environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=54367

# PostgreSQL connection for LangGraph state management
# DATABASE_URI is injected at runtime from Azure Key Vault
# Format: postgresql://user:password@host:5432/database?sslmode=require
# This enables LangGraph to persist:
# - Graph execution checkpoints
# - Agent state and memory
# - Interrupt handling state

# =============================================================================
# Run Configuration
# =============================================================================
# Run as non-root user (commented out due to Playwright browser requirements)
# USER flowpost

# Start LangGraph server with PostgreSQL backend
# The server automatically detects DATABASE_URI and configures PostgreSQL storage
CMD ["npx", "@langchain/langgraph-cli", "dev", "--host", "0.0.0.0", "--port", "54367"]
