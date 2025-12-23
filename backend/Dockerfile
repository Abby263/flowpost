# Backend Dockerfile for LangGraph Server
# Optimized for Azure Container Apps

FROM node:20-bookworm-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files from root (monorepo structure)
COPY package.json yarn.lock ./
COPY backend/ ./backend/
COPY langgraph.json ./
COPY tsconfig.json ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Install Playwright with dependencies for screenshot capabilities
RUN npx -y playwright@1.49.1 install --with-deps chromium

# Build TypeScript
RUN yarn build

# Production stage
FROM node:20-bookworm-slim AS production

# Install runtime dependencies for Playwright
RUN apt-get update && apt-get install -y \
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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/backend ./backend
COPY --from=base /app/package.json ./
COPY --from=base /app/langgraph.json ./
COPY --from=base /app/tsconfig.json ./

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

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=54367

# Run as non-root user (commented out due to Playwright browser requirements)
# USER flowpost

# Start LangGraph server
CMD ["npx", "@langchain/langgraph-cli", "dev", "--host", "0.0.0.0", "--port", "54367"]
