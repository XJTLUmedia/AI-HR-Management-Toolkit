# AI HR Management Toolkit

> AI-powered resume parser & full Applicant Tracking System with **24 MCP tools**. Parse PDFs, extract skills, detect patterns, score candidates, and manage a complete hiring pipeline — all from your AI assistant, no manual work required.

<img width="1889" height="781" alt="image" src="https://github.com/user-attachments/assets/572b4dd8-8fd4-469c-b71d-a4f513c4b466" />
<img width="1896" height="635" alt="image" src="https://github.com/user-attachments/assets/aa0fc7c1-6373-4a48-9faf-3b15c42871f1" />
<img width="1562" height="572" alt="image" src="https://github.com/user-attachments/assets/4a0ec218-b61f-43c8-b6b8-657219e30dab" />

**Live demo:** https://ai-hr-management-toolkit.vercel.app

[![npm version](https://img.shields.io/npm/v/mcp-ai-hr-management-toolkit)](https://www.npmjs.com/package/mcp-ai-hr-management-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<a href="https://glama.ai/mcp/servers/mcp-ai-hr-management-toolkit">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/mcp-ai-hr-management-toolkit/badge" alt="mcp-ai-hr-management-toolkit server" />
</a>

---

## What Is This?

You have 50 resumes to screen. Your AI assistant can reason about candidates — but it cannot open PDFs, extract structured data, or track pipeline stages. This toolkit bridges that gap.

**Give your AI assistant 24 tools** covering the entire hiring workflow:

- Parse PDFs, DOCX, TXT, Markdown, and URLs into structured JSON
- Extract skills, experience, keywords, and entities algorithmically
- Score and rank candidates against job descriptions
- Run a full ATS: jobs, candidates, interviews, offers, notes, and analytics

**23 of 24 tools are 100% algorithmic** — no LLM calls, no API keys required. The AI calls tools, interprets the results, and delivers analysis. You just ask questions.

---

## Quick Start (MCP Clients)

No installation needed. Point your MCP client at the package:

```json
{
  "mcpServers": {
    "resume-parser": {
      "command": "npx",
      "args": ["-y", "mcp-ai-hr-management-toolkit"]
    }
  }
}
```

Example usage: 

<img width="1101" height="556" alt="image" src="https://github.com/user-attachments/assets/34a8fd29-5f51-4f8b-9f3c-df0e31f36354" />

<img width="1094" height="314" alt="image" src="https://github.com/user-attachments/assets/fb641f07-a977-413c-903c-b67f806d75b1" />

**Claude Desktop** — Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

**Cursor** — Add to `.cursor/mcp.json` in your project or global config

**VS Code Copilot** — Create `.vscode/mcp.json`:
```json
{
  "servers": {
    "resume-parser": {
      "command": "npx",
      "args": ["-y", "mcp-ai-hr-management-toolkit"]
    }
  }
}
```

**Windsurf / other MCP clients** — Same `npx` command pattern above

---

## Installation Options

### Option 1: NPX (Zero-install, recommended)
```json
{ "command": "npx", "args": ["-y", "mcp-ai-hr-management-toolkit"] }
```

### Option 2: Global install
```bash
npm install -g mcp-ai-hr-management-toolkit
```

```json
{ "command": "mcp-ai-hr-management-toolkit" }
```

### Option 3: Remote HTTP endpoint

Deploy the Next.js app and use the Streamable HTTP transport:

```
https://your-domain.com/api/mcp
```

Test locally:
```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

### Option 4: Local development (Web UI + MCP)

```bash
git clone <repo-url>
cd Resume-parser
npm install
npm run dev
```

Web UI at `http://localhost:3000`. MCP endpoint at `http://localhost:3000/api/mcp`. No `.env` needed — configure API keys in the UI or pass them per tool call.

---

## All 24 MCP Tools

All tools return structured JSON with `next_steps` hints so the AI knows what to call next.

### Resume Parsing & Ingestion

| Tool | What it does | AI? |
|------|-------------|:---:|
| `parse_resume` | Parse PDF / DOCX / TXT / MD / URL → raw text + contacts, keywords, section map | No |
| `batch_parse_resumes` | Parse up to 20 files in one call, full pipeline on each | No |
| `inspect_pipeline` | Run the 5-stage analysis pipeline → confidence scores, entity counts, data quality report | No |

### Text Analysis & NLP

| Tool | What it does | AI? |
|------|-------------|:---:|
| `extract_keywords` | TF-IDF keyword + bigram extraction with NER entity classification | No |
| `detect_patterns` | Find date ranges, dollar/percent metrics, team sizes, section boundaries, career trajectory signals | No |
| `classify_entities` | NER with 12 entity types (PERSON, ORG, SKILL, JOB_TITLE, LOCATION, DATE, …) + context disambiguation | No |
| `extract_skills_structured` | Map extracted skills into 13 categories with proficiency estimation (beginner → expert) | No |
| `extract_experience_structured` | Parse work history into structured timeline with start/end dates, achievements, and technologies | No |
| `analyze_resume_comprehensive` | Master tool — full pipeline + entities + keywords + skills + experience in one call | No |

### Candidate Matching & Scoring

| Tool | What it does | AI? |
|------|-------------|:---:|
| `compute_similarity` | Cosine, Jaccard, TF-IDF overlap, and skill-match scores between resume and job description | No |
| `assess_candidate` | Score against up to 8 weighted criteria axes → weighted total + pass / review / reject decision | Optional |
| `manage_candidates` | Rank, filter, compare, and recommend pipeline stage changes across a candidate pool | No |

### Export & Notifications

| Tool | What it does | AI? |
|------|-------------|:---:|
| `export_results` | Export structured parse results to JSON or CSV | No |
| `send_email` | Send results via SMTP (config passed per call — no server-side secrets stored) | No |

### ATS — Jobs

| Tool | What it does | AI? |
|------|-------------|:---:|
| `ats_manage_jobs` | Full CRUD for job postings: create, read, update, delete, list, search by title/department/status | No |

### ATS — Candidates & Pipeline

| Tool | What it does | AI? |
|------|-------------|:---:|
| `ats_manage_candidates` | CRUD + pipeline operations: add, update, move stage, bulk-move, filter by stage/score/tags | No |
| `ats_pipeline_analytics` | Stage distribution, conversion rates, avg time-in-stage, bottleneck detection, drop-off analysis | No |
| `ats_dashboard_stats` | One-call hiring health report: open roles, candidates by stage, interview load, offer acceptance rate | No |
| `ats_search` | Global full-text search across all ATS entities (candidates, jobs, interviews, offers, notes) | No |

### ATS — Interviews

| Tool | What it does | AI? |
|------|-------------|:---:|
| `ats_schedule_interview` | Create, update, and delete interviews with conflict detection and interviewer availability check | No |
| `ats_interview_feedback` | Submit structured feedback, compute consensus score, summarize feedback across all interviewers | No |

### ATS — Offers & Notes

| Tool | What it does | AI? |
|------|-------------|:---:|
| `ats_manage_offers` | Full offer lifecycle: draft → pending → approved → sent → accepted / declined / expired | No |
| `ats_manage_notes` | Add, update, search, and delete timestamped candidate notes | No |

### Testing & Seeding

| Tool | What it does | AI? |
|------|-------------|:---:|
| `ats_generate_demo_data` | Generate a realistic sample ATS dataset (jobs, candidates, interviews, offers) for testing | No |

> **`assess_candidate`** optionally calls an LLM when you supply `provider` + `apiKey`; it falls back to fully algorithmic scoring otherwise.

---

## Example Multi-Turn Flow

```
You: "Parse this resume and tell me if they're a good fit for our Senior Engineer role"

AI → parse_resume(file)
     → raw text, contact info, section map

AI → inspect_pipeline(rawText)
     → 5-stage confidence scores, entity classification

AI → extract_skills_structured(text)
     → 13 skill categories with proficiency levels

AI → detect_patterns(text)
     → career trajectory, metrics, date ranges

AI → compute_similarity(text, jobDescription)
     → cosine 0.74, skill match 82%, gap analysis

AI synthesizes → "Strong match. 6 of 8 required skills present.
                  Two gaps: Kubernetes and system design at scale.
                  Recommend: Technical Screen"
```

---

## Analysis Pipeline

Every resume runs through a 5-stage algorithmic pipeline:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────┐    ┌───────────────┐
│  Ingestion  │───▶│ Sanitization │───▶│ Tokenization │───▶│ Classification │───▶│ Serialization │
│ (file/URL)  │    │ (noise trim) │    │  (TF-IDF)    │    │ (NER + disamb) │    │ (structured)  │
└─────────────┘    └──────────────┘    └──────────────┘    └────────────────┘    └───────────────┘
```

1. **Ingestion** — PDF via pdf-parse v2, DOCX via mammoth, HTML/URL via cheerio, plain text/markdown natively
2. **Sanitization** — Removes non-ASCII artifacts, normalizes whitespace, strips formatting noise
3. **Tokenization** — TF-IDF with unigrams, bigrams, and trigrams; scored by document frequency
4. **Classification** — NER with domain-aware disambiguation (e.g. "Java" as language vs. Indonesian city; "Go" as language vs. verb)
5. **Serialization** — Maps entities to typed `ResumeSchema` with confidence scores and data quality metrics

---

## Supported File Formats

| Format | Extensions | Parser |
|--------|-----------|--------|
| PDF | `.pdf` | pdf-parse v2 |
| DOCX | `.docx` | mammoth |
| Plain text | `.txt` | direct read |
| Markdown | `.md`, `.markdown` | regex-based |
| URL / HTML | any URL string | cheerio |

Max file size: **10 MB**

---

## Structured Output Schema

```
contact        — name, email, phone, location, LinkedIn, GitHub, website, portfolio
summary        — professional summary text
skills[]       — name, category (13 types), proficiency, usage context
experience[]   — company, title, start/end dates, highlights, achievements (with metrics), technologies
education[]    — institution, degree, field, dates, GPA
certifications[] — name, issuer, date, credential URL
projects[]     — name, description, URL, technologies, highlights
languages[]    — spoken language and proficiency
```

---

## Web UI

The app ships with a full web interface:

| Tab | Description |
|-----|-------------|
| **Single Parse** | Upload one file or paste a URL. Returns structured data, pipeline visualization, and AI-enhanced analysis |
| **Batch Parse** | Upload up to 20 files. Export to JSON / CSV / PDF or email results |
| **Chat** | Conversational interface with tool access — ask questions about any parsed resume |
| **ATS** | Full pipeline board: jobs, candidates (Kanban), interviews, offers, and analytics dashboard |

Switch AI providers from the selector at the top. Supports OpenAI, Anthropic, Google, DeepSeek, GLM, Qwen, OpenRouter, and OpenCode Zen.

---

## REST API Endpoints

All endpoints accept `multipart/form-data` with optional headers:

| Header | Description |
|--------|-------------|
| `x-api-key` | Your AI provider API key |
| `x-ai-provider` | `openai` / `anthropic` / `google` / `deepseek` / `glm` / `qwen` / `openrouter` / `opencodezen` |
| `x-ai-model` | Specific model ID |

```bash
# Parse a single resume
curl -X POST http://localhost:3000/api/parse \
  -H "x-api-key: sk-..." \
  -F "file=@resume.pdf"

# Batch parse (up to 20 files)
curl -X POST http://localhost:3000/api/batch-parse \
  -H "x-api-key: sk-..." \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.docx"

# MCP endpoint (Streamable HTTP)
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Export parsed data
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -d '{"format":"csv","results":[...]}'
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| AI | Vercel AI SDK v6, multi-provider (OpenAI, Anthropic, Google, DeepSeek, GLM, Qwen, OpenRouter) |
| MCP | `@modelcontextprotocol/sdk` v1.29 — Streamable HTTP + stdio transports |
| Parsing | pdf-parse v2, mammoth, cheerio |
| NLP | TF-IDF, NER, cosine similarity, Jaccard index (all in-process, no external services) |
| Schema | Zod v4 |
| Export | ExcelJS (CSV/XLSX), jsPDF + jspdf-autotable |
| Email | Nodemailer |
| Styling | Tailwind CSS v4, Framer Motion |

---

## Development

```bash
npm install

# Start dev server (Web UI at :3000 + MCP at /api/mcp)
npm run dev

# Build the standalone MCP CLI (stdio transport)
npm run build:mcp

# Build the Next.js app for production
npm run build

# Test MCP with the official inspector
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
npx @modelcontextprotocol/inspector node dist/mcp-stdio.js

# Lint
npm run lint
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main UI (tabs, provider selector, chat, ATS)
│   ├── layout.tsx            # Root layout + global styles
│   └── api/
│       ├── parse/route.ts    # Single resume parse
│       ├── batch-parse/route.ts
│       ├── chat/route.ts     # Conversational AI with tool access
│       ├── mcp/route.ts      # MCP server (Streamable HTTP)
│       ├── models/route.ts   # Provider model listing
│       ├── export/route.ts   # JSON / CSV / PDF export
│       └── email/route.ts    # SMTP email
├── components/               # React UI components (parse, batch, chat, ATS)
│   └── ats/                  # ATS-specific views (Kanban, Dashboard, Scheduler…)
└── lib/
    ├── ai-model.ts           # Multi-provider model config (no env fallback)
    ├── mcp-server.ts         # MCP server — registers all 24 tools
    ├── schemas/
    │   ├── resume.ts         # Zod v4 ResumeSchema
    │   └── criteria.ts       # Assessment criteria schema
    ├── analysis/
    │   ├── pipeline.ts       # 5-stage pipeline orchestrator
    │   ├── sanitizer.ts      # Text cleaning
    │   ├── keyword-extractor.ts  # TF-IDF
    │   ├── classifier.ts     # NER with context disambiguation
    │   ├── pattern-matcher.ts    # Regex extraction (metrics, dates, contacts)
    │   └── scoring.ts        # Cosine similarity, Jaccard, skill matching
    ├── parser/
    │   ├── pdf.ts, docx.ts, text.ts, markdown.ts, url.ts
    │   └── index.ts
    ├── ats/
    │   ├── types.ts          # ATS entity types
    │   ├── store.ts          # In-memory ATS state
    │   ├── demo-data.ts      # Realistic seed data generator
    │   └── context.tsx       # React context for ATS state
    └── tools/
        ├── parse-resume.ts       # parse_resume
        ├── inspect-pipeline.ts   # inspect_pipeline
        ├── export-results.ts     # export_results
        ├── send-email.ts         # send_email
        └── mcp/                  # 20 MCP-specific tools
            ├── extract-keywords.ts
            ├── detect-patterns.ts
            ├── classify-entities.ts
            ├── compute-similarity.ts
            ├── extract-skills-structured.ts
            ├── extract-experience-structured.ts
            ├── analyze-resume-comprehensive.ts
            ├── batch-parse.ts
            ├── assess-candidate.ts
            ├── manage-candidates.ts
            ├── ats-manage-jobs.ts
            ├── ats-manage-candidates.ts
            ├── ats-schedule-interview.ts
            ├── ats-manage-offers.ts
            ├── ats-manage-notes.ts
            ├── ats-interview-feedback.ts
            ├── ats-pipeline-analytics.ts
            ├── ats-dashboard-stats.ts
            ├── ats-search.ts
            └── ats-generate-demo-data.ts
```

---

## License

[MIT](LICENSE)
