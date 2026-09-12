# CivicLens AI — Comprehensive Static & Runtime Audit Report (BUGFIXES.md)

This document details the static and runtime audit performed on the CivicLens AI hackathon platform (Node/Express backend, SQLite, React/Vite frontend, 5-stage agentic pipeline).

---

## 1. Route Hardening & Upload Validation

### Findings & Bugs
- **Multer File Size Limit**: The upload limit in `backend/src/routes/documents.js` was previously set to 20MB instead of the documented 10MB limit.
- **Unhandled Multer Exceptions**: Multer errors (such as `LIMIT_FILE_SIZE` or file filter rejections) were passed directly to Express's global error handler, returning unformatted HTTP 500 responses instead of clean JSON HTTP 400 client errors.
- **MIME & Extension Enforcement**: Uploads of non-PDF or non-plain-text files (such as `.exe`, `.png`, binary executables) were not systematically intercepted before parsing.

### Fixes Applied
- **`backend/src/routes/documents.js`**:
  - Configured `limits: { fileSize: 10 * 1024 * 1024 }` (10MB maximum).
  - Enforced strict MIME and extension validation: checks both `mimetype` (`application/pdf`, `text/plain`) and filename extension (`.pdf`, `.txt`), rejecting unauthorized file types with HTTP 400.
  - Wrapped `upload.single('file')` in an Express route wrapper to intercept `LIMIT_FILE_SIZE` and `INVALID_FILE_TYPE` errors and return standard `{ error: '...' }` with HTTP 400.
  - Wrapped `pdfParse` in try/catch to return HTTP 400 if PDF content is unparseable or corrupted.

---

## 2. API Request Validation & Documented Status Codes

### Findings & Bugs
- **POST `/api/analyses` Request Validation**:
  - Missing or whitespace `locality` was previously silently defaulted to `'General / Ward 4'` rather than informing the client of missing required parameters.
  - Missing or non-string `document_id` caused database queries to execute with undefined values.
- **GET `/api/analyses/:id/report` Status Codes**:
  - If a pipeline stage silently failed or if an analysis row was corrupted (e.g. status marked `'complete'` but `report_json` was null or invalid), the endpoint did not handle it cleanly and could crash with an unhandled TypeError.

### Fixes Applied
- **`backend/src/routes/analyses.js`**:
  - Added request validation on `POST /api/analyses`:
    - Validates that `document_id` is a non-empty string; returns HTTP 400 with a clear error message if missing.
    - Validates that `locality` is a non-empty string; returns HTTP 400 with a clear error message if missing or blank.
    - Validates that the referenced document actually exists in SQLite; returns HTTP 404 if not found.
  - Enforced documented status code contract on `GET /api/analyses/:id/report`:
    - **HTTP 200**: Status is `'complete'` AND `report_json` is valid JSON. Returns full report payload with execution `mode`.
    - **HTTP 202**: Analysis is still in progress (`pending`, `document`, `policy`, `impact`, `evidence`, `report`). Returns status and helpful progress message.
    - **HTTP 500**: Analysis has `status = 'failed'`, or a silent failure occurred (status is `'complete'` but `report_json` is missing/corrupted).
    - **HTTP 404**: Analysis ID does not exist.

---

## 3. Atomic Stage Transitions & Status Guards

### Findings & Bugs
- **Non-Atomic Stage Transitions**:
  - In `backend/src/pipeline/orchestrator.js`, individual stage JSON column writes and status column updates were executed as bare SQL updates without a wrapping SQLite transaction.
  - In Stage 5 (Report Agent), `report_json` was written with `status = 'report'`, and then in a separate SQL execution `status` was updated to `'complete'`. A server restart or crash between these two statements caused the analysis to remain permanently in the intermediate `'report'` status.
- **Missing Status Guard**:
  - If an analysis was marked `failed` or aborted mid-stream, subsequent asynchronous callbacks could still attempt to advance stages.

### Fixes Applied
- **`backend/src/pipeline/orchestrator.js`**:
  - Created `updateStageTransition` wrapped in `db.transaction(...)`.
  - Added a status guard: before updating, verifies the current analysis status is not `'failed'`, throwing immediately if the analysis was aborted.
  - Unified Stage 5: writes `report_json`, records execution `mode`, and transitions `status = 'complete'` atomically in a single transaction.

---

## 4. Anti-Hallucination Gate & Real Section Verification

### Findings & Bugs
- **Synthetic Section Fallback**:
  - In `backend/src/pipeline/agents/evidenceAgent.js`, if an impact's `evidence.section_id` was missing or not in the valid set, the code previously fell back to `(stage1Output.sections[0]?.id || '')`, synthesizing an evidence link rather than dropping the ungrounded claim.
- **Simulator Overwrite**:
  - In `backend/src/pipeline/llmClient.js` (`simulateMaplewood`), the mock generator unconditionally set `section_id` to `sections[0].id`, bypassing fake section checks.
- **Database Cross-Check**:
  - `evidenceAgent.js` relied on `stage1Output.sections` in memory rather than querying the authoritative `document_sections` table for that `document_id`.

### Fixes Applied
- **`backend/src/pipeline/agents/evidenceAgent.js`**:
  - Directly queries `SELECT id FROM document_sections WHERE document_id = ?` from SQLite to build the authoritative set of real section IDs.
  - Strict drop policy:
    - If a policy's `source_section_id` is not in `document_sections`, it is dropped.
    - If an impact's `evidence.section_id` is not in `document_sections`, it is dropped completely (no synthetic fallback).
    - If an impact relies on parent policies that were dropped, it is dropped.
- **`backend/src/pipeline/llmClient.js`**:
  - Preserved input evidence section IDs in simulation helpers.
- **Automated Verification**:
  - Created `backend/src/test_anti_hallucination.js` verifying that claims with fabricated section IDs (`completely_fabricated_section_id_99999`) are dropped.

---

## 5. Gemini API Resilience & Mode Tracking (`gemini` vs `offline`)

### Findings & Bugs
- **Static API Key Binding**:
  - `genAI` client was statically instantiated on file load, which caused `ReferenceError: genAI is not defined` in `answerPolicyQuestion` when refactored.
- **Unhandled API Rejections**:
  - Network timeouts, bad API keys, or rate limits (HTTP 429) could hang or crash the pipeline.
- **Missing Mode Tracking**:
  - Frontend could not distinguish whether an analysis was generated via live Gemini LLM inference or via the offline heuristic engine.

### Fixes Applied
- **`backend/src/pipeline/llmClient.js`**:
  - Created dynamic `getGenAI()` resolving both `process.env.GEMINI_API_KEY` and `process.env.GOOGLE_API_KEY`.
  - Added 25-second timeout guard (`Promise.race`) to prevent network hangs.
  - Wrapped LLM calls with complete try/catch catching bad keys, rate limits (429), timeouts, and malformed JSON, seamlessly falling back to `simulateAgent` without throwing unhandled rejections.
  - Attaches `_mode: 'gemini' | 'offline'` to output payloads.
- **Database & Response Updates**:
  - Added `mode TEXT NOT NULL DEFAULT 'offline'` column to `analyses` table in `backend/src/db.js`.
  - Added `mode` to `GET /api/analyses`, `GET /api/analyses/:id`, and `GET /api/analyses/:id/report`.
- **Frontend Badges**:
  - **`frontend/src/components/PipelineView.jsx`**: Displays execution mode badge (`✨ Gemini Live AI` or `⚡ Offline Heuristic Fallback`) in the pipeline header.
  - **`frontend/src/components/CitizenReport.jsx`**: Displays execution mode badge in the citizen report hero card.

---

## 6. SQLite Concurrency & WAL Configuration

### Findings & Bugs
- **Missing Busy Timeout**:
  - `backend/src/db.js` had `journal_mode = WAL`, but did not configure `busy_timeout`. Under concurrent analysis requests, overlapping write transactions could immediately fail with `SQLITE_BUSY: database is locked`.

### Fixes Applied
- **`backend/src/db.js`**:
  - Added `db.pragma('busy_timeout = 5000');` allowing SQLite to wait up to 5 seconds for write locks to clear.
  - Added `db.pragma('synchronous = NORMAL');` for optimal WAL performance.
  - Added safe column migration ensuring `mode` column exists on existing databases.

---

## 7. Clean Build Order & Setup Verification

### Verification
- Ran `npm run setup && npm start` from root:
  - Verified dependency installation across backend and frontend.
  - Verified production Vite build into `frontend/dist`.
  - Verified idempotent database seeding via `backend/src/seed.js`.
  - Verified server boots cleanly on `http://localhost:3001` with zero manual steps.

---

## 8. Explicitly Flagged Unverified Risks

1. **Live Gemini API Quotas**:
   - Because no live API key is hardcoded in the repository (to maintain security), live calls against Google's remote Gemini endpoints fall back to the offline engine by design unless the user provides a valid key in their local `.env`. The fallback mechanism was 100% verified.
2. **Scanned Non-Searchable PDFs**:
   - Uploading image-only scanned PDFs without embedded text layers will correctly fail with an HTTP 400 error ("Could not extract any text from the uploaded file.") because OCR processing is not integrated into `pdf-parse`. This is expected behavior but flagged for clarity.
