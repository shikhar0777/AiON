# AiON — AI-Powered Global News Discovery Platform

A real-time, multi-source news intelligence platform with AI-powered summaries, trending detection, story clustering, and deep analysis.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│  Country/Category filters │ Feed (Trending/Latest) │ Story  │
│  SSE real-time updates    │ Framer Motion animations        │
└─────────────┬───────────────────────────────┬───────────────┘
              │ REST API                      │ SSE Stream
┌─────────────▼───────────────────────────────▼───────────────┐
│                     FastAPI Backend                          │
│  Provider Router │ AI Router │ Feed Service │ SSE Endpoint   │
│  Circuit Breaker │ Cache (stale-while-revalidate)           │
└───────┬─────────┬──────────┬────────────────────────────────┘
        │         │          │
   ┌────▼──┐ ┌───▼───┐ ┌───▼────┐
   │NewsAPI│ │Guardian│ │ GDELT  │   ← News Providers (failover chain)
   └───────┘ └───────┘ └────────┘
        │         │          │
┌───────▼─────────▼──────────▼────────────────────────────────┐
│                   Background Worker                         │
│  Ingest Loop │ Clustering │ Trending Scores │ AI Enrichment │
└───────┬──────────┬──────────────────────────────────────────┘
        │          │
   ┌────▼──┐  ┌───▼─────┐
   │Postgres│  │  Redis   │   ← Storage + Cache + Pub/Sub
   └───────┘  └─────────┘
```

## Quick Start

### 1. Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for frontend)
- Python 3.11+ (for running API/worker locally, or use Docker)

### 2. Clone & Configure

```bash
cp .env.example .env
# Edit .env with your API keys (all are optional — GDELT works without any keys)
```

### 3. Start Infrastructure

```bash
# Start Postgres + Redis
docker compose up postgres redis -d
```

### 4. Start Backend API

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start API server
uvicorn apps.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start Worker

```bash
# In a new terminal
source .venv/bin/activate
python -m apps.worker.main
```

### 6. Start Frontend

```bash
cd apps/web
npm install
npm run dev
# Open http://localhost:3000
```

### All-in-One Docker (API + Worker + Postgres + Redis)

```bash
docker compose up --build
# Then start frontend separately:
cd apps/web && npm install && npm run dev
```

## API Keys

| Provider | Key | Required? | Free Tier |
|----------|-----|-----------|-----------|
| GDELT | None needed | Built-in | Unlimited |
| NewsAPI | `NEWSAPI_KEY` | Optional | 100 req/day |
| Guardian | `GUARDIAN_KEY` | Optional | 500 req/day |
| OpenAI | `OPENAI_KEY` | Optional | Pay-as-you-go |
| Anthropic | `ANTHROPIC_KEY` | Optional | Pay-as-you-go |
| Perplexity | `PERPLEXITY_KEY` | Optional | Pay-as-you-go |
| Hygen | `PHYGEN_KEY` | Optional | Pay-as-you-go |


**The platform works with zero API keys** — GDELT provides free global news data, and AI features gracefully degrade to deterministic summaries.

## How Real-Time Works

1. **Worker** polls news providers every 2 minutes (configurable via `INGEST_INTERVAL_SECONDS`)
2. New articles are deduplicated by normalized title hash and stored in Postgres
3. Articles are clustered by title similarity (SequenceMatcher, threshold 0.75)
4. Trending scores are recomputed: `score = w1*log(1+sources) + w2*recency + w3*velocity`
5. Worker publishes update events to Redis pub/sub
6. **SSE endpoint** subscribes to Redis channels and pushes events to connected browsers
7. **Frontend** receives SSE events and refreshes the feed with smooth animations

```
Browser ←SSE← API ←pub/sub← Redis ←publish← Worker
                                               ↓
                                          Postgres (articles, clusters)
```

## How Failover Works

### News Provider Failover
- **Headlines chain**: NewsAPI → Guardian → GDELT
- **Trending chain**: GDELT → Guardian → NewsAPI
- Each provider has a **circuit breaker** (Redis-backed):
  - 3 consecutive failures → circuit opens for 60s
  - After cooldown → half-open state (1 trial request)
  - Success resets the circuit

### AI Provider Failover
- **Summarization**: OpenAI → Anthropic → deterministic fallback
- **Deep Explain**: Perplexity Sonar → OpenAI → Anthropic → snippet fallback
- Structured JSON output with retry on malformed response

### Cache Strategy
- **Stale-while-revalidate**: Fresh cache (2min TTL) + stale cache (10min TTL)
- On provider failure: serve stale data + show "Last updated Xs ago"
- **Single-flight refresh**: Only one worker refreshes a given cache key at a time

## Configuration

### Polling Intervals (`.env`)
```
INGEST_INTERVAL_SECONDS=120   # How often to fetch news
ENRICH_INTERVAL_SECONDS=30    # How often to run AI enrichment
TRENDING_INTERVAL_SECONDS=60  # How often to recompute scores
```

### Cache TTLs (`packages/shared/constants.py`)
```python
CACHE_TTL_FEED = 120      # Feed results: 2 min
CACHE_TTL_STORY = 300     # Story detail: 5 min
CACHE_TTL_CLUSTER = 180   # Cluster data: 3 min
CACHE_TTL_EXPLAIN = 600   # AI explanations: 10 min
```

### Trending Weights (`packages/shared/constants.py`)
```python
TRENDING_W_SOURCES = 3.0  # Weight for unique source count
TRENDING_W_RECENCY = 2.0  # Weight for recency boost
TRENDING_W_VELOCITY = 1.5 # Weight for velocity (articles/30min)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meta/countries` | List available countries |
| GET | `/api/meta/categories` | List available categories |
| GET | `/api/feed?country=US&category=technology&mode=trending` | Get feed items |
| GET | `/api/story/{article_id}` | Get story intelligence |
| GET | `/api/cluster/{cluster_id}` | Get cluster detail |
| GET | `/api/explain?cluster_id=1` | Get AI deep explanation |
| GET | `/api/stream?country=US&category=general&mode=trending` | SSE stream |
| GET | `/health` | Health check |
| GET | `/health/providers` | Provider status + circuit breakers |

## Project Structure

```
aion/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── main.py             # App entry point + lifespan
│   │   ├── config.py           # Settings from env
│   │   ├── database.py         # SQLAlchemy models + engine
│   │   ├── redis_client.py     # Cache, pub/sub, circuit breaker
│   │   ├── providers/          # News data providers
│   │   │   ├── base.py         # Abstract provider interface
│   │   │   ├── newsapi.py      # NewsAPI implementation
│   │   │   ├── guardian.py     # Guardian API implementation
│   │   │   ├── gdelt.py        # GDELT implementation (free)
│   │   │   └── router.py       # Provider failover router
│   │   ├── ai/                 # AI layer
│   │   │   └── router.py       # AI model router + failover
│   │   ├── services/           # Business logic
│   │   │   ├── clustering.py   # Dedup + clustering
│   │   │   ├── trending.py     # Trending score computation
│   │   │   ├── feed.py         # Feed assembly
│   │   │   └── story.py        # Story intelligence
│   │   └── routes/             # API route handlers
│   │       ├── meta.py         # Countries + categories
│   │       ├── feed.py         # Feed endpoint
│   │       ├── story.py        # Story + explain endpoints
│   │       ├── stream.py       # SSE streaming
│   │       └── health.py       # Health checks
│   ├── worker/                 # Background worker
│   │   ├── main.py             # Worker entry + loops
│   │   └── tasks/
│   │       ├── ingest.py       # News ingestion task
│   │       └── enrich.py       # AI enrichment task
│   └── web/                    # Next.js frontend
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx        # Main page (split-screen)
│       │   └── globals.css     # Glassmorphism + nebula theme
│       ├── components/
│       │   ├── Header.tsx      # Live indicator + branding
│       │   ├── CountrySelector.tsx
│       │   ├── CategoryChips.tsx
│       │   ├── FeedList.tsx    # Trending/Latest feed
│       │   ├── FeedCard.tsx    # Individual article card
│       │   └── StoryPanel.tsx  # Story intelligence panel
│       ├── hooks/
│       │   └── useSSE.ts       # SSE connection hook
│       ├── lib/
│       │   ├── api.ts          # API client
│       │   └── utils.ts        # Formatters
│       └── types/
│           └── index.ts        # TypeScript types
├── packages/shared/            # Shared Python schemas
│   ├── constants.py
│   └── schemas.py
├── tests/                      # Test suite
│   ├── test_schemas.py
│   ├── test_clustering.py
│   ├── test_trending.py
│   └── test_provider_router.py
├── docker-compose.yml
├── requirements.txt
├── pyproject.toml
├── .env.example
└── README.md
```

## Running Tests

```bash
source .venv/bin/activate
python -m pytest tests/ -v
```

## Deployment Notes

### Frontend (Vercel)
```bash
cd apps/web
# Connect to Vercel, set NEXT_PUBLIC_API_URL to your backend URL
vercel deploy
```

### Backend (Railway / Fly.io / Render)
1. Deploy the Docker container from project root
2. Set environment variables from `.env.example`
3. Ensure Postgres and Redis addons are provisioned
4. The API auto-creates tables on startup

### Environment Variables for Production
```
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...
CORS_ORIGINS=https://your-frontend.vercel.app
```

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- **Backend**: FastAPI + SQLAlchemy (async) + Pydantic v2
- **Database**: PostgreSQL 16 + Redis 7
- **AI**: OpenAI / Anthropic / Perplexity (with failover)
- **Real-time**: Server-Sent Events (SSE) via Redis pub/sub
- **News Sources**: NewsAPI + Guardian + GDELT (free fallback)
