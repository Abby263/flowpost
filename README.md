# FlowPost

**AI-Powered Social Media Automation Platform**

FlowPost automates content discovery, image generation with DALL-E 3, and posting to Instagram, Twitter, and LinkedIn. Create custom workflows to maintain a consistent social media presence.

![FlowPost Landing Page](./docs/landing_page.png)

## Features

- 🤖 **AI Content Discovery** - Find relevant content using Serper API
- 🎨 **AI Image Generation** - Create visuals with DALL-E 3 or Gemini
- 📱 **Multi-Platform Support** - Post to Instagram, Twitter, and LinkedIn
- ⏰ **Smart Scheduling** - Daily, weekly, or monthly automation
- 📊 **Analytics Dashboard** - Track post performance
- 🔐 **Secure Credentials** - Manage platform credentials via UI

## Quick Start

### Prerequisites

- **Node.js 20+** - Required for LangGraph
- **pnpm** - For web UI dependencies (`npm install -g pnpm`)
- [OpenAI API Key](https://platform.openai.com/) - For AI and image generation
- [Serper API Key](https://serper.dev/) - For content discovery
- [Supabase Account](https://supabase.com/) - For database (free tier available)
- [Clerk Account](https://clerk.com/) - For authentication (free tier available)

### Installation

```bash
# Clone and install
git clone https://github.com/langchain-ai/social-media-agent.git
cd social-media-agent
yarn install

# Install frontend dependencies (requires pnpm)
npm install -g pnpm  # If not already installed
cd frontend && pnpm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your API keys
```

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your dashboard
3. Run the contents of `supabase/schema.sql`
4. Create a storage bucket named `images` (set to public)

### Run the Application

**Option 1: Quick Start (Recommended)**

```bash
# Run both backend and frontend with one command
./run.sh
```

This script automatically:

- Clears ports 54367 and 3000
- Checks and installs dependencies
- Starts LangGraph backend at `http://localhost:54367`
- Starts Next.js frontend at `http://localhost:3000`

**Option 2: Run Separately**

_Terminal 1 - LangGraph Backend:_

```bash
yarn dev
```

Server starts at `http://localhost:54367`

_Terminal 2 - Frontend:_

```bash
cd frontend && pnpm dev
```

App starts at `http://localhost:3000`

**Option 3: Docker Compose**

```bash
docker compose up --build
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required
OPENAI_API_KEY=sk-your_key
SERPER_API_KEY=your_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_your_key
CLERK_SECRET_KEY=sk_your_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Optional - LangChain Monitoring
LANGCHAIN_API_KEY=your_key
LANGSMITH_TRACING_V2=true

# Optional - Model Configuration
AI_PROVIDER=openai  # or 'gemini'
LLM_MODEL=gpt-4o
IMAGE_MODEL=dall-e-3

# Optional - Platform Credentials (can add via UI instead)
INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password
```

## Usage

### 1. Connect Social Media Accounts

Navigate to **Dashboard > Connections** and add credentials:

- **Instagram**: Username and password
- **Twitter**: API credentials (OAuth tokens)
- **LinkedIn**: Access token

![Connections Dashboard](./docs/connections.png)

### 2. Create a Workflow

Go to **Dashboard > Workflows** and configure:

1. Select platform (Instagram, Twitter, LinkedIn)
2. Enter search query for content discovery
3. Set location (optional)
4. Choose image style for generation
5. Set schedule (daily, weekly, monthly)

![Workflows Dashboard](./docs/workflows.png)

### 3. Run and Monitor

- **Manual Run**: Click "Run Now" to test
- **Automatic**: Scheduled workflows run automatically
- **View Details**: See run history and analytics

## Deployment

### Azure Container Apps (One-Command Setup)

Run the setup script to deploy everything:

```bash
./scripts/azure-setup.sh
```

This single script will:

- ✅ Create all Azure resources (Container Registry, Container Apps, etc.)
- ✅ Configure GitHub Actions for CI/CD
- ✅ Build and deploy Docker images
- ✅ Set up automatic deployments on push

**After setup, deployments are automatic:**

- Push to `develop` → Deploys to Dev
- Push to `uat` → Deploys to UAT
- Push to `main` → Deploys to Production

See [docs/AZURE_DEPLOYMENT.md](./docs/AZURE_DEPLOYMENT.md) for detailed documentation.

## Project Structure

```
flowpost/
├── backend/             # LangGraph backend (AI agents)
│   ├── agents/          # LangGraph workflow agents
│   ├── clients/         # Social media platform clients
│   └── utils/           # Utility functions
├── frontend/            # Next.js web dashboard
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   └── lib/             # Utilities
├── terraform/           # Infrastructure as Code
│   ├── modules/         # Reusable Terraform modules
│   └── environments/    # Environment configs (dev/uat/prod)
├── tests/               # All test files
│   ├── backend/         # Backend unit tests (Jest)
│   ├── frontend/        # Frontend unit tests (Jest)
│   └── e2e/             # E2E tests (Playwright)
├── docs/                # Documentation
├── scripts/             # Operational scripts (crons, backfill)
├── supabase/            # Database schema (run manually)
├── docker-compose.yml   # Local Docker orchestration
└── langgraph.json       # LangGraph configuration
```

For detailed documentation:

- **Backend**: [backend/README.md](./backend/README.md)
- **Frontend**: [frontend/README.md](./frontend/README.md)
- **Terraform**: [terraform/README.md](./terraform/README.md)
- **Deployment**: [docs/AZURE_DEPLOYMENT.md](./docs/AZURE_DEPLOYMENT.md)
- **Tests**: [tests/README.md](./tests/README.md)

## Troubleshooting

**Port already in use**

- Use the `./run.sh` script which automatically clears ports
- Or manually clear: `lsof -ti:3000 | xargs kill -9` and `lsof -ti:54367 | xargs kill -9`

**"Supabase not configured"**

- Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

**"Instagram login failed"**

- Verify credentials are correct
- Try logging in manually to check for security challenges

**"Image generation failed"**

- Check OpenAI API key has DALL-E access
- Verify sufficient API credits

**Frontend dependency install fails**

- Make sure you're using pnpm: `pnpm install` (not yarn or npm)
- Clear node_modules and retry: `rm -rf node_modules && pnpm install`

## License

MIT

---

Built with [LangGraph](https://github.com/langchain-ai/langgraph), [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), and [Clerk](https://clerk.com/)
