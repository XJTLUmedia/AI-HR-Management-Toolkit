# AI HR Management Toolkit

AI-powered resume parser & ATS toolkit with **20 MCP tools**. Parse PDFs, extract skills, detect patterns, score candidates, and manage a full hiring pipeline — all from your AI assistant.

## Placeholder content for NPM

<img width="1889" height="781" alt="image" src="https://github.com/user-attachments/assets/572b4dd8-8fd4-469c-b71d-a4f513c4b466" />
<img width="1896" height="635" alt="image" src="https://github.com/user-attachments/assets/aa0fc7c1-6373-4a48-9faf-3b15c42871f1" />
<img width="1562" height="572" alt="image" src="https://github.com/user-attachments/assets/4a0ec218-b61f-43c8-b6b8-657219e30dab" />

Live page: https://ai-hr-management-toolkit.vercel.app

[![npm version](https://img.shields.io/npm/v/resume-parser-mcp)](https://www.npmjs.com/package/resume-parser-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<a href="https://glama.ai/mcp/servers/resume-parser-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/resume-parser-mcp/badge" alt="Resume Parser MCP server" />
</a>

## 🚀 MCP Server Support

This tool functions as an **MCP (Model Context Protocol) Server**. If you use Claude Desktop, Cursor, Windsurf, VS Code Copilot, or any MCP-enabled client, the AI can directly parse resumes, extract skills, match candidates, and manage your hiring pipeline without you doing anything manually.

- **Native Integration**: Claude, Cursor, and other MCP clients can "see" all 20 tools
- **Direct Pipeline**: Ask the AI: *"Parse this resume and compare it against our Senior Engineer job description"*
- **Automated Workflow**: Bridge the gap between LLM reasoning and structured resume data
- **Pure-Data Tools**: 19 of 20 tools are 100% algorithmic — no LLM calls, no API keys needed

---

## The Problem

You have 50 resumes to screen. Your AI assistant can reason about candidates, but it can't:

- **Read PDFs/DOCX** — The AI can't open binary files
- **Extract structured data** — Copy-pasting loses formatting, metrics, and context
- **Compare at scale** — No consistent scoring across candidates
- **Track pipeline** — Spreadsheets break down after 10 candidates

**Generating analysis takes seconds. Getting data into the AI takes forever.**

## The Solution

Give your AI assistant direct access to resume parsing, skill extraction, and pipeline management via MCP tools. The AI calls the tools, interprets the results, and delivers analysis — all in one conversation.

---

## Installation & Usage

### Option 1: NPX (Recommended for Claude Desktop / MCP Clients)

No clone needed. Just configure your MCP client:

```json
{
  "mcpServers": {
    "resume-parser": {
      "command": "npx",
      "args": ["-y", "resume-parser-mcp"]
    }
  }
}
```

**Claude Desktop:** Edit `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac).

**Cursor:** Add to `.cursor/mcp.json` in your project or global config.

**VS Code Copilot:** Add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "resume-parser": {
      "command": "npx",
      "args": ["-y", "resume-parser-mcp"]
    }
  }
}
```

### Option 2: Remote Server (HTTP / Streamable MCP)

Deploy the Next.js app and connect any MCP client to the HTTP endpoint:

```
https://your-domain.com/api/mcp
```

Or locally:

```
http://localhost:3000/api/mcp
```

Test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp
```

### Option 3: Local Development (Web UI + MCP)

```bash
git clone <repo-url>
cd Resume-parser
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the web UI. The MCP endpoint is live at `/api/mcp` simultaneously.

**No `.env` file needed.** Configure API keys directly in the web UI or pass them per MCP tool call.

### Option 4: Global Install

```bash
npm install -g resume-parser-mcp
```

Then configure your MCP client to use the command directly:

```json
{
  "mcpServers": {
    "resume-parser": {
      "command": "resume-parser-mcp"
    }
  }
}
```

---

## 🔧 20 MCP Tools

All tools return structured JSON with `next_steps` hints so the AI knows what to do next.

### Resume Parsing & Analysis

| Tool | Description | AI? |
|------|-------------|-----|
| `parse_resume` | Parse PDF/DOCX/TXT/MD/URL → raw text + keywords, metrics, contacts, sections | No |
| `inspect_pipeline` | Run 5-stage pipeline → confidence scores, entity classification, data quality | No |
| `extract_keywords` | TF-IDF keyword & bigram extraction with NER entity classification | No |
| `detect_patterns` | Date ranges, metrics (%, $, team sizes), section boundaries, career trajectory | No |
| `classify_entities` | NER with 12 entity types (PERSON, ORG, SKILL, JOB_TITLE, etc.) + disambiguation | No |
| `extract_skills_structured` | Skills → 13 categories with proficiency estimation (NER + TF-IDF) | No |
| `extract_experience_structured` | Work history → structured timeline with dates, metrics, technologies | No |
| `analyze_resume_comprehensive` | Master tool — full pipeline + entities + keywords + skills + experience in one call | No |

### Matching & Assessment

| Tool | Description | AI? |
|------|-------------|-----|
| `compute_similarity` | Cosine, Jaccard, TF-IDF overlap, skill match scores vs job description | No |
| `assess_candidate` | Score against 8 criteria axes, weighted overall, pass/review/reject decision | Optional |
| `manage_candidates` | Rank, filter, compare, recommend stage changes across candidates | No |

### Batch & Export

| Tool | Description | AI? |
|------|-------------|-----|
| `batch_parse_resumes` | Multi-file parse + full pipeline analysis | No |
| `export_results` | Export structured data to JSON/CSV | No |
| `send_email` | Email results via SMTP (config passed per-call) | No |

### ATS (Applicant Tracking System)

| Tool | Description | AI? |
|------|-------------|-----|
| `ats_manage_jobs` | Full CRUD + search for job postings | No |
| `ats_manage_candidates` | CRUD + pipeline stage operations (move, bulk move, filter) | No |
| `ats_schedule_interview` | Create/update/delete interviews with conflict detection | No |
| `ats_manage_offers` | Offer lifecycle: draft → pending → approved → sent → accepted/declined | No |
| `ats_manage_notes` | Add, update, search, delete candidate notes | No |
| `ats_interview_feedback` | Submit, analyze, and summarize interview feedback | No |
| `ats_pipeline_analytics` | Stage distribution, conversion rates, bottleneck detection | No |
| `ats_dashboard_stats` | Comprehensive hiring health report from full ATS state | No |
| `ats_search` | Global search across all ATS entities | No |
| `ats_generate_demo_data` | Generate realistic sample data for testing | No |

> **19 of 20 tools are 100% algorithmic** — no LLM calls, no API keys required. Only `assess_candidate` optionally uses AI when `provider`/`apiKey` are supplied; it falls back to algorithmic scoring otherwise.

---

## How It Works: Multi-Turn Flow

```
User: "Parse this resume and tell me if they're a good fit for our Senior Engineer role"

AI → parse_resume(file)              → gets raw text + basic analysis
AI reads results, decides to dig deeper
AI → inspect_pipeline(rawText)       → gets entity classification, confidence scores
AI → extract_skills_structured(text) → gets categorized skills with proficiency
AI → detect_patterns(text)           → gets career trajectory and metrics
AI → compute_similarity(text, JD)    → gets match scores vs job description
AI synthesizes all data → delivers recommendation with evidence
```

**Design principle:** Tools return raw algorithmic data + `next_steps` hints. The MCP client LLM orchestrates multi-turn analysis — calling tools, interpreting results, and deciding what to analyze next.

---

## Analysis Pipeline

Every resume goes through a 5-stage algorithmic pipeline:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────┐    ┌───────────────┐
│  Ingestion   │───▶│ Sanitization │───▶│ Tokenization │───▶│ Classification │───▶│ Serialization │
│ (file parse) │    │ (noise trim) │    │  (TF-IDF)    │    │ (NER + disamb) │    │ (structured)  │
└─────────────┘    └──────────────┘    └──────────────┘    └────────────────┘    └───────────────┘
```

1. **Ingestion** — Detects format, converts binary → text (PDF via pdf-parse, DOCX via mammoth, URL via cheerio)
2. **Sanitization** — Removes non-ASCII artifacts, normalizes whitespace, strips noise
3. **Tokenization** — TF-IDF keyword extraction with unigrams, bigrams, and trigrams
4. **Classification** — NER with domain-aware disambiguation (e.g. "Java" as language vs. location, "Go" as language vs. verb)
5. **Serialization** — Maps entities to structured output with confidence scores and data quality metrics

---

## Web UI

The app also includes a full web interface with two tabs:

| Tab | Description |
|-----|-------------|
| **Single Parse** | Upload one file (PDF/DOCX/TXT/MD) or paste a URL. Returns structured data, pipeline visualization, and analysis |
| **Batch Parse** | Upload up to 20 files. Results can be exported to JSON/CSV/PDF or emailed |

Switch AI providers and models from the selector at the top. Supports OpenAI, Anthropic, Google, DeepSeek, GLM, Qwen, OpenRouter, and OpenCode Zen.

---

## API Endpoints

All endpoints accept multipart form data with optional headers:

| Header | Description |
|--------|-------------|
| `x-api-key` | Your AI provider API key |
| `x-ai-provider` | Provider name (`openai`, `anthropic`, `google`, `deepseek`, `glm`, `qwen`, `openrouter`, `opencodezen`) |
| `x-ai-model` | Specific model ID |

```bash
# Parse a single resume
curl -X POST http://localhost:3000/api/parse \
  -H "x-api-key: sk-..." \
  -F "file=@resume.pdf"

# Batch parse
curl -X POST http://localhost:3000/api/batch-parse \
  -H "x-api-key: sk-..." \
  -F "files=@resume1.pdf" \
  -F "files=@resume2.docx"

# MCP endpoint (Streamable HTTP)
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## Supported Formats

| Format | Extensions | Parser |
|--------|-----------|--------|
| PDF | `.pdf` | pdf-parse v2 |
| DOCX | `.docx` | mammoth |
| Plain text | `.txt` | direct read |
| Markdown | `.md`, `.markdown` | regex-based |
| URL / HTML | URL string | cheerio |

Max file size: **10 MB**

---

## Structured Output

The parser returns data matching the `ResumeSchema`:

```
contact        — name, email, phone, location, LinkedIn, GitHub, website, portfolio
summary        — professional summary
skills[]       — name, category, proficiency level, usage context
experience[]   — company, title, dates, highlights, achievements (metrics & impact), technologies
education[]    — institution, degree, field, dates, GPA
certifications[] — name, issuer, date, credential URL
projects[]     — name, description, URL, technologies, highlights
languages[]    — spoken languages
```

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (Web UI + MCP endpoint)
npm run dev

# Build the standalone MCP CLI
npm run build:mcp

# Build the Next.js app
npm run build

# Lint
npm run lint
```

### Testing the MCP Server

```bash
# Test remote endpoint with MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:3000/api/mcp

# Test stdio transport
npx @modelcontextprotocol/inspector node dist/mcp-stdio.js
```

---

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **AI SDK**: Vercel AI SDK v6 with multi-provider support
- **MCP**: `@modelcontextprotocol/sdk` v1.29 (Streamable HTTP + stdio)
- **Parsing**: pdf-parse v2, mammoth, cheerio
- **Analysis**: TF-IDF, NER, cosine similarity, Jaccard index
- **Export**: ExcelJS, jsPDF
- **Email**: Nodemailer
- **Styling**: Tailwind CSS v4, Framer Motion

## License

[MIT](LICENSE)

## Project Structure

```text
src/
├── app/
│   ├── page.tsx              # Main UI (Single/Batch tabs, provider selector, chat)
│   ├── layout.tsx            # Root layout
│   └── api/
│       ├── parse/route.ts    # Single resume parse endpoint
│       ├── batch-parse/route.ts
│       ├── chat/route.ts     # Conversational AI with tools
│       ├── mcp/route.ts      # MCP server endpoint
│       ├── models/route.ts   # Provider model listing
│       ├── export/route.ts   # JSON/CSV/PDF export
│       └── email/route.ts    # SMTP email
├── components/               # React components
├── lib/
│   ├── ai-model.ts           # Multi-provider model config (no env fallback)
│   ├── mcp-server.ts         # MCP server v3.0 with 8 pure-data tools
│   ├── schemas/resume.ts     # Zod v4 schemas
│   ├── analysis/
│   │   ├── pipeline.ts       # 5-stage pipeline orchestrator
│   │   ├── sanitizer.ts      # Text cleaning
│   │   ├── keyword-extractor.ts  # TF-IDF
│   │   ├── classifier.ts     # NER with disambiguation
│   │   ├── pattern-matcher.ts    # Regex extraction (metrics, dates, contacts)
│   │   └── scoring.ts        # Cosine similarity, Jaccard, skill matching
│   ├── parser/
│   │   ├── pdf.ts, docx.ts, text.ts, markdown.ts, url.ts
│   │   └── index.ts
│   └── tools/
│       ├── parse-resume.ts, inspect-pipeline.ts   # Shared pure-data tools
│       ├── extract-skills.ts, extract-experience.ts  # Frontend AI-enhanced tools
│       ├── match-job.ts, summarize.ts, batch-parse.ts
│       ├── export-results.ts, send-email.ts
│       └── mcp/              # MCP-specific pure-data tool variants
│           ├── extract-keywords.ts   # TF-IDF keywords (no AI)
│           ├── detect-patterns.ts    # Date/metric pattern detection (no AI)
│           ├── compute-similarity.ts # Similarity scoring (no AI)
│           └── batch-parse.ts        # Batch parse without AI
```

## Tech Stack

- **Framework**: Next.js 16 (Turbopack, App Router)
- **AI SDK**: Vercel AI SDK v6 (`ai@6.x`)
- **Schema validation**: Zod v4
- **PDF parsing**: pdf-parse v2
- **DOCX parsing**: mammoth
- **HTML parsing**: cheerio
- **Email**: nodemailer
- **Export**: exceljs (CSV/XLSX), jspdf + jspdf-autotable (PDF)
- **MCP**: @modelcontextprotocol/sdk
- **Styling**: Tailwind CSS v4

## Scripts

```bash
npm run dev     # Start development server (Turbopack)
npm run build   # Production build
npm run start   # Start production server
npm run lint    # ESLint
```

## License

MIT
