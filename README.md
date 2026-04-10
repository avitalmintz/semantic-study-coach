# Semantic Study Coach

Semantic Study Coach is a Next.js web app for studying in your own words.

It supports:
- Email/password auth with Supabase
- Material ingestion from pasted text or PDF upload
- AI card generation (conceptual + application prompts)
- Card review/edit before publish
- Semantic grading (not verbatim matching)
- SM-2 spaced repetition scheduling
- Attempt history and history deletion

## Stack

- Next.js (App Router, TypeScript)
- Supabase (Auth, Postgres, Storage)
- OpenAI Responses API
- Vitest (unit + integration tests)

## 1) Prerequisites

- Node.js 20+
- A Supabase project
- An OpenAI API key

## 2) Install

```bash
npm install
```

## 3) Environment

Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_MATERIALS_BUCKET` (default: `materials`)
- `SUPABASE_MATERIALS_BUCKET` (default: `materials`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default set to `gpt-5.4`)

## 4) Supabase schema

Run the SQL migration in your Supabase project:

- [`supabase/migrations/20260408190000_init.sql`](supabase/migrations/20260408190000_init.sql)

Create a storage bucket named `materials` (or your configured bucket name).

## 5) Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API contracts

- `POST /api/materials/ingest`
  - Input: `{ sourceType: "text" | "pdf", text?: string, fileId?: string }`
  - Output: `{ materialId, extractedText, tokenEstimate }`
- `POST /api/decks/generate`
  - Input: `{ materialId, title, cardCountTarget }`
  - Output: `{ deckId, cards }`
- `PATCH /api/decks/:deckId/cards`
  - Input: `{ cards: GeneratedCard[] }`
  - Output: `{ cards }`
- `POST /api/sessions/start`
  - Input: `{ deckId }`
  - Output: `{ sessionId, firstCard }`
- `POST /api/sessions/:sessionId/answer`
  - Input: `{ cardId, answerText }`
  - Output: `GradeResult`

## Testing

```bash
npm run test
npm run test:coverage
```
