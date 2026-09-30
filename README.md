# Spin & Speak

Spin & Speak is a mobile-first impromptu speaking trainer for children. It is built as a Next.js PWA with a separate Node.js API, local-first history in IndexedDB, and OpenAI-backed topic generation and speech analysis.

## What is included

- Local child profiles, with no account or password UX.
- Shared topic history across all profiles, including skipped topics.
- AI-generated topics with exact, lexical, and semantic duplicate protection.
- One skip per session, with the second topic locked.
- 30-second Think phase with 10-second and 5-second cues, followed by 3, 2, 1, Start.
- 60-second Speak phase with a dominant timer, live mic meter, 50-second bell, 55-second bell, and automatic stop at 60 seconds.
- Temporary local recovery of a completed recording if upload or scoring fails.
- Five independent scoring categories: Structure, Content, Clarity, Fluency, Delivery.
- Fixed weighted sub-rubrics and deterministic score calculation to the nearest 0.5.
- Level progression, downgrade protection, repeated issue tracking, improvement tracking, and progress history.
- Nine locked product screens, including results, last-five score chart, and past speech detail.
- No permanent audio or transcript storage in V1.
- Installable PWA with service worker and app icons.

## Repository structure

```text
spin-and-speak/
  apps/
    web/              Next.js PWA
    api/              Node.js + TypeScript API
  packages/
    domain/           Shared domain models
    scoring/          Deterministic scoring and progression
    api-types/        Shared API contracts and validation
    storage/          Dexie / IndexedDB data layer
  docs/
    ARCHITECTURE.md
    CALIBRATION.md
    DEPLOYMENT.md
```

## Prerequisites

- Node.js 22 or later
- npm 10 or later

## Run locally with mock AI

This lets you test the complete UX without an OpenAI key.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set this in `apps/api/.env`:

```env
MOCK_AI=true
ALLOWED_ORIGIN=http://localhost:3000
```

Keep this in `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Then open two terminals.

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

Open `http://localhost:3000` on a browser that supports `MediaRecorder` and microphone access.

## Run locally with real OpenAI scoring

Create an OpenAI API key, then change `apps/api/.env`:

```env
MOCK_AI=false
OPENAI_API_KEY=your_key_here
INSTALL_TOKEN_SECRET=use_a_long_random_secret_here
TRANSCRIPTION_MODEL=gpt-transcribe
AUDIO_MODEL=gpt-audio-1.5
SCORING_MODEL=gpt-6-luna
TOPIC_MODEL=gpt-6-luna
EMBEDDING_MODEL=text-embedding-3-small
```

Restart the API after changing environment variables.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
```

The scoring tests cover rounding, weighted categories, filler bands, level-up qualification, downgrade behavior, and repeated/persistent issue logic.

## Privacy boundary

The browser stores profiles, scores, feedback, level state, topic history, and progress in IndexedDB. A completed recording is stored only temporarily if it is waiting to be scored or retried. The backend receives the recording plus the topic, level, rubric version, and recent structured issue tags. The child's name is never sent to the backend.

The API converts audio in a temporary directory, analyses it, and removes the temporary file. The transcript exists only during the scoring request and is not included in the API response or saved in the local history.

## Deployment

See `docs/DEPLOYMENT.md` for the step-by-step Railway and OpenAI setup.
