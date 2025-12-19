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

# Install web UI dependencies (requires pnpm)
npm install -g pnpm  # If not already installed
cd web && pnpm install && cd ..

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

*Terminal 1 - LangGraph Backend:*
```bash
yarn dev
```
Server starts at `http://localhost:54367`

*Terminal 2 - Web UI:*
```bash
cd web && pnpm dev
```
App starts at `http://localhost:3000`

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

### Deploy Web UI to Vercel

1. Push to GitHub
2. Import to [Vercel](https://vercel.com)
3. Framework: **Next.js**
4. Root Directory: **web**
5. Add environment variables in Vercel dashboard
6. Deploy!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

### Deploy Backend to LangGraph Cloud

```bash
pip install langgraph-cli
langgraph login
langgraph deploy
```

Update `LANGGRAPH_API_URL` in Vercel with your deployment URL.

## Project Structure

```
flowpost/
├── src/
│   ├── agents/          # LangGraph workflow agents
│   ├── clients/         # Social media platform clients
│   └── utils/           # Utility functions
├── web/                 # Next.js web UI
├── supabase/            # Database schema
├── scripts/             # Utility scripts
└── langgraph.json       # LangGraph configuration
```

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

**Web dependency install fails**
- Make sure you're using pnpm: `pnpm install` (not yarn or npm)
- Clear node_modules and retry: `rm -rf node_modules && pnpm install`

## License

MIT

---

Built with [LangGraph](https://github.com/langchain-ai/langgraph), [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), and [Clerk](https://clerk.com/)
