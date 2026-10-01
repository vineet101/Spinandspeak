# Spin & Speak architecture

## System boundary

```text
Phone / PWA
  profiles, history, topic history, levels, charts
  temporary pending recording if scoring is interrupted
        |
        | HTTPS, anonymous install token
        v
Railway API
  request validation
  rate limiting
  temporary audio conversion
  objective audio metrics
  OpenAI calls
  deterministic score assembly
        |
        v
OpenAI
  topic generation
  semantic embeddings
  transcription
  audio interpretation
  rubric scoring
```

## Web app

The web client is a Next.js + TypeScript PWA. It owns the child-facing flow and all permanent personal data.

The session state is:

```text
Profile -> Home -> Topic -> Think -> Countdown -> Speak -> Scoring -> Results -> Progress
                                                                  -> invalid -> retry speech
                                                                  -> network error -> retry same recording
```

Past speech detail is opened from Progress.

## Local storage

Dexie provides these IndexedDB tables:

- `profiles`
- `speechSessions`
- `topicHistory`
- `appState`
- `pendingAttempts`

`pendingAttempts` is intentionally temporary. It allows a completed speech to survive a refresh or interrupted network request without forcing the child to repeat it. The row is deleted after successful scoring or explicit discard.

## Backend API

### `POST /v1/install/register`

Returns a signed anonymous installation token. There is no visible login flow.

### `POST /v1/topics/generate`

Receives the current level and shared topic history. The backend generates multiple candidates, rejects exact and lexical duplicates, then rejects candidates whose embedding is too similar to an earlier topic.

### `POST /v1/speech/analyse`

Receives multipart audio plus:

- `sessionAttemptId`
- topic
- level
- recent issue tags
- rubric version

The attempt ID makes retries idempotent for one hour on the running API instance.

## Speech analysis pipeline

1. Convert browser audio to mono 16 kHz PCM WAV using the packaged ffmpeg binary.
2. Compute objective speech signals, including active duration, long pauses, average dBFS, and pitch range.
3. Transcribe verbatim, preserving fillers and false starts.
4. Analyse the actual audio for delivery, pronunciation, dominant second speaker, background noise, and ending behavior.
5. Send transcript plus objective/audio observations to the rubric model.
6. Clamp model sub-scores to 0-10 and apply deterministic rules for fillers, long pauses, short speeches, low volume, low pitch variation, and time management.
7. Calculate weighted category scores in code.
8. Average the five category scores and round to the nearest 0.5.
9. Return structured scores and feedback. Do not return the transcript.

## Scoring weights

Each main category is 20% of the overall score.

Structure:
- Opening 20%
- Logical flow 40%
- Organisation 25%
- Ending and time management 15%

Content:
- Relevance 25%
- Depth 30%
- Examples and detail 25%
- Originality 20%

Clarity:
- Articulation and enunciation 50%
- Sentence clarity 25%
- Intelligibility 25%

Fluency:
- Filler words 25%
- Unintended pauses 25%
- Restarts and repetitions 20%
- Continuity 30%

Delivery:
- Volume and projection 30%
- Pitch and tonal variation 25%
- Pace 20%
- Pausing and emphasis 15%
- Audience engagement 10%

## Progression

Level up requires three consecutive valid speeches at the current level where:

- overall score is at least 8.0
- every category is at least 6.5

A valid non-qualifying speech resets the level-up streak.

Downgrade occurs only when the average of the latest three valid speeches at the current level is below 4.0. Highest level reached never decreases.

Invalid attempts do not affect progression.

## Security

- OpenAI key exists only in the API service.
- API requests require the signed anonymous installation token after registration.
- CORS allows only configured frontend origins.
- Audio upload size is capped.
- Audio MIME types are allow-listed.
- API usage is rate-limited per anonymous installation.
- The server does not intentionally log audio, transcript, child name, or feedback content.
- Production requires a non-default installation token secret.
