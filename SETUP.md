# FlowPost Setup Guide

End-to-end setup for taking FlowPost from a fresh GitHub clone to a live, scheduled, OAuth-connected Instagram publishing app on Vercel + Supabase + Upstash + Meta.

> This guide is the source of truth for the production setup. The README is intentionally short; deep setup details live here.

---

## Architecture at a glance

```
┌──────────────────┐    OAuth    ┌──────────────────┐
│  User (browser)  │ ──────────▶│  Meta Graph API  │
└────────┬─────────┘            └────────▲─────────┘
         │                               │ posts + insights
         ▼                               │
┌──────────────────┐ ┌────────────────────────────┐
│  Vercel (Next)   │─│ Supabase: Postgres + Storage│
│  - dashboard     │ └────────────────────────────┘
│  - API routes    │ ┌────────────────────────────┐
│  - Vercel Cron   │─│ Upstash: QStash + Redis    │
└────────┬─────────┘ └────────────────────────────┘
         │ run-workflow
         ▼
┌──────────────────┐
│  LangGraph API   │
│  (agents)        │
└──────────────────┘
```

The five external services you need to provision:

1. **Vercel** – hosts the Next.js app (frontend + API routes)
2. **Supabase** – Postgres database + image Storage bucket
3. **Clerk** – auth (email + OAuth providers handled here)
4. **Upstash** – QStash (queue + cron) and Redis (per-account leases & rate limit)
5. **Meta for Developers** – Instagram Graph API app (OAuth + publishing + insights)

Plus at least one LLM and image provider:

- **OpenAI** or **Google Gemini** for LLM
- **OpenAI DALL-E** or **Gemini image** for image generation
- **Serper** for content research (optional but recommended)

---

## Step 1 — Supabase: database + storage

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Database → Connection string**, choose the **Pooled** connection string. Copy it.
3. Get the service role key from **Project Settings → API**. Keep this secret — it bypasses RLS.
4. Create a public Storage bucket for generated images:
   - Storage → **New bucket** → name `post-media` → **Public bucket: ON** (Meta's servers fetch URLs anonymously).
5. Run all migrations in order against the database:
   ```bash
   ./scripts/run-migration.sh migrations/001_initial_schema.sql
   ./scripts/run-migration.sh migrations/002_analytics_cache.sql
   ./scripts/run-migration.sh migrations/003_approvals_learnings_engagement.sql
   ./scripts/run-migration.sh migrations/004_instagram_oauth.sql
   ./scripts/run-migration.sh migrations/005_cron_scheduling.sql
   ./scripts/run-migration.sh migrations/006_twitter_linkedin_oauth.sql
   ```

Env vars to record now:

```
DATABASE_URI=postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SUPABASE_STORAGE_BUCKET=post-media
POSTGRES_POOL_MAX=1
```

---

## Step 2 — Clerk: authentication

1. Create a Clerk app at [clerk.com](https://clerk.com).
2. In **API Keys**, copy the publishable + secret keys.
3. In **User & Authentication → Email, Phone, Username**, enable email + password (and optionally Google/GitHub social sign-in for end users — this is _Clerk_ SSO, separate from the Instagram OAuth).
4. Configure redirect paths under **Paths**:
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/dashboard`
   - After sign-up: `/dashboard`

Env vars:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

## Step 3 — Meta for Developers: Instagram Graph API app

This is the heaviest setup step but unavoidable: Instagram does not allow programmatic posting from personal accounts, only from Business/Creator accounts via the Meta Graph API.

### 3a. App registration

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**.
2. Choose **Business** as the use case.
3. From the dashboard, click **Add Product** → **Instagram Graph API**.
4. Under **App Settings → Basic**, copy the **App ID** and **App Secret**.

### 3b. OAuth redirect URI

1. **Facebook Login for Business → Settings**.
2. Add to **Valid OAuth Redirect URIs**: `https://<your-vercel-domain>/api/auth/instagram/callback`
3. Save.

### 3c. Permissions / scopes

Under **App Review → Permissions and Features**, request these. Until App Review approves them, only **test users** you add to the app explicitly can complete the OAuth flow.

- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

### 3d. Add yourself as a test user (development)

1. **App Roles → Roles → Add People → Test Users**.
2. Add your Facebook account.
3. The user must have:
   - An **Instagram Business or Creator** account (switch from Personal in the IG mobile app)
   - That account **linked to a Facebook Page** they admin

### 3e. Token encryption key

Generate a random 32+ character key locally:

```bash
openssl rand -base64 32
```

Store as `TOKEN_ENCRYPTION_KEY`. Tokens are encrypted at rest in `connections.access_token_encrypted` with AES-GCM. Rotating this key will invalidate every stored token — users would need to re-OAuth.

Env vars:

```
META_APP_ID=...
META_APP_SECRET=...
TOKEN_ENCRYPTION_KEY=<output of openssl rand -base64 32>
```

---

## Step 3.5 — X (Twitter) Developer App (optional, for X publishing)

1. Go to [developer.x.com](https://developer.x.com) → **Projects & Apps** → create a new App in your project.
2. **App settings → User authentication settings**:
   - App permissions: **Read and write**
   - Type of App: **Web App, Automated App or Bot** (confidential client)
   - Callback URI: `https://<your-vercel-domain>/api/auth/twitter/callback`
   - Website URL: your domain
3. **Keys and tokens** → **OAuth 2.0 Client ID and Secret** → copy both.
4. The app's required scopes are encoded in code: `tweet.read`, `tweet.write`, `users.read`, `offline.access`.

Free tier limits: posting capped at ~1500 tweets/month per app, total. Sufficient for one or two test users; for general availability, upgrade to Basic ($100/mo).

```
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
```

---

## Step 3.6 — LinkedIn Developer App (optional, for LinkedIn publishing)

1. [linkedin.com/developers](https://www.linkedin.com/developers) → **Create app** → choose a Page for the app to be associated with.
2. **Products → Add product**:
   - **Sign In with LinkedIn using OpenID Connect** (required for OAuth — auto-approved)
   - **Share on LinkedIn** (required to post — auto-approved for personal feed)
3. **Auth → OAuth 2.0 settings → Authorized redirect URLs**: `https://<your-vercel-domain>/api/auth/linkedin/callback`
4. **Auth tab → Application credentials** → copy **Client ID** + **Client Secret**.
5. Required scopes (encoded in code): `openid`, `profile`, `w_member_social`.

LinkedIn tokens last 60 days and have no refresh — when they expire users see a Reconnect button.

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

> Posting to a **Company Page** (vs a personal feed) requires the **Marketing Developer Platform** product, which has heavier review. The current implementation only posts to the connecting user's personal feed.

---

## Step 4 — Upstash: QStash + Redis

1. Sign up at [upstash.com](https://upstash.com) (single account covers both products).
2. **QStash → Create**. Copy the token + signing keys.
3. **Redis → Create database**. Pick the region closest to your Vercel deployment. Copy the REST URL + REST token.

Env vars:

```
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...
UPSTASH_REDIS_REST_URL=https://<...>.upstash.io
UPSTASH_REDIS_REST_TOKEN=...
WORKFLOW_PUBLISH_RATE_PER_HOUR=2   # optional, default 2
CRON_SECRET=<random string>
```

After deploying (Step 7), you'll register the QStash sweep schedule with one command (Step 8).

---

## Step 5 — LLM + image provider keys

Pick at least one. The agent auto-routes based on `AI_PROVIDER`.

```
# OpenAI route
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini       # cheap default
IMAGE_MODEL=dall-e-3
IMAGE_QUALITY=standard
IMAGE_SIZE=1024x1024
AI_PROVIDER=openai

# OR Gemini route
GEMINI_API_KEY=...
LLM_MODEL=gemini-2.0-flash-exp
IMAGE_MODEL=gemini-2.5-flash-image
AI_PROVIDER=gemini

# Optional
SERPER_API_KEY=...           # content research; without it the agent falls back to mock data
```

---

## Step 6 — LangGraph runtime

The Next.js app calls a LangGraph runtime at `LANGGRAPH_API_URL` to execute the agents. You have two options:

**Option A — LangGraph Cloud (recommended for production):**

1. Sign up at [smith.langchain.com](https://smith.langchain.com).
2. Deploy the repo's LangGraph config: `langgraph deploy`.
3. Copy the deployment URL into `LANGGRAPH_API_URL`.
4. Set the same env vars on the LangGraph deployment as on Vercel — minus Clerk, Stripe, QStash signing keys, Redis. Specifically the agent needs: `DATABASE_URI`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `OPENAI_API_KEY`/`GEMINI_API_KEY`, `SERPER_API_KEY`, `ADMIN_USER_IDS`.

**Option B — Self-host:**

1. Deploy the `backend/` directory wherever LangGraph CLI can run it (Fly.io, Render, ECS, etc.).
2. Set `LANGGRAPH_API_URL` to the public URL.

---

## Step 7 — Vercel deployment

1. Connect the GitHub repo at [vercel.com](https://vercel.com).
2. **Root directory**: `frontend/`. Vercel autodetects Next.js.
3. **Environment Variables**: add everything you collected above. Full list:

   | Group                | Vars                                                                                                                                                                                                    |
   | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Database             | `DATABASE_URI`, `POSTGRES_POOL_MAX`                                                                                                                                                                     |
   | Clerk                | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` |
   | Meta OAuth (IG)      | `META_APP_ID`, `META_APP_SECRET`, `TOKEN_ENCRYPTION_KEY`                                                                                                                                                |
   | X OAuth (opt)        | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`                                                                                                                                                            |
   | LinkedIn OAuth (opt) | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`                                                                                                                                                          |
   | Supabase Storage     | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`                                                                                                                                  |
   | Upstash              | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `WORKFLOW_PUBLISH_RATE_PER_HOUR`                                         |
   | Crons                | `CRON_SECRET`                                                                                                                                                                                           |
   | App                  | `NEXT_PUBLIC_APP_URL=https://<your-domain>`, `LANGGRAPH_API_URL`                                                                                                                                        |
   | LLM/Image            | `OPENAI_API_KEY` and/or `GEMINI_API_KEY`, `LLM_MODEL`, `IMAGE_MODEL`, `AI_PROVIDER`, `SERPER_API_KEY`                                                                                                   |
   | Admin                | `ADMIN_USER_IDS`, `NEXT_PUBLIC_ADMIN_USER_IDS` (see Step 9)                                                                                                                                             |
   | Stripe (optional)    | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                                                                                                      |

4. **Deploy**. The project ships `frontend/vercel.json` which configures:
   - Build command (`pnpm build`)
   - Two daily Vercel crons: `/api/cron/sync-engagement` (06:00 UTC) and `/api/cron/refresh-tokens` (Mondays 03:00 UTC)
   - The every-5-minute sweep is _not_ in vercel.json because Vercel Hobby caps crons at daily. It's driven by a QStash schedule instead — see Step 8.

### Vercel auto-deploy (already on)

Vercel's GitHub integration is enabled by default. **Every PR gets a preview deployment, every merge to `main` triggers a production deploy.** No GitHub Actions workflow is needed for deploys; the existing CI workflow only runs lint/test/build.

---

## Step 8 — Register the QStash sweep schedule

Run this once after the Vercel app is live so QStash starts driving the every-5-minute workflow sweep:

```bash
QSTASH_TOKEN=...                            \
NEXT_PUBLIC_APP_URL=https://<your-domain>  \
CRON_SECRET=...                             \
yarn tsx scripts/qstash/setup-sweep-schedule.ts
```

The script is idempotent — re-running it updates the existing schedule if the cron expression changes. You can override the cadence:

```bash
SWEEP_CRON="*/10 * * * *" yarn tsx scripts/qstash/setup-sweep-schedule.ts
```

---

## Step 9 — Admin account

To bypass credit limits and access the `/admin` dashboard, set both env vars:

```
ADMIN_USER_IDS=user_clerkid1,user_clerkid2
NEXT_PUBLIC_ADMIN_USER_IDS=user_clerkid1,user_clerkid2
```

Get the Clerk user id from **Clerk dashboard → Users → click a user → copy ID** (looks like `user_2abc...`).

What admins get:

- **No credit deduction** on workflow runs, post approvals, or content idea generation
- **/admin dashboard** visible in the sidebar (users + global stats)
- **Plan-level limits skipped** when those become enforced

The two env vars must agree: `NEXT_PUBLIC_ADMIN_USER_IDS` controls UI visibility (the _Admin_ link in the sidebar), `ADMIN_USER_IDS` controls server-side checks. If you forget the public one, the API still treats the user as admin — they just won't see the link.

---

## Step 10 — Smoke test

1. Visit your Vercel domain → sign up via Clerk → land on `/dashboard`.
2. **Connections** → _Connect with Facebook_ → grant scopes → pick the IG account.
3. **Workflows** → _New Workflow_ → pick the IG connection, set a topic, schedule (cron `*/15 * * * *` for testing), enable _Require Approval_.
4. After ~15 min, check **Approval Inbox** → a draft should appear → approve → confirm post lands on Instagram.
5. After ~24 h, **Analytics** should start showing engagement metrics from the daily `sync-engagement` cron.

If something fails at any step, check **Vercel → Logs → Functions** filtered by the failing route name; errors include the underlying Meta or QStash payload truncated to 300 chars.

---

## Common gotchas

| Symptom                                                         | Cause                                                                     | Fix                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Hobby accounts are limited to daily cron jobs` build error     | The 5-min sweep was put in `vercel.json`                                  | Should not happen on `main`; if you re-add it, switch to a QStash schedule (Step 8).                   |
| `Instagram requires verification / login_required`              | You're using a personal IG account                                        | IG must be Business/Creator + linked to a FB Page.                                                     |
| `No Instagram Business account found` after OAuth               | The Page you admin has no IG Business account attached                    | Link them in the IG mobile app: Settings → Account → Connected accounts → Facebook.                    |
| `decrypt failed` on workflow trigger                            | `TOKEN_ENCRYPTION_KEY` was rotated                                        | All stored IG tokens are now invalid. Have users reconnect.                                            |
| Workflow stuck in `running`                                     | LangGraph crashed mid-run                                                 | After 10 min, the next sweep auto-clears the stale lock. Or click _Reset status_ on the workflow card. |
| `Graph API media container failed: image_url is not accessible` | Supabase bucket is not public                                             | Set `post-media` bucket access to **Public**.                                                          |
| QStash schedule fires but worker returns 401                    | `CRON_SECRET` mismatched between `setup-sweep-schedule.ts` env and Vercel | Set the same value in both, re-run the script.                                                         |
