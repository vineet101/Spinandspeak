# Railway deployment and API-key setup

This guide assumes the repository is in GitHub and you are deploying two Railway services from the same monorepo: `web` and `api`.

## 1. First verify the project locally

From the repository root:

```bash
npm install
npm run typecheck
npm test
npm run build
```

For a first UX check, run with `MOCK_AI=true` before enabling paid API calls.

## 2. Create the OpenAI API project and key

1. Sign in to the OpenAI API platform.
2. Open your organization/project settings.
3. Create a dedicated project for Spin & Speak if you have permission to create projects. If you use an existing project, keep the app's key scoped to that project.
4. Open that project's **API Keys** section.
5. Select **Create new secret key**.
6. Name it something clear, such as `spin-and-speak-production`.
7. Copy the secret immediately and keep it private. Do not put it in GitHub, the web service, client code, screenshots, or chat messages.
8. In the project's **Limits** area, set a monthly budget and notification alerts appropriate for your expected usage. OpenAI project budgets are monitoring thresholds, not guaranteed hard stops, so the app also has its own server-side request limits.

You will paste this key into Railway as `OPENAI_API_KEY` only for the `api` service.

## 3. Generate the installation-token secret

Run one of these locally.

macOS/Linux:

```bash
openssl rand -hex 32
```

Or with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the result. This becomes `INSTALL_TOKEN_SECRET` in the API service.

## 4. Push the code to GitHub

Create a private repository if you prefer, then from the project directory:

```bash
git init
git add .
git commit -m "Initial Spin and Speak build"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

The `.gitignore` already excludes local secret files.

## 5. Create the Railway project

1. Sign in to Railway.
2. Create a new project.
3. Connect your GitHub account/repository when prompted.
4. Create two persistent services from the same repository.
5. Name them `api` and `web`.

This is a shared JavaScript monorepo, so keep the repository root available to both services. The apps depend on shared packages under `/packages`.

## 6. Configure the API service

Open the `api` service, then **Settings**.

Use these commands:

```text
Build Command: npm run build:api
Start Command: npm run start:api
```

Leave the service root at `/` so npm workspaces and shared packages are available.

Open the API service **Variables** tab and add:

```env
NODE_ENV=production
OPENAI_API_KEY=PASTE_YOUR_OPENAI_SECRET_KEY
INSTALL_TOKEN_SECRET=PASTE_YOUR_RANDOM_64_HEX_SECRET
RUBRIC_VERSION=1.0.0
TRANSCRIPTION_MODEL=gpt-transcribe
AUDIO_MODEL=gpt-audio-1.5
SCORING_MODEL=gpt-6-luna
TOPIC_MODEL=gpt-6-luna
EMBEDDING_MODEL=text-embedding-3-small
TOPIC_SIMILARITY_THRESHOLD=0.82
MAX_AUDIO_MB=20
MAX_SPEECHES_PER_DAY=20
MAX_GLOBAL_SPEECHES_PER_DAY=200
MAX_INSTALLS_PER_HOUR=30
MAX_TOPICS_PER_HOUR=60
MOCK_AI=false
ALLOWED_ORIGIN=http://localhost:3000
```

Do not create a custom `PORT`. Railway supplies it and the API binds to it automatically.

Deploy the staged changes.

## 7. Generate the API public domain

After the API deploys:

1. Open the API service.
2. Go to **Settings** and find **Networking**.
3. Select **Generate Domain**.
4. Copy the full HTTPS domain, for example `https://your-api-service.up.railway.app`.
5. Open `https://YOUR_API_DOMAIN/health` in a browser.
6. Confirm you receive JSON containing `"ok": true` and `"mockAi": false`.

## 8. Configure the web service

Open the `web` service, then **Settings**.

Use:

```text
Build Command: npm run build:web
Start Command: npm run start:web
```

Keep the root directory at `/`.

In the web service **Variables** tab add:

```env
NEXT_PUBLIC_API_URL=https://YOUR_API_DOMAIN
```

This variable is public by design. Never put `OPENAI_API_KEY` or `INSTALL_TOKEN_SECRET` in the web service.

Deploy the web service.

## 9. Generate the web public domain

1. Open the web service.
2. Go to **Settings** -> **Networking**.
3. Select **Generate Domain**.
4. Copy the HTTPS web domain.

Now return to the API service's Variables tab and replace:

```env
ALLOWED_ORIGIN=http://localhost:3000
```

with:

```env
ALLOWED_ORIGIN=https://YOUR_WEB_DOMAIN
```

Redeploy the API service so CORS accepts only the production app.

If you later add a second frontend origin, `ALLOWED_ORIGIN` accepts comma-separated origins.

## 10. Production smoke test

Use the Railway web URL on your phone.

Check this exact path:

1. Add a player.
2. Generate a topic.
3. Skip once and confirm the second topic cannot be skipped.
4. Accept the topic and allow microphone permission.
5. Confirm the 30-second Think timer and audio cues.
6. Confirm recording starts after 3, 2, 1, Start.
7. Confirm the 50-second and 55-second bells and stop at 60 seconds.
8. Confirm the scoring screen appears.
9. Confirm a valid result shows five category scores, two strengths, two improvements, and one next focus.
10. Confirm Progress shows the latest score and a solid-bar last-five chart.
11. Open the speech from Progress and confirm the detailed metrics.
12. Refresh the app and confirm the history remains on that phone.

Then test recovery by temporarily disabling the phone's internet immediately after a recording. The completed recording should remain locally available for retry.

## 11. Add the PWA to the phone

iPhone/iPad:

1. Open the production URL in Safari.
2. Tap Share.
3. Choose **Add to Home Screen**.
4. Open Spin & Speak from the new Home Screen icon.

Android/Chrome:

1. Open the production URL in Chrome.
2. Open the browser menu.
3. Choose **Install app** or **Add to Home screen**.

## 12. Cost and abuse controls

Keep these protections enabled:

- OpenAI project budget alerts.
- `MAX_SPEECHES_PER_DAY` on the API.
- `MAX_GLOBAL_SPEECHES_PER_DAY` as an app-wide safety valve.
- `MAX_INSTALLS_PER_HOUR` to slow anonymous token farming.
- `MAX_TOPICS_PER_HOUR` on the API.
- Railway usage notifications or spending controls available on your plan.
- A separate OpenAI key for development rather than reusing the production key.

If a key is ever exposed, revoke it in OpenAI immediately, create a new one, replace the Railway variable, and redeploy the API.

## 13. Development environment later

For cleaner ongoing work, create a second Railway environment or project for development. Use a separate OpenAI API key, `NODE_ENV=development`, a development web URL in `ALLOWED_ORIGIN`, and lower request limits.
