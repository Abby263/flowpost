# FlowPost Frontend

Modern dashboard for managing AI-powered social media automation workflows.

## Tech Stack

| Technology        | Purpose                              |
| ----------------- | ------------------------------------ |
| **Next.js 14**    | React framework with App Router      |
| **React 18**      | UI library                           |
| **TypeScript**    | Type-safe development                |
| **Tailwind CSS**  | Utility-first CSS framework          |
| **shadcn/ui**     | Accessible component library         |
| **Clerk**         | Authentication and user management   |
| **Supabase**      | Database and real-time subscriptions |
| **LangGraph SDK** | Backend API communication            |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Application                           │
│                    (Port 3000)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    App Router Pages                       │   │
│  │                                                           │   │
│  │  /                    Landing page                        │   │
│  │  /sign-in             Clerk authentication                │   │
│  │  /sign-up             User registration                   │   │
│  │  /dashboard           Main dashboard                      │   │
│  │  /dashboard/workflows Workflow management                 │   │
│  │  /dashboard/workflows/[id]  Workflow details              │   │
│  │  /dashboard/connections     Social account connections    │   │
│  │  /dashboard/analytics       Performance analytics         │   │
│  │  /dashboard/content-ideas   AI content suggestions        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    API Routes                             │   │
│  │                                                           │   │
│  │  /api/workflows       CRUD for workflows                  │   │
│  │  /api/connections     Manage social connections           │   │
│  │  /api/trigger-workflow  Start agent run                   │   │
│  │  /api/workflow-status   Poll run status                   │   │
│  │  /api/posts           View generated posts                │   │
│  │  /api/health          Container health check              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Shared Components                      │   │
│  │                                                           │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐              │   │
│  │  │ Navbar    │ │ Workflow  │ │ Schedule  │              │   │
│  │  │           │ │ Card      │ │ Dialog    │              │   │
│  │  └───────────┘ └───────────┘ └───────────┘              │   │
│  │                                                           │   │
│  │  shadcn/ui: Button, Card, Dialog, Input, Select, etc.    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Clerk Auth     │ │  Supabase DB    │ │  LangGraph      │
│                 │ │                 │ │  Backend        │
│  - Sign in/up   │ │  - Workflows    │ │                 │
│  - Sessions     │ │  - Connections  │ │  - Agent runs   │
│  - User mgmt    │ │  - Posts        │ │  - Status       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Directory Structure

```
frontend/
├── app/                       # Next.js App Router
│   ├── api/                   # API routes
│   │   ├── connections/       # Social connection APIs
│   │   ├── content-ideas/     # Content suggestion APIs
│   │   ├── health/            # Health check endpoint
│   │   ├── posts/             # Post management APIs
│   │   ├── schedule-post/     # Post scheduling APIs
│   │   ├── trigger-workflow/  # Start agent runs
│   │   ├── workflow-status/   # Poll run status
│   │   └── workflows/         # Workflow CRUD
│   ├── dashboard/             # Dashboard pages
│   │   ├── analytics/         # Analytics page
│   │   ├── connections/       # Connections page
│   │   ├── content-ideas/     # Content ideas page
│   │   ├── schedule-post/     # Schedule post page
│   │   └── workflows/         # Workflows pages
│   ├── sign-in/               # Clerk sign-in
│   ├── sign-up/               # Clerk sign-up
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Landing page
│   └── globals.css            # Global styles
├── components/                # React components
│   ├── ui/                    # shadcn/ui components
│   ├── navbar.tsx             # Navigation bar
│   ├── workflow-card.tsx      # Workflow display card
│   ├── edit-workflow-modal.tsx
│   └── schedule-workflow-dialog.tsx
├── lib/                       # Utilities
│   ├── utils.ts               # Helper functions
│   ├── supabase-admin.ts      # Supabase client
│   └── gemini.ts              # Gemini AI client
├── public/                    # Static assets
├── next.config.mjs            # Next.js configuration
├── tailwind.config.js         # Tailwind configuration
└── tsconfig.json              # TypeScript configuration
```

## Features

### Dashboard

- **Workflow Management**: Create, edit, delete, and run automation workflows
- **Connection Management**: Connect and manage social media accounts
- **Analytics**: View post performance and engagement metrics
- **Content Ideas**: AI-powered content suggestions

### Workflow Configuration

- **Search Query**: Define content discovery criteria
- **Platform**: Select target social platform (Twitter, LinkedIn, Instagram)
- **Schedule**: Set posting frequency (daily, weekly, monthly)
- **Style Prompt**: Customize content generation style
- **Approval Mode**: Enable human-in-the-loop review

## Development

### Prerequisites

- Node.js 20+
- pnpm package manager
- Clerk account (for authentication)
- Supabase project (for database)

### Running Locally

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Environment Variables

Create a `.env.local` file or use the root `.env`:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# LangGraph Backend
LANGGRAPH_API_URL=http://localhost:54367

# Stripe (for subscriptions & payments)
STRIPE_SECRET_KEY=sk_live_...              # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...           # Webhook signing secret
NEXT_PUBLIC_APP_URL=https://your-domain.com  # For Stripe redirect URLs
```

## Testing

Tests are located in `/tests/frontend/`:

```bash
# Run frontend tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## Building for Production

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## Docker

Build the frontend container:

```bash
docker build -t flowpost-frontend -f frontend/Dockerfile .
```

The Dockerfile uses Next.js standalone output for minimal container size.

## API Reference

### POST /api/trigger-workflow

Trigger an agent workflow run.

```typescript
// Request
{
  workflowId: string
}

// Response
{
  success: boolean,
  runId: string,
  threadId: string
}
```

### GET /api/workflow-status

Get the status of a running workflow.

```typescript
// Query params
?runId=xxx&threadId=yyy

// Response
{
  status: "pending" | "running" | "success" | "error",
  result: object
}
```

### GET /api/health

Container health check endpoint.

```typescript
// Response
{
  status: "healthy" | "degraded",
  timestamp: string,
  uptime: number,
  checks: {
    supabase: boolean,
    clerk: boolean,
    langgraph: boolean
  }
}
```

## Deployment

See [Azure deployment documentation](/azure/README.md) for production deployment instructions.
