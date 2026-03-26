# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Newsletter Automation Platform for KCC. Generates three types of newsletters (IT Trends, Automotive News, KCC Company News) using Google Gemini AI, with RSS feed ingestion, Slack-based approval workflow, and Gmail email delivery. Also includes CRM features for employee/registration management.

## Development Commands

### Backend

```bash
cd backend

# Setup (first time)
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # Unix/Mac
pip install -r requirements.txt

# Database setup
psql -U postgres -d postgres -f sql/schema.sql

# Run dev server (hot reload)
uvicorn src.main:app --reload --port 8000

# API docs available at:
# http://localhost:8000/docs
# http://localhost:8000/health
```

### Frontend

```bash
cd frontend

npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build to ./dist/
```

Vite proxies `/api/*` requests to `http://localhost:8000` during development.

## Architecture

### Backend Layer Structure

```
Routes (src/api/routes/) → Services (src/services/) → Models (src/models/)
                                                     ↳ Schemas (src/schemas/)
```

- **Routes**: FastAPI handlers — thin, delegate to services
- **Services**: Business logic, external API calls (Gemini, Slack, Gmail, S3)
- **Models**: SQLAlchemy ORM entities
- **Schemas**: Pydantic DTOs for request/response validation
- **DB session**: injected via `Depends(get_db)` in route handlers
- **Config**: Pydantic Settings class at `src/config.py`, loaded from `.env`

### Newsletter Pipeline

Each newsletter type (IT / Auto / KCC) follows the same Scout → Curator → Editor pattern:

```
Scout (RSS collection)
  → Curator (Gemini AI: select relevant articles)
    → Editor (Gemini AI: write newsletter content)
      → image_service (extract/generate images)
        → template_service (Jinja2 → HTML)
          → Slack review (approval buttons)
            → email_service (Gmail SMTP send)
```

Pipeline orchestrators live in `src/pipeline/`. Agent files in `src/agents/` implement individual steps. Pipelines are triggered:
- **Scheduled**: via APScheduler cron jobs registered in `src/main.py`
- **Manual**: `POST /trigger/it`, `POST /trigger/auto`, `POST /trigger/kcc`
- **Slack mention**: keyword-based via Slack Socket Mode

Newsletter state machine: `pending → approved → sent` or `pending → rejected` (driven by Slack button callbacks).

### Frontend Architecture

```
src/
  pages/       — top-level route components
  features/    — feature-specific logic and UI (newsletter, crm, automation, etc.)
  components/  — shared/layout UI elements
  services/api/ — Axios API calls
  store/       — Zustand global state (auth persisted to localStorage)
  hooks/       — local state and business logic
  types/       — TypeScript type definitions
```

**Key rules (from AGENTS.md):**
- No direct API calls inside components — always go through service functions
- Keep component state minimal; delegate to hooks or store
- Mock services (`src/services/mock/`) exist for frontend-first development
- Never use `any` in TypeScript

### Key Files

| File | Purpose |
|------|---------|
| `backend/src/main.py` | FastAPI app creation, router registration, APScheduler setup |
| `backend/src/config.py` | All env var definitions (Pydantic Settings) |
| `backend/src/db.py` | SQLAlchemy engine & session factory |
| `backend/sql/schema.sql` | Authoritative DB schema |
| `backend/templates/newsletter.html` | Jinja2 email HTML template |
| `frontend/src/routes.tsx` | React Router config with ProtectedRoute wrapper |
| `frontend/src/services/api/apiClient.ts` | Axios instance with interceptors |
| `frontend/src/store/useAuthStore.ts` | Auth state (persisted to localStorage) |

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

```
GEMINI_API_KEY=          # Google AI Studio
DATABASE_URL=            # PostgreSQL e.g. postgresql+psycopg://postgres:postgres@localhost:5432/kcc_intern
SLACK_BOT_TOKEN=         # xoxb-...
SLACK_SIGNING_SECRET=
SLACK_APP_TOKEN=         # xapp-... (Socket Mode)
SLACK_CHANNEL_ID=        # Newsletter review channel
GMAIL_USER=
GMAIL_APP_PASSWORD=      # 16-char app password (no spaces)
EMAIL_TO=                # Default recipient
SERVER_URL=              # Base URL for newsletter preview links
AWS_ACCESS_KEY_ID=       # Optional S3
AWS_SECRET_ACCESS_KEY=   # Optional S3
AWS_S3_BUCKET=           # Optional S3
```