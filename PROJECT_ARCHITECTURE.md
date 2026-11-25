# Project Architecture

## Stack
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts.
- **Backend**: Node.js + Express (`server.ts`, `server/routes.ts`) serving both `/api/*` endpoints and Vite middleware in development / `dist/` static bundle in production.
- **Database**: SQLite (`better-sqlite3` at `data/meridian.db`) with foreign-key enforcement (`PRAGMA foreign_keys = ON`), WAL mode, relational migrations (`server/db.ts`), and deterministic seed (`server/seed.ts`).
- **AI Assessment**: Server-side `@google/genai` integration (`server/ai.ts`) using `gemini-4-hydrogen` (structured JSON rubric scoring) and `gemini-3.5-transcribe` (audio transcription). Falls back honestly to `pending_review` / `unavailable` when `GEMINI_API_KEY` is unconfigured.
- **Reporting**: Server-side PDF generation via `pdfkit` and QR verification via `qrcode` (`server/reports.ts`).

## Shared Pure Logic
`src/lib/scoring.ts` contains deterministic scoring, official IELTS 0.5 band rounding, PTE 10–90 scaling, TOEFL 0–120 scaling, CEFR mapping, objective grading, word counting, and timer calculations shared across server and browser, verified by `src/lib/scoring.test.ts`.
