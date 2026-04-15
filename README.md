# TextSense v2

Qualitative feedback analysis — dynamic topic modelling + sentiment scoring, for any domain.

---

## Background

TextSense v2 is a ground-up rebuild of [PICTSense](https://github.com/yanchies/PICTSense), a survey analysis tool originally built to process open-ended feedback. PICTSense proved the concept well, but was tightly coupled to a single use case: it had a hardcoded `OER` column, nine predefined military-specific topic categories, and a Streamlit frontend.

TextSense generalises the same core idea — extract meaning from free-text feedback at scale — so it works for any domain: product feedback, employee surveys, customer support transcripts, academic research, and more. Nothing is hardcoded. Topics are derived from the data itself.

---

## What it does

1. **Flexible input** — upload a CSV or JSON file, or paste text directly. You pick which column holds the responses; no column names are assumed.
2. **Dynamic topic modelling** — a hybrid pipeline clusters responses using local embeddings + HDBSCAN (capped at 10 topics), then uses an LLM to assign human-readable labels and merge near-duplicate topics.
3. **Sentiment scoring** — each response is scored 1–10 by the LLM, batched for efficiency.
4. **Interactive dashboard** — topic distribution chart, sentiment-by-topic chart, per-topic cards with structured sub-sections (Summary, Key Concerns, Suggestions, Positive Feedback), and a filterable response table.
5. **Export** — CSV (all responses with topic + sentiment), HTML (self-contained visual report), or Print / Save as PDF via the browser.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS + Recharts |
| Backend | FastAPI + Uvicorn |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (local, no API cost) |
| Clustering | UMAP + HDBSCAN |
| LLM | Anthropic Claude or OpenAI (your choice, your key) |
| Export | CSV, HTML (frontend-generated), Browser Print / PDF |

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** and **npm**
- An API key for either [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com)

---

## Local setup

### 1. Clone and enter the repo

```bash
git clone <your-repo-url>
cd textsense
```

### 2. Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# PowerShell:
venv\Scripts\Activate.ps1
# If you get a permissions error, run this first:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Command Prompt:
# venv\Scripts\activate.bat

# macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

> **Note:** `sentence-transformers` will download the `all-MiniLM-L6-v2` model (~80 MB) on first run. This is a one-time download cached in your home directory.

### 3. Frontend

```bash
cd ../frontend
npm install
```

---

## Running

From the repo root:

```bash
npm start
```

This starts both the backend (port 8001) and frontend (port 5173) in a single terminal using `concurrently`. Open [http://localhost:5173](http://localhost:5173) in your browser.

> The first startup will warm up the embedding model — you'll see a log line when it's ready.

---

## First use

1. Click the **Settings** icon (top right) and enter your API key and preferred model.
2. On the home page, upload a CSV/JSON file or paste text.
3. Select the column that contains your responses.
4. Click **Run analysis** and watch the live progress stream.
5. Explore the dashboard — topic cards, charts, and the response table.
6. Export via **CSV**, **HTML**, or **Print / PDF**.

> Your API key is stored only in your browser's localStorage and is never written to disk or sent anywhere except the LLM provider.

---

## Project structure

```
textsense/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, lifespan
│   │   ├── session.py              # In-memory session store
│   │   ├── models/schemas.py       # Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── upload.py           # POST /upload
│   │   │   ├── analysis.py         # POST /analysis/start, GET /analysis/stream/{id}
│   │   │   ├── results.py          # GET /results/{id}
│   │   │   └── export.py           # POST /export/{id}/{format}
│   │   └── services/
│   │       ├── llm.py              # Provider abstraction (Anthropic / OpenAI)
│   │       ├── parser.py           # CSV / JSON / plain text parsing
│   │       ├── embedder.py         # sentence-transformers wrapper
│   │       ├── clusterer.py        # UMAP + HDBSCAN pipeline (max 10 topics)
│   │       ├── topic_labeller.py   # LLM label + merge + structured summary
│   │       ├── sentiment.py        # Batched LLM sentiment scoring
│   │       └── exporter.py         # CSV / HTML export
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── HomePage.tsx        # Upload + column selector
│       │   ├── DashboardPage.tsx   # Live progress → results dashboard
│       │   └── SettingsPage.tsx    # API key + provider config
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── ProgressPanel.tsx   # Step tracker + elapsed time
│       │   ├── upload/             # UploadZone, TextPaste, ColumnSelector
│       │   ├── dashboard/          # TopicChart, SentimentChart, TopicCard,
│       │   │                       # ResponseTable, StatsBar
│       │   └── export/             # ExportBar (CSV, HTML, Print)
│       └── lib/
│           ├── api.ts              # Typed fetch wrappers
│           ├── types.ts            # Shared TypeScript types
│           ├── settings.ts         # localStorage helpers
│           ├── htmlExport.ts       # Self-contained HTML report generator
│           └── utils.ts            # cn(), colour helpers
│
├── .env.example
├── .gitignore
└── README.md
```

---

## Analysis pipeline

```
Input (CSV / JSON / text)
  → Column selection
  → Local embeddings (all-MiniLM-L6-v2, no API cost)
  → UMAP dimensionality reduction
  → HDBSCAN clustering (auto-scaled, hard cap at 10 topics)
  → Noise reassignment to nearest cluster
  → LLM: label each cluster (sample 15 responses → label + description)
  → LLM: merge near-duplicate topics
  → LLM: structured per-topic summary (Summary / Key Concerns / Suggestions / Positive Feedback)
  → LLM: batch sentiment scoring (25 responses per call)
  → Assembled result → dashboard + export
```

Progress is streamed live to the browser via Server-Sent Events. Concurrent LLM calls are rate-limited to 3 at a time to avoid API throttling.

---

## Acknowledgements

TextSense v2 builds on [PICTSense](https://github.com/yanchies/PICTSense) — the original project that proved this concept. PICTSense was purpose-built for analysing military training feedback surveys; TextSense takes the same ideas, removes the domain-specific assumptions, and builds a generalised, modern tool on top of them.
