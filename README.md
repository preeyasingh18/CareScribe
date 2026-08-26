# CareScribe AI — AI Medical Scribe

CareScribe turns a spoken consultation into a structured clinical report.

**Flow:** Record audio → OpenAI **Whisper** transcribes → doctor reviews/edits the transcript → **OpenAI** generates a structured medical report → doctor edits → save to **MongoDB** → reopen any time → download as **PDF / DOCX / TXT**. The dashboard updates from the database automatically.

## Stack

| Layer     | Tech                                            |
| --------- | ----------------------------------------------- |
| Frontend  | React 19 + Vite + Tailwind (deploy: **Vercel**) |
| Backend   | Express + tsx (deploy: **Render**)              |
| Database  | MongoDB Atlas via **Mongoose** (deploy: Atlas)  |
| AI        | OpenAI Whisper (transcription) + GPT (report)   |
| Exports   | jsPDF + jspdf-autotable (PDF), docx (DOCX)      |

## Project structure

```
server/
  index.ts                 Express app + routes
  db.ts                    Mongoose connection (with SRV-DNS resilience)
  models/                  Mongoose models (Patient, Consultation, Transcript, Report, Prescription)
  repositories/            id-keyed data-access layer (findAll / upsert / count)
  services/                whisper.ts, openaiReport.ts, translate.ts
src/
  components/              UI (Dashboard, ConsultationWorkspace, PatientsView, ...)
  services/api.ts          Frontend API client (uses VITE_API_BASE_URL in prod)
  utils/report.ts          Report section config + printable HTML
  utils/download.ts        TXT / PDF / DOCX export
```

## Run locally

**Prerequisites:** Node.js 20+, a MongoDB Atlas cluster, an OpenAI API key.

1. `npm install`
2. Copy `.env.example` → `.env` and fill in `OPENAI_API_KEY` and `MONGODB_URI`.
3. `npm run dev:all` — starts the backend (`:5000`) and frontend (`:3000`) together.
4. Open http://localhost:3000

> The frontend proxies `/api` → `localhost:5000` in dev, so leave `VITE_API_BASE_URL` empty locally.

## Environment variables

| Variable            | Where    | Required | Notes                                                              |
| ------------------- | -------- | -------- | ------------------------------------------------------------------ |
| `MONGODB_URI`       | Backend  | ✅       | Atlas connection string (`MONGO_URI` also accepted)                |
| `OPENAI_API_KEY`    | Backend  | ✅       | Whisper + report generation (`WHISPER_API_KEY` is a fallback)      |
| `WHISPER_API_KEY`   | Backend  | optional | Fallback OpenAI key                                                |
| `PORT`              | Backend  | optional | Defaults to 5000 (Render sets this automatically)                  |
| `CORS_ORIGIN`       | Backend  | optional | Comma-separated allowed origins; empty = allow all                 |
| `VITE_API_BASE_URL` | Frontend | prod     | Backend base URL, e.g. `https://carescribe-api.onrender.com`       |

## API

| Method | Route                       | Purpose                          |
| ------ | --------------------------- | -------------------------------- |
| POST   | `/api/transcribe`           | Whisper transcription (audio)    |
| POST   | `/api/generate-report`      | OpenAI structured report         |
| POST   | `/api/translate-transcript` | Translate transcript             |
| GET    | `/api/patients`             | List patients                    |
| POST   | `/api/patients`             | Upsert patient                   |
| GET    | `/api/consultations`        | List consultations               |
| POST   | `/api/save-consultation`    | Upsert consultation              |
| GET/POST | `/api/reports`            | List / upsert reports            |
| GET/POST | `/api/transcripts`        | List / upsert transcripts        |
| GET/POST | `/api/prescriptions`      | List / upsert prescriptions      |
| GET    | `/api/stats`                | Dashboard counts                 |
| GET    | `/api/health`               | Health + DB status               |

## Deployment checklist

### MongoDB Atlas
- [ ] Create a cluster and a database user.
- [ ] Network Access → allow Render egress (or `0.0.0.0/0` for simplicity).
- [ ] Copy the `mongodb+srv://...` connection string.

### Backend → Render
- [ ] New **Web Service** from this repo (`render.yaml` is included — Render can auto-detect it).
- [ ] Build: `npm install` · Start: `npm start` · Health check: `/api/health`.
- [ ] Set env vars: `MONGODB_URI`, `OPENAI_API_KEY`, (optional `WHISPER_API_KEY`, `CORS_ORIGIN`).
- [ ] Deploy and confirm `https://<service>.onrender.com/api/health` returns `"database":"mongodb"`.

### Frontend → Vercel
- [ ] Import the repo (`vercel.json` is included; framework = Vite, output = `dist`).
- [ ] Set env var `VITE_API_BASE_URL` = your Render backend URL.
- [ ] Deploy. Optionally set `CORS_ORIGIN` on Render to the Vercel domain.

Data persists in MongoDB across refresh, login/logout, and server restarts.
