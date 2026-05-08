#!/bin/bash

# ===========================================
# FlowPost - Run Backend and Frontend
# ===========================================
# This script starts both the LangGraph backend and Next.js frontend
# with automatic port clearing and dependency checking.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports configuration
BACKEND_PORT=54367
FRONTEND_PORT=3000

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║         FlowPost Development Server       ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Function to clear a port
clear_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}⚠ Port $port is in use. Killing process $pid...${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✓ Port $port cleared${NC}"
    else
        echo -e "${GREEN}✓ Port $port is available${NC}"
    fi
}

# Function to check if dependencies are installed
check_dependencies() {
    echo -e "\n${BLUE}📦 Checking dependencies...${NC}"
    
    # Check root dependencies
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing root dependencies...${NC}"
        yarn install
    else
        echo -e "${GREEN}✓ Root dependencies installed${NC}"
    fi
    
    # Check frontend dependencies
    if [ ! -d "frontend/node_modules" ]; then
        echo -e "${YELLOW}Installing frontend dependencies...${NC}"
        cd frontend && pnpm install && cd ..
    else
        echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    fi
}

# Function to check for .env file
check_env() {
    echo -e "\n${BLUE}🔐 Checking environment configuration...${NC}"
    
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}⚠ No .env file found. Creating from .env.example...${NC}"
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}✓ Created .env file. Please edit it with your API keys.${NC}"
        else
            echo -e "${RED}✗ No .env.example found. Please create .env file manually.${NC}"
        fi
    else
        echo -e "${GREEN}✓ .env file exists${NC}"
    fi
}

# Function to start the backend
start_backend() {
    echo -e "\n${BLUE}🚀 Starting LangGraph Backend on port $BACKEND_PORT...${NC}"
    npx @langchain/langgraph-cli@latest dev --port $BACKEND_PORT &
    BACKEND_PID=$!
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
}

# Function to start the frontend
start_frontend() {
    echo -e "\n${BLUE}🎨 Starting Next.js Frontend on port $FRONTEND_PORT...${NC}"
    cd frontend && pnpm dev &
    FRONTEND_PID=$!
    cd ..
    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
}

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    
    # Kill backend
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Kill frontend
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Clear ports to be safe
    clear_port $BACKEND_PORT
    clear_port $FRONTEND_PORT
    
    echo -e "${GREEN}✓ All servers stopped. Goodbye!${NC}"
    exit 0
}

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    # Get the script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "$SCRIPT_DIR"
    
    echo -e "${BLUE}📁 Working directory: $SCRIPT_DIR${NC}"
    
    # Clear ports
    echo -e "\n${BLUE}🔌 Clearing ports...${NC}"
    clear_port $BACKEND_PORT
    clear_port $FRONTEND_PORT
    
    # Check dependencies
    check_dependencies
    
    # Check environment
    check_env
    
    # Start servers
    start_backend
    
    # Wait a bit for backend to start
    sleep 3
    
    start_frontend
    
    # Print success message
    echo -e "\n${GREEN}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           All services running!           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BLUE}🖥  Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo -e "  ${BLUE}🌐 Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo -e "  ${BLUE}📊 Studio:${NC}   https://smith.langchain.com/studio?baseUrl=http://localhost:$BACKEND_PORT"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
    echo ""
    
    # Wait for both processes
    wait
}

# Run main function
main
