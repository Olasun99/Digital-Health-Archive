# ScribeHealth

> **Paper-to-Health-Data Capture, Digitization & Research Platform**  
> Designed for the Nigerian health system to turn paper archives into verified, governed, searchable, and exportable digital health records.

---

## Architecture Overview

- **Frontend:** React 19 / TypeScript / Tailwind CSS / Lucide Icons / Vite
- **Backend:** FastAPI (Python 3.11+) + Express/Vite proxy middleware
- **Database:** PostgreSQL 15 (SQLAlchemy 2.0 + Alembic migrations)
- **Object Storage:** S3-compatible (MinIO for local development, Cloudflare R2 / AWS S3 for production)
- **AI Engine:** Google Gemini API (primary) with local Ollama fallback (`llama3.2-vision`)
- **Design Tokens:** Deep teal (`#0F4C5C`), amber accent (`#E36414`), emerald success (`#2A9D8F`), crimson danger (`#C1121F`), off-white canvas (`#F8F9FA`).

---

## Getting Started

### 1. Prerequisites
- Node.js (v20+) & pnpm / npm
- Python 3.11+
- Docker & Docker Compose (for PostgreSQL and MinIO)

### 2. Environment Setup
Copy the environment variables template:
```bash
cp .env.example .env
```
Ensure required secrets such as `GEMINI_API_KEY` and database credentials are configured.

### 3. Start Infrastructure
Run the local database and S3-compatible storage services:
```bash
docker-compose up -d
```

### 4. Database Migrations
Run the initial Alembic migration:
```bash
alembic upgrade head
```

### 5. Running the Application

#### Frontend Development Server:
```bash
npm run dev
# Server accessible at http://localhost:3000
```

#### Backend FastAPI Server:
```bash
uvicorn backend.main:app --reload --port 8000
# Health check available at http://localhost:8000/api/health
```

---

## Running the Tests

### Frontend Unit & Component Tests (Vitest)
```bash
npm test
```

### End-to-End Tests (Playwright)
```bash
npx playwright test
```

### Backend API Tests (Pytest)
```bash
pytest backend/tests
```

---

## Invariants & Design Principles
1. **AI Suggests. Rules Validate. Humans Approve. The Database Remembers.**
2. No auto-approval of clinical or identity data.
3. No auto-merge of patients.
4. Original paper capture images are permanent and immutable.
5. Full traceability from each verified data point back to pixel bounding boxes and extraction jobs.
6. Universal manual transcription fallback always accessible.
