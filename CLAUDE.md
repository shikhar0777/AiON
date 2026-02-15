# Aion — AI-Powered Global News Discovery Platform

## Project State (saved 2026-02-15)

This is a complete hackathon MVP with user auth, notifications, and preferences.

## Architecture

```
/Users/ashok/Desktop/hackathon/
├── apps/
│   ├── api/          # FastAPI backend (port 8000)
│   │   ├── ai/router.py        # AI provider routing (Claude, OpenAI, Perplexity)
│   │   ├── auth.py              # JWT auth: hash_password, verify_password, create_token, decode_token, get_current_user dependency
│   │   ├── config.py            # Pydantic Settings from .env (includes jwt_secret, jwt_algorithm, jwt_expire_hours)
│   │   ├── database.py          # SQLAlchemy async models (Article, Cluster, ClusterMember, User, UserPreference, Notification)
│   │   ├── redis_client.py      # Cache, circuit breaker, Redis Streams (SSE)
│   │   ├── main.py              # FastAPI app entry + ETag middleware + all routers
│   │   ├── middleware/           # ETag + Cache-Control middleware
│   │   │   └── caching.py
│   │   ├── providers/           # NewsAPI, Guardian, GDELT news providers
│   │   │   ├── base.py, newsapi.py, guardian.py, gdelt.py, router.py
│   │   ├── routes/              # feed.py, story.py, stream.py, meta.py, health.py, auth.py, preferences.py, notifications.py
│   │   └── services/            # clustering.py, trending.py, feed.py, story.py, embeddings.py
│   ├── web/          # Next.js 16 frontend (port 3000)
│   │   ├── app/page.tsx         # Main page with SSE, filters, AuthProvider wrapper, modals
│   │   ├── app/globals.css      # Pure B&W editorial design tokens
│   │   ├── components/          # Header, CategoryChips (with country selector), FeedList, FeedCard, StoryPanel, ChatSection, AuthModal, PreferencesModal, NotificationBell
│   │   ├── hooks/useSSE.ts      # Server-sent events hook (auto-resume via Last-Event-ID)
│   │   ├── hooks/useAuth.tsx    # Auth context + provider (JWT in localStorage)
│   │   ├── hooks/useNotifications.ts # Notification polling at user's interval
│   │   ├── lib/api.ts           # Backend API client (includes auth, preferences, notifications functions)
│   │   ├── types/index.ts       # TypeScript interfaces (includes User, AuthResponse, UserPreferences, NotificationItem)
│   │   └── public/aion.png      # Aion logo (cropped, no whitespace)
│   └── worker/       # Background worker
│       ├── main.py              # 4 async loops: ingest, cluster, enrich, notify
│       └── tasks/               # ingest.py, enrich.py, notify.py
├── packages/shared/             # schemas.py (includes auth/prefs/notification schemas), constants.py
├── tests/                       # 41 tests (all passing)
├── docker-compose.yml           # Postgres (port 5433), Redis
├── .env                         # API keys (real keys configured)
└── requirements.txt             # Python deps (Python 3.13 venv at .venv/)
```

## Recent Changes (2026-02-15)

### 1. User Authentication + Notification System (NEW)

Full user system with JWT auth, preferences, and notifications:

#### Backend (8 new/modified files):
- **`requirements.txt`** — Added `python-jose[cryptography]`, `bcrypt`, `python-multipart`
- **`apps/api/config.py`** — Added `jwt_secret`, `jwt_algorithm`, `jwt_expire_hours` settings
- **`apps/api/database.py`** — Added 3 models: `User` (email, display_name, password_hash), `UserPreference` (categories JSON, countries JSON, notification_interval, last_notified_at), `Notification` (user_id, article_id, cluster_id, title, body, category, country, is_read)
- **`packages/shared/schemas.py`** — Added: RegisterRequest, LoginRequest, AuthResponse, UserRead, PreferencesRead, PreferencesUpdate, NotificationRead, NotificationsResponse
- **`apps/api/auth.py`** (NEW) — Uses `bcrypt` directly (NOT passlib — passlib has Python 3.13 bugs). JWT via python-jose. `get_current_user` and `get_optional_user` FastAPI dependencies.
- **`apps/api/routes/auth.py`** (NEW) — POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`
- **`apps/api/routes/preferences.py`** (NEW) — GET/PUT `/api/preferences` (requires JWT)
- **`apps/api/routes/notifications.py`** (NEW) — GET `/api/notifications`, POST `/{id}/read`, POST `/read-all`
- **`apps/api/main.py`** — Registered auth, preferences, notifications routers
- **`apps/worker/tasks/notify.py`** (NEW) — Queries users with category preferences, debounces per user based on notification_interval, creates Notification rows for matching articles (max 5 per batch)
- **`apps/worker/main.py`** — Added 4th `notify_loop(60)` to asyncio.gather

#### Frontend (8 new/modified files):
- **`types/index.ts`** — Added User, AuthResponse, UserPreferences, NotificationItem, NotificationsResponse
- **`lib/api.ts`** — Added `getAuthHeaders()`, `fetchJSONAuth()`, `register()`, `login()`, `getMe()`, `getPreferences()`, `updatePreferences()`, `getNotifications()`, `markNotificationRead()`, `markAllNotificationsRead()`
- **`hooks/useAuth.tsx`** (NEW) — AuthContext + AuthProvider; stores JWT in localStorage as `np_token`; validates on mount via getMe()
- **`hooks/useNotifications.ts`** (NEW) — Polls `/api/notifications` at user's configured interval
- **`components/AuthModal.tsx`** (NEW) — Sign In / Register modal with two tabs, B&W editorial styling
- **`components/PreferencesModal.tsx`** (NEW) — Category grid (36 cats), region-grouped country multi-select, timer setting (5/15/30/60 min)
- **`components/NotificationBell.tsx`** (NEW) — Bell SVG with unread badge (black circle), dropdown with notification list, click opens article in StoryPanel
- **`components/Header.tsx`** — Added user menu (Sign In button when logged out, user dropdown with Preferences + Sign Out when logged in), notification bell
- **`app/page.tsx`** — Wrapped with `<AuthProvider>`, added modal states, wired useNotifications

#### Auth flow:
```
Register/Login → JWT in localStorage("np_token") → Bearer token in API requests
useAuth validates on mount → getMe() → sets user state
Logout → removes token → clears user state
```

### 2. Branding: Aion Logo (NEW)
- Replaced "AiON" masthead text with `aion.png` logo image
- Logo at `apps/web/public/aion.png` (cropped tight, no excess whitespace)
- Size: `h-[80px] md:h-[100px]` in Header masthead

### 3. Country Selector Moved to Category Bar (NEW)
- **Removed** country dropdown from Header utility bar
- **Moved** to right side of CategoryChips bar (next to Trending/Latest toggle)
- Vertical dropdown with region-grouped countries
- Header utility bar now has: Language | Bell | Auth | LIVE

### Previous Changes (2026-02-14)

#### Frontend: Pure Black & White Editorial Redesign
- **globals.css**: Pure monochrome palette, Georgia serif, sharp corners, thin rules
- **FeedCard.tsx**: Headline-first layout, grayscale→color on hover
- **StoryPanel.tsx**: Full-width hero image, serif headline, ChatSection after summary
- **ChatSection.tsx**: Default open=true, black btn-primary
- **CategoryChips.tsx**: Sharp rectangular buttons (now includes country selector on right)

#### Backend: 3 Architectural Improvements
1. **Redis Streams + SSE Resume** — Replaced Pub/Sub with Streams (XADD/XREAD) for lossless delivery
2. **Embedding-Based Clustering** — OpenAI text-embedding-3-small (256 dims) + cosine similarity
3. **HTTP Caching with ETag** — FastAPI middleware with per-endpoint Cache-Control policies

## AI Provider Roles

| Feature | Primary Provider | Fallback | File |
|---------|-----------------|----------|------|
| Cluster Summarization | **Claude (Anthropic)** | OpenAI → deterministic | ai/router.py |
| Trending Analysis | **OpenAI (GPT-4o-mini)** | Claude → deterministic | ai/router.py |
| Deep Story Explanation | **Perplexity (Sonar)** | OpenAI → Claude → deterministic | ai/router.py |
| Article Embeddings | **OpenAI (text-embedding-3-small)** | SequenceMatcher fallback | services/embeddings.py |

## API Endpoints

### Public
- GET `/api/feed`, `/api/story/{id}`, `/api/cluster/{id}`, `/api/explain`, `/api/stream`
- GET `/api/meta/countries`, `/api/meta/categories`
- POST `/api/chat`, `/api/translate`
- GET `/health`, `/health/providers`

### Auth Required (Bearer JWT)
- POST `/api/auth/register` — `{email, display_name, password}` → `{token, user}`
- POST `/api/auth/login` — `{email, password}` → `{token, user}`
- GET `/api/auth/me` → `{id, email, display_name, created_at}`
- GET `/api/preferences` → `{categories, countries, notification_interval}`
- PUT `/api/preferences` — `{categories?, countries?, notification_interval?}`
- GET `/api/notifications?unread=false&limit=20` → `{items, unread_count}`
- POST `/api/notifications/{id}/read`
- POST `/api/notifications/read-all`

## How to Run

```bash
# 1. Docker services
cd /Users/ashok/Desktop/hackathon
docker compose up -d postgres redis

# 2. Init DB (creates all tables including users, user_preferences, notifications)
source .venv/bin/activate
python -c "import asyncio; from apps.api.database import init_db; asyncio.run(init_db())"

# 3. API server (Terminal 1)
source .venv/bin/activate
uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload

# 4. Worker (Terminal 2) — runs 4 loops: ingest, cluster, enrich, notify
source .venv/bin/activate
python -m apps.worker.main

# 5. Frontend (Terminal 3)
cd apps/web
npm run dev
```

Open http://localhost:3000

## Key Config

- DB: PostgreSQL on port **5433** (not 5432, to avoid conflict with local postgres)
- Python: 3.13 venv at `.venv/`
- All API keys in `.env` (NEWSAPI_KEY, OPENAI_KEY, ANTHROPIC_KEY, PERPLEXITY_KEY)
- JWT secret in config.py (default: `aion-hackathon-secret-change-me`)
- Guardian key is placeholder — circuit breaker handles it gracefully
- Frontend at apps/web/ with node_modules already installed
- Logo: `apps/web/public/aion.png`

## Known Issues & Fixes Applied

- Root `package-lock.json` was causing Turbopack to resolve wrong workspace root → deleted
- **passlib has Python 3.13 bugs** — auth.py uses `bcrypt` directly (NOT passlib)
- **React 19 useRef requires initial value** — `useRef<T>(undefined)` not `useRef<T>()`
- **JSX in hooks must use .tsx extension** — useAuth is `.tsx` not `.ts`
- NewsAPI "politics" was silently mapped to "general" → now uses /everything keyword search
- GDELT returns full language names → column is VARCHAR(20) with [:20] truncation
- Pydantic v2: uses `model_config = ConfigDict(...)` not `class Config`
- Settings uses `"extra": "ignore"` to handle extra env vars
- FastAPI uses `pattern=` not `regex=` for Query params

## Countries (48) & Categories (36)

South Asia: NP, IN, PK, BD, LK · East Asia: CN, JP, KR, TW, HK · Southeast Asia: SG, TH, MY, ID, PH, VN
Middle East: AE, SA, IL, TR, QA · Americas: US, CA, MX, BR, AR, CO, CL
Europe: GB, DE, FR, IT, ES, NL, SE, NO, PL, CH, IE, PT, BE · Oceania: AU, NZ · Africa: ZA, NG, KE, EG, GH

Core: general, world, politics, economy, business, finance
Tech: technology, science, space, cybersecurity, startups, crypto, gaming, ai
Society: health, education, environment, crime, legal, religion
Lifestyle: sports, entertainment, lifestyle, food, travel, fashion, art, automotive
Industry: energy, real-estate, defense, agriculture, aviation
Media: media, opinion, weather

## Remaining Improvements

1. Postgres full-text search + pg_trgm (add search endpoint)
2. Provider failover licensing awareness (per-source rules)
3. Smarter circuit breaker (time windows, exponential backoff, jitter)
4. OpenTelemetry observability (traces, metrics)
5. Distributed locks for workers (prevent race conditions with multiple instances)
6. Structured AI outputs (replace prompt-based JSON parsing with schema-guaranteed responses)

## Status (verified 2026-02-15)

All services running and tested:
- Aion logo in masthead, pure B&W editorial design
- User auth: register, login, JWT validation — all endpoints tested via curl
- Preferences: categories, countries, notification interval — all working
- Notifications: worker notify_loop generates notifications, API serves them
- Country selector moved to right of category bar
- Header utility bar: Language | Bell | Auth | LIVE
- 4 worker loops: ingest, cluster, enrich, notify
- DB has 6 tables: articles, clusters, cluster_members, users, user_preferences, notifications
- Frontend builds cleanly (`next build` passes with 0 errors)
- All deps installed in `.venv/`
