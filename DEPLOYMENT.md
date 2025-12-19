# FlowPost Deployment Guide

Deploy FlowPost to production using **Vercel** (web UI) and **LangGraph Cloud** (backend).

## Architecture

```
flowpost/
├── src/          # LangGraph backend agents
├── web/          # Next.js web UI
└── .env          # Environment configuration
```

- **Web UI** → Vercel (Next.js)
- **Backend** → LangGraph Cloud

---

## Part 1: Deploy Web UI to Vercel

### Via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import your GitHub repository
3. Configure settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `web`
   - ⚠️ Do NOT select FastAPI

4. Add Environment Variables:

```bash
# Supabase (server-only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_key
CLERK_SECRET_KEY=sk_live_your_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# LangGraph (add after backend deployment)
LANGGRAPH_API_URL=https://your-deployment.langchain.app
```

5. Click Deploy

### Via Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

---

## Part 2: Deploy LangGraph Backend

### To LangGraph Cloud

```bash
# Install CLI
pip install langgraph-cli

# Login and deploy
langgraph login
langgraph deploy
```

Add environment variables in LangGraph Cloud dashboard:

```bash
OPENAI_API_KEY=sk-your_key
SERPER_API_KEY=your_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key
LANGCHAIN_API_KEY=your_key
```

After deployment, update `LANGGRAPH_API_URL` in Vercel.

### Self-Host (Alternative)

```bash
langgraph build -t flowpost-backend
# Deploy Docker image to AWS ECS, Cloud Run, Railway, etc.
```

---

## Security Checklist

- [ ] Use production Clerk keys (`pk_live_`, `sk_live_`)
- [ ] Use production Supabase project
- [ ] Never commit `.env` files
- [ ] Enable RLS in Supabase for production
- [ ] Ensure Clerk JWT `sub` matches `connections.user_id`/`workflows.user_id`/`posts.user_id`
- [ ] Update Clerk allowed origins with Vercel URL

---

## Testing Deployment

1. Visit your Vercel URL
2. Test sign up/sign in
3. Navigate to `/dashboard`
4. Create a workflow and run it
5. Verify posts appear in dashboard

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| Framework preset not found | Select **Next.js**, not FastAPI |
| Cannot find web directory | Set Root Directory to `web` |
| Clerk keys not defined | Add all `NEXT_PUBLIC_CLERK_*` variables |
| Failed to connect to Supabase | Check CORS settings, verify URL |
| LangGraph API not reachable | Deploy backend first, update URL |

---

## Cost Estimates

- **Vercel**: Free (Hobby) / $20/month (Pro)
- **LangGraph Cloud**: Pay per execution
- **OpenAI**: ~$0.05-0.15 per post
- **Supabase**: Free tier available
