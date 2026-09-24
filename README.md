# StudyFlow AI

Turn any topic into an interactive study session. StudyFlow AI converts notes into validated flashcards and a quiz, then highlights topics that need another look.

## Run locally

Requirements: Node.js 20 or newer and a Gemini API key.

```sh
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env (keep this key on the server; never add it to Vite variables)
npm run dev
```

The Vite UI runs at `http://localhost:5173`; Express runs on port `3001`. Override `PORT` if needed. To build the frontend, run `npm run build`. The selected model defaults to `gemini-2.0-flash` and can be changed with `GEMINI_MODEL`.

## How it works

`src/App.tsx` owns the study flow and interaction state. `src/api.ts` calls `POST /api/generate`, parses the response as unknown data, and validates it with the shared frontend Zod schema in `src/types.ts`. The Express handler validates user input, calls Gemini in JSON mode, parses the model output, and validates it against its server-side schema before responding. Only validated structured data reaches the UI; the raw model response is never rendered.

The study set schema contains a title, summary, difficulty, 3–12 flashcards, and 5–12 multiple-choice questions. Each quiz question has four choices, an answer index, explanation, and topic. Server and browser validation both check bounds and field types.

Flashcards flip between prompt and answer and support previous, next, and direct selection. Quiz answers lock after selection and show explanations. Results calculate score and per-topic accuracy. Smart Retry reopens only missed questions while preserving earlier correct answers. The latest generated study set is saved in browser `localStorage`; a malformed saved value is discarded safely.

Generation requests are cancellable. Starting another request or returning home aborts the prior fetch, and request identity checks prevent an older response from replacing newer state. Errors distinguish missing configuration, invalid input, malformed model JSON, rate limits, and general service failures.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Server-only Gemini API credential |
| `GEMINI_MODEL` | No | Gemini model; defaults to `gemini-2.0-flash` |
| `PORT` | No | Express port; defaults to `3001` |

`.env` is ignored by Git. Do not expose the API key through a `VITE_` variable.

## Project structure

```text
src/       React app, API client, Zod schema, styles
server/    Express endpoint and Gemini integration
```

Session memory is browser-local and does not sync across devices. The build can run without a Gemini key; live generation requires one.

