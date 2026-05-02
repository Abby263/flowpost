# FlowPost Backend

AI-powered social media automation backend built with LangGraph and LangChain.

## Tech Stack

| Technology       | Purpose                                     |
| ---------------- | ------------------------------------------- |
| **LangGraph**    | Agent orchestration and workflow management |
| **LangChain**    | LLM integration and prompt management       |
| **TypeScript**   | Type-safe development                       |
| **Node.js 20**   | Runtime environment                         |
| **OpenAI GPT-4** | Content generation and analysis             |
| **Gemini 2.0**   | Content & Image generation                  |
| **Playwright**   | Web scraping and screenshots                |
| **Supabase**     | Hosted Postgres database                    |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LangGraph Server                              │
│                    (Port 54367)                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Agent Workflows                        │   │
│  │                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                │   │
│  │  │ content_auto    │  │ generate_post   │                │   │
│  │  │ mation_advanced │  │                 │                │   │
│  │  └────────┬────────┘  └────────┬────────┘                │   │
│  │           │                    │                          │   │
│  │  ┌────────▼────────┐  ┌────────▼────────┐                │   │
│  │  │ curate_data     │  │ upload_post     │                │   │
│  │  └────────┬────────┘  └────────┬────────┘                │   │
│  │           │                    │                          │   │
│  │  ┌────────▼────────┐  ┌────────▼────────┐                │   │
│  │  │ verify_tweet    │  │ generate_thread │                │   │
│  │  │ verify_reddit   │  │                 │                │   │
│  │  └─────────────────┘  └─────────────────┘                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Shared Services                        │   │
│  │                                                           │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │   │
│  │  │ LLM Utils │ │ Supabase  │ │ Image Gen │ │ Firecrawl │ │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│                                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │ Twitter   │ │ LinkedIn  │ │ Instagram │ │ Reddit    │       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                     │
│  │ OpenAI    │ │ Supabase  │ │ Slack     │                     │
│  └───────────┘ └───────────┘ └───────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
backend/
├── agents/                    # LangGraph agent definitions
│   ├── content-automation/    # Main content automation workflow
│   ├── content-automation-advanced/  # Enhanced workflow with UI
│   ├── curate-data/          # Data collection and curation
│   ├── generate-post/        # Post generation logic
│   ├── generate-thread/      # Twitter thread generation
│   ├── generate-report/      # Content report generation
│   ├── ingest-data/          # Data ingestion workflows
│   ├── repurposer/           # Content repurposing
│   ├── supervisor/           # Multi-agent supervisor
│   ├── verify-tweet/         # Tweet verification
│   ├── verify-reddit-post/   # Reddit post verification
│   ├── upload-post/          # Post upload to platforms
│   ├── curated-post-interrupt/ # Human-in-the-loop for curated posts
│   ├── find-images/          # Find images for posts
│   ├── ingest-repurposed-data/ # Ingest data for repurposing
│   ├── reflection/           # Self-reflection and prompt optimization
│   ├── repurposer-post-interrupt/ # Human-in-the-loop for repurposed posts
│   ├── verify-links/         # Link verification and content extraction
│   └── shared/               # Shared utilities and nodes
├── clients/                   # External service clients
│   ├── twitter/              # Twitter API client
│   ├── linkedin.ts           # LinkedIn API client
│   ├── instagram/            # Instagram API client
│   ├── reddit/               # Reddit API client
│   └── slack/                # Slack API client
└── utils/                     # Utility functions
    ├── llm.ts                # LLM configuration
    ├── postgres.ts           # Database client
    ├── image-generation.ts   # Image generation
    ├── screenshot.ts         # Web screenshots
    ├── firecrawl.ts          # Web scraping
    └── env.ts                # Environment validation
```

## Agent Workflows

### Content Automation Advanced

The main workflow that orchestrates content discovery, generation, and posting.

```
Input → Curate Data → Generate Post → Human Review → Upload Post
```

### Available Graphs

| Graph                         | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `content_automation_advanced` | Full content automation with human-in-the-loop |
| `generate_post`               | Generate a single post from content            |
| `curate_data`                 | Collect and curate content from sources        |
| `upload_post`                 | Upload posts to social platforms               |
| `generate_thread`             | Generate Twitter threads                       |
| `repurposer`                  | Repurpose existing content                     |
| `verify_links`                | Verify and extract content from links          |
| `reflection`                  | Optimize prompts based on user feedback        |
| `find_images`                 | Find or generate images for posts              |
| `ingest_repurposed_data`      | Ingest external data for repurposing           |

## Development

### Prerequisites

- Node.js 20+
- Yarn package manager
- OpenAI API key
- Supabase project

### Running Locally

```bash
# From project root
yarn dev

# Or directly
npx @langchain/langgraph-cli dev --port 54367
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
DATABASE_URI=postgresql://postgres.project_ref:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
POSTGRES_POOL_MAX=1

# Optional
LANGCHAIN_API_KEY=...          # For LangSmith tracing
SERPER_API_KEY=...             # For web search
FIRECRAWL_API_KEY=...          # For web scraping

# Social Media (as needed)
TWITTER_API_KEY=...
LINKEDIN_CLIENT_ID=...
INSTAGRAM_USERNAME=...
```

### API Endpoints

The LangGraph server exposes these endpoints:

| Endpoint                          | Description            |
| --------------------------------- | ---------------------- |
| `POST /runs`                      | Create a new agent run |
| `GET /runs/{run_id}`              | Get run status         |
| `GET /threads/{thread_id}/state`  | Get thread state       |
| `POST /threads/{thread_id}/state` | Update thread state    |
| `GET /ok`                         | Health check           |

## Testing

Tests are located in `/tests/backend/`:

```bash
# Run backend tests
yarn test

# Run with coverage
yarn test:coverage
```

## Docker

Build the backend container:

```bash
docker build -t flowpost-backend -f backend/Dockerfile .
```

## Production Deployment

See the root README for Vercel, Clerk, and Supabase deployment instructions.
