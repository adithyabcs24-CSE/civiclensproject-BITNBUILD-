# CivicLens AI

Agentic platform that converts municipal documents into localized citizen impact reports.

## Complete Architecture & Pipeline (Parts 1–4)

### Structure
```
civicadi/
├── backend/
│   ├── data/              # SQLite DB (civiclens.db)
│   ├── seeds/             # Fictional seed documents
│   │   ├── maplewood_zoning_proposal.txt
│   │   └── driftwood_hollow_notice.txt
│   ├── src/
│   │   ├── db.js          # SQLite schema + connection
│   │   ├── sectioner.js   # Text → sections logic
│   │   ├── seed.js        # Seed runner (real ingest pipeline)
│   │   ├── verify.js      # Part 1 verification suite
│   │   ├── verify_part2.js# Part 2 verification suite
│   │   ├── verify_part3.js# Part 3 verification suite
│   │   ├── verify_final.js# Part 4 final acceptance suite
│   │   ├── index.js       # Express entry point (port 3001)
│   │   ├── pipeline/
│   │   │   ├── llmClient.js        # Gemini API / offline grounded simulation engine
│   │   │   ├── orchestrator.js     # Sequential 5-stage pipeline orchestrator
│   │   │   └── agents/
│   │   │       ├── documentAgent.js # Stage 1: Document classification & structure
│   │   │       ├── policyAgent.js   # Stage 2: Policy extraction & section grounding
│   │   │       ├── impactAgent.js   # Stage 3: Localized impact assessment
│   │   │       ├── evidenceAgent.js # Stage 4: Anti-hallucination gate & evidence anchors
│   │   │       └── reportAgent.js   # Stage 5: Citizen impact report synthesis
│   │   └── routes/
│   │       ├── documents.js        # /api/documents routes
│   │       └── analyses.js         # /api/analyses routes (including /report and /evidence/:sectionId)
│   ├── test_real.pdf      # Sample PDF for upload test
│   └── package.json
└── frontend/
    ├── index.html         # Vite root template
    ├── vite.config.js     # Dev server + backend proxy
    ├── src/
    │   ├── index.jsx      # React root
    │   ├── index.css      # Civic design system & badges
    │   ├── App.jsx        # Main SPA coordinator & view routing
    │   └── components/
    │       ├── Navbar.jsx          # Header with branding & navigation
    │       ├── Dashboard.jsx       # Active issues, recent analyses, upcoming dates
    │       ├── NewAnalysisModal.jsx# PDF upload / document picker & locality input
    │       ├── PipelineView.jsx    # Live 5-stage animated progress tracker
    │       ├── CitizenReport.jsx   # Structured report with confidence badges & disclaimer
    │       └── EvidenceModal.jsx   # Source passage citation inspector
    └── package.json
```

### Quick Start (Single Command)

The entire application (React frontend UI + Express backend API) runs unified on a single port:

```bash
npm start
```
Then open **`http://localhost:3001`** in your browser!

```bash
# Other helpful root commands:
npm test            # Runs all 4 test suites (Parts 1, 2, 3, and 4)
npm run seed        # Re-seeds example municipal documents
npm run build       # Rebuilds the frontend bundle
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/documents | Upload PDF or .txt, returns document_id + sections |
| GET | /api/documents | List all documents |
| GET | /api/documents/:id | Get document + full sections |
| POST | /api/analyses | Start 5-stage analysis `{ document_id, locality }` |
| GET | /api/analyses/:id | Get analysis status and stage JSON blobs |
| GET | /api/analyses/:id/report | Get final report_json (200 complete, 202 in-progress, 500 failed) |
| GET | /api/analyses/:id/evidence/:sectionId | Retrieve source passage text and heading for an evidence anchor |
| GET | /api/analyses | List all analyses |

### Full 5-Stage Agent Pipeline

Lifecycle progression: `pending` → `document` → `policy` → `impact` → `evidence` → `report` → `complete`

1. **Stage 1 — Document Agent**: Analyzes document metadata, classifies type, identifies dates and entities, references real sections.
2. **Stage 2 — Policy Agent**: Extracts concrete municipal policies, strictly citing real `source_section_id`s.
3. **Stage 3 — Impact Agent**: Projects localized impacts in hedged language across standard categories (`traffic`, `environment`, `cost`, `noise`, `safety`, `housing`, `other`) for the specified `locality`.
4. **Stage 4 — Evidence Agent**: Anti-hallucination gate. Audits claims against section text; retains directly grounded items, marks inferences with `inferred: true` and downgrades confidence to `low`, and drops ungrounded statements entirely.
5. **Stage 5 — Citizen Report Agent**: Synthesizes the final `report_json` combining plain-English narrative sections (`what_is_happening`, `why_it_matters`, `who_may_be_affected`, `suggested_questions`, `citizen_actions`) while passing through verified policies and impacts intact with their evidence anchors. Accurately reports low information for thin documents.

### Database schema

```sql
documents(id, title, doc_type, original_filename, raw_text, uploaded_at)
document_sections(id, document_id, heading, text, page, order_index)
analyses(id, document_id, locality, status, document_json, policy_json,
         impact_json, evidence_json, report_json, created_at)
```
