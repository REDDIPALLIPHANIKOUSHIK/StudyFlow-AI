# StudyFlow AI

**Turn any topic into an interactive study session.** Paste study notes or enter a topic; StudyFlow AI creates a structured study set with flashcards, a quiz, explanations, and topics to revisit.

This is an interactive study tool, not a chatbot. The model's raw response is parsed and validated before any generated content reaches the interface.

For a complete beginner-friendly walkthrough of the architecture, features, data contract, API flow, state, security, setup, and verification, see the [technical project report](docs/PROJECT_REPORT.md).

## What you can do

- Generate a study set from notes or a topic with Google Gemini.
- Review one flashcard at a time, reveal its answer, mark **Got It** or **Didn't Know**, and see mastered/revisit counts.
- Take a multiple-choice quiz with immediate correct/incorrect feedback and explanations.
- Review the score, missed questions, and accuracy by topic.
- Retry only missed quiz questions using the original questions; retry never calls Gemini again.
- Continue the most recent session after a reload, including viewed/mastered/missed card progress and quiz answers.
- Use the responsive layout on phone, tablet, and desktop.

## Three novelty features

1. **Weak Topic Detection** — quiz mistakes are grouped by each question's topic, sorted by mistakes, and shown with accuracy. This uses the quiz results already in memory; there is no second AI call.
2. **Smart Retry Mode** — the retry set contains only questions answered incorrectly. The existing structured questions are reused, and the retry result reports its score separately.
3. **Latest Session Memory** — the latest study set, timestamp, viewed/mastered/missed card IDs, and quiz answers are saved in browser `localStorage`. A Continue action restores the session; Start New clears it. No database or account is used.

## Tech stack

| Area | Technology | Use |
| --- | --- | --- |
| Frontend | React 18 | Interactive screens and local component state |
| Language | TypeScript | Typed study data, requests, and UI state |
| Build and development | Vite 6 | Frontend development server and production build |
| Backend | Node.js, Express 4 | `POST /api/generate` and Gemini key isolation |
| AI | Google GenAI JavaScript SDK (`@google/genai`) | Gemini structured JSON generation |
| Default model | `gemini-3.5-flash` | Configurable through `GEMINI_MODEL` |
| Runtime validation | Zod | Validate input, AI output, and restored local session data |
| Icons and styling | lucide-react, CSS | Icons, responsive layout, focus states, and visual feedback |
| Session persistence | Browser `localStorage` | Latest session only; no database |
| HTTP | Browser `fetch` | Frontend-to-Express request |

## Requirements and implementation

| Assignment area | Implementation |
| --- | --- |
| Landing and input | Topic/notes textarea, character count, example prompts, disabled empty/too-long submit, loading and visible error states |
| AI endpoint | Express `POST /api/generate`; validates 3–12,000 character input before calling Gemini |
| Structured data | Title, summary, difficulty, 5–10 cards, and 5–10 quiz questions with four options, answer index, explanation, and topic |
| Validation | Shared Zod study schema runs on the backend response and again in the browser; checks required non-empty fields, bounds, valid enums, answer index, four options, and unique IDs |
| Safe parsing | Empty, fenced, malformed, or wrong-shape model output is rejected with a user-facing error; raw model text is never rendered |
| Flashcards | Flip to reveal, previous/next/direct navigation, Got It/Didn't Know ratings, and progress counts |
| Quiz and results | One question at a time, locked answer after selection, immediate correctness, explanation, score and percentage |
| Weak topics and retry | Mistakes grouped by topic; retry includes only missed questions and uses no new AI call |
| Request resilience | 90-second browser timeout, AbortController cancellation, request ID check against stale responses, friendly network/backend errors |
| Session memory | Safe localStorage parsing/removal on corrupted data; restores the last set, ratings, and quiz answers |
| API-key security | Key read only by Express from server `.env`; `.env` is Git-ignored; never use a `VITE_` key |
| Responsive/accessibility | Responsive CSS, semantic buttons and labels, accessible control names, status announcements, and visible keyboard focus |

## How the data flow works

1. The student enters notes in the React form. The frontend prevents blank, whitespace-only, too-short, and over-limit submissions without truncating the text.
2. `src/api.ts` sends JSON to `POST /api/generate`. The browser aborts after 90 seconds and maps network/proxy failures to a helpful message.
3. `server/index.ts` validates the request with Zod, reads the Gemini key from the server environment, and asks Gemini for JSON only.
4. The server handles empty output, strips optional JSON code fences, parses the response as untrusted data, and validates it with `studySetSchema` before returning it.
5. The frontend validates the response again. Only validated `StudySet` data enters React state and renders as interactive flashcards and quiz questions.
6. Quiz answers are matched to the structured `correctAnswer` index. Results and topic accuracy are computed from these values, never from visible text.

### Study set schema

```ts
type StudySet = {
  title: string
  summary: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  cards: Array<{
    id: string
    question: string
    answer: string
    topic: string
    difficulty: 'easy' | 'medium' | 'hard'
  }> // 5–10
  quiz: Array<{
    id: string
    question: string
    options: [string, string, string, string]
    correctAnswer: number // 0–3
    explanation: string
    topic: string
  }> // 5–10
}
```

## Run locally (PowerShell)

Requirements: Node.js 20+ and a Gemini API key.

```powershell
git clone https://github.com/REDDIPALLIPHANIKOUSHIK/StudyFlow-AI.git
Set-Location StudyFlow-AI
npm install
Copy-Item .env.example .env
notepad .env
```

Set the values in `.env`, save, then start both the API and frontend:

```env
GEMINI_API_KEY=your_key_from_google_ai_studio
GEMINI_MODEL=gemini-3.5-flash
PORT=3001
```

```powershell
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). Keep the terminal open: `npm run dev` runs Vite and the Express API together. The API listens on port `3001` by default. If generation fails, check both process logs; a missing key produces a specific configuration message.

Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey). Do not paste it into source code, browser variables, screenshots, or GitHub.

## Deploy on Render

This repository includes `render.yaml`, which configures one Node web service to build the Vite frontend, run the Express API, serve the frontend, and check `/api/health`.

1. Sign in to [Render](https://render.com/) and choose **New + → Blueprint**.
2. Connect `REDDIPALLIPHANIKOUSHIK/StudyFlow-AI` and apply the `render.yaml` blueprint.
3. When Render requests `GEMINI_API_KEY`, enter the key from Google AI Studio as a secret environment variable. Do not commit the key or put it in a `VITE_` variable. `GEMINI_MODEL` is set by the blueprint; you can change it in the Render environment settings.
4. Wait for the deploy to finish, then open the service URL. Check that `/api/health` returns `{"ok":true}` and try generating a study set.

Render deploys linked GitHub repositories and keeps environment secrets in service settings. On Render's free plan, the service may spin down when idle, so the first request after inactivity can take longer.

## Build and manual smoke check

```powershell
npm run build
```

There is no automated test script yet. After starting the app, manually check: empty and over-limit input; generation with a valid key; missing-key and unavailable-backend errors; card flip/rating/navigation; correct and incorrect quiz answers; score and topic results; retry with only missed questions; reload/Continue/Start New; and a narrow mobile viewport.

## Environment variables

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes for generation | — | Server-only API credential |
| `GEMINI_MODEL` | No | `gemini-3.5-flash` | Gemini model ID |
| `PORT` | No | `3001` | Express server port |

The frontend build itself does not need the key. Live generation does. `.env` is ignored by Git.

## Project structure

```text
src/
  App.tsx       Screen flow, card and quiz behavior
  api.ts        Fetch, network errors, frontend response validation
  storage.ts    Safe latest-session load/save/clear helpers
  types.ts      Zod data schema and TypeScript types
  style.css     Responsive visual design and interaction states
  main.tsx      React entry point
server/
  index.ts      Express validation, Gemini call, response parsing
index.html      Vite document shell
vite.config.ts  Vite setup and /api development proxy
.env.example   Documented server configuration
```

## Security and data handling

- The Gemini key stays on the server and must not be prefixed with `VITE_`.
- `.env`, `node_modules`, and build output are ignored by Git.
- User notes are sent to the configured Gemini endpoint for generation. The app does not keep a server-side history; the latest study set and minimal progress are stored in that browser's local storage.
- Do not enter sensitive personal information in study notes.

## Current limitations

- Session data is local to one browser and is not synchronized or backed up remotely.
- Generation requires network access and a valid Gemini API key; the app intentionally has no mock-data fallback.
- Automated unit/browser tests are not included. Use the manual smoke check above and run the production build before submitting changes.

