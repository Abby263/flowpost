#!/bin/bash
# ==============================================================================
# FlowPost Database Migration Script
# ==============================================================================
# This script runs SQL migrations against the configured Postgres database.
#
# Prerequisites:
#   - psql (PostgreSQL client) installed
#   - DATABASE_URI environment variable set OR passed as argument
#
# Usage:
#   ./scripts/run-migration.sh [migration_file]
#   ./scripts/run-migration.sh migrations/001_initial_schema.sql
#
# Environment Variables:
#   DATABASE_URI - PostgreSQL connection string
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "FlowPost Database Migration"
echo "======================================"

# Check for psql
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql (PostgreSQL client) is not installed.${NC}"
    echo "Install it with:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt install postgresql-client"
    exit 1
fi

# Get DATABASE_URI
if [ -z "$DATABASE_URI" ]; then
    echo -e "${YELLOW}DATABASE_URI not set in environment.${NC}"
    echo "Please enter your PostgreSQL connection string:"
    read -s DATABASE_URI
    echo ""
fi

if [ -z "$DATABASE_URI" ]; then
    echo -e "${RED}Error: DATABASE_URI is required.${NC}"
    exit 1
fi

# Determine migration file
MIGRATION_FILE="${1:-migrations/001_initial_schema.sql}"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}Running migration: $MIGRATION_FILE${NC}"
echo ""

# Run migration
if psql "$DATABASE_URI" -f "$MIGRATION_FILE"; then
    echo ""
    echo -e "${GREEN}======================================"
    echo "Migration completed successfully!"
    echo "======================================${NC}"
else
    echo ""
    echo -e "${RED}======================================"
    echo "Migration failed!"
    echo "======================================${NC}"
    exit 1
fi
