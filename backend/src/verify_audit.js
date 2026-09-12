const assert = require('assert');
const http = require('http');
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const app = require('./index');
const { runPipeline } = require('./pipeline/orchestrator');

const TEST_PORT = 3095;

function makeRequest({ port = TEST_PORT, method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (_e) {
            json = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

function buildMultipartFormData(fields, fileField, filename, mimetype, fileBuffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="${k}"${crlf}${crlf}${v}${crlf}`));
  }

  if (fileField && fileBuffer) {
    parts.push(
      Buffer.from(
        `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField}"; filename="${filename}"${crlf}Content-Type: ${mimetype}${crlf}${crlf}`
      )
    );
    parts.push(fileBuffer);
    parts.push(Buffer.from(crlf));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`));
  const bodyBuffer = Buffer.concat(parts);

  return {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length,
    },
    body: bodyBuffer,
  };
}

async function runAuditVerificationSuite() {
  console.log('================================================================');
  console.log('       CIVICLENS AI — FULL STATIC + RUNTIME AUDIT VERIFICATION');
  console.log('================================================================\n');

  let server;
  try {
    server = await new Promise((resolve) => {
      const s = app.listen(TEST_PORT, () => {
        console.log(`[INIT] Audit test server running on http://127.0.0.1:${TEST_PORT}\n`);
        resolve(s);
      });
    });
  } catch (err) {
    console.error('Failed to bind audit test server:', err.message);
    process.exit(1);
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Audit SQLite Concurrency Configuration
    // ─────────────────────────────────────────────────────────────
    console.log('--- 1. Auditing SQLite Concurrency Settings ---');
    const journalMode = db.pragma('journal_mode', { simple: true });
    assert.strictEqual(journalMode.toLowerCase(), 'wal', 'FAIL: Journal mode is not WAL!');
    console.log(`  [PASS] SQLite journal_mode is WAL: ${journalMode}`);

    const busyTimeout = db.pragma('busy_timeout', { simple: true });
    assert(busyTimeout >= 5000, 'FAIL: busy_timeout is less than 5000ms!');
    console.log(`  [PASS] SQLite busy_timeout is configured: ${busyTimeout}ms`);

    const tableColumns = db.pragma('table_info(analyses)');
    const hasMode = tableColumns.some(c => c.name === 'mode');
    assert(hasMode, 'FAIL: analyses table does not have mode column!');
    console.log('  [PASS] analyses table includes "mode" column for execution tracking.');

    // ─────────────────────────────────────────────────────────────
    // 2. Audit Document Upload Constraints (10MB limit & MIME rejection)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Auditing Document Upload Constraints ---');

    // A. Reject non-PDF / non-TXT
    const badMimeData = buildMultipartFormData(
      { title: 'Invalid File Test' },
      'file',
      'malicious_script.exe',
      'application/x-msdownload',
      Buffer.from('binary data executable')
    );
    const badMimeRes = await makeRequest({
      method: 'POST',
      path: '/api/documents',
      headers: badMimeData.headers,
      body: badMimeData.body,
    });
    assert.strictEqual(badMimeRes.status, 400, `Expected 400 for bad mime, got ${badMimeRes.status}`);
    assert(badMimeRes.body.error.includes('accepted'), 'Expected clear rejection message for invalid file type');
    console.log(`  [PASS] Non-PDF/txt rejected with HTTP 400: "${badMimeRes.body.error}"`);

    // B. Reject files over 10MB limit
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const oversizedData = buildMultipartFormData(
      { title: 'Oversized File Test' },
      'file',
      'oversized.pdf',
      'application/pdf',
      oversizedBuffer
    );
    const oversizedRes = await makeRequest({
      method: 'POST',
      path: '/api/documents',
      headers: oversizedData.headers,
      body: oversizedData.body,
    });
    assert.strictEqual(oversizedRes.status, 400, `Expected 400 for >10MB upload, got ${oversizedRes.status}`);
    assert(oversizedRes.body.error.includes('10MB'), 'Expected 10MB limit in error message');
    console.log(`  [PASS] Upload >10MB rejected with HTTP 400: "${oversizedRes.body.error}"`);

    // C. Valid TXT upload succeeds
    const validTxtBuffer = Buffer.from(
      'SECTION 1: TEST CIVIC POLICY\nThe municipality establishes a new clean water rebate.\n\nSECTION 2: SCHEDULE\nEffective date: 2025-05-01.'
    );
    const validData = buildMultipartFormData(
      { title: 'Valid Audit Ingest Test', doc_type: 'infrastructure_plan' },
      'file',
      'audit_test.txt',
      'text/plain',
      validTxtBuffer
    );
    const validRes = await makeRequest({
      method: 'POST',
      path: '/api/documents',
      headers: validData.headers,
      body: validData.body,
    });
    assert.strictEqual(validRes.status, 201, `Expected 201 for valid upload, got ${validRes.status}`);
    assert(validRes.body.document_id, 'Document ID must be returned');
    const uploadedDocId = validRes.body.document_id;
    console.log(`  [PASS] Valid document ingested successfully: ${uploadedDocId} (${validRes.body.section_count} sections)`);

    // ─────────────────────────────────────────────────────────────
    // 3. Auditing POST /api/analyses Request Validation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Auditing POST /api/analyses Request Validation ---');

    // A. Missing locality
    const noLocalityRes = await makeRequest({
      method: 'POST',
      path: '/api/analyses',
      headers: { 'Content-Type': 'application/json' },
      body: { document_id: uploadedDocId },
    });
    assert.strictEqual(noLocalityRes.status, 400, `Expected 400 for missing locality, got ${noLocalityRes.status}`);
    assert(noLocalityRes.body.error.includes('locality'), 'Error must mention locality');
    console.log(`  [PASS] Missing locality returns HTTP 400: "${noLocalityRes.body.error}"`);

    // B. Whitespace locality
    const wsLocalityRes = await makeRequest({
      method: 'POST',
      path: '/api/analyses',
      headers: { 'Content-Type': 'application/json' },
      body: { document_id: uploadedDocId, locality: '   ' },
    });
    assert.strictEqual(wsLocalityRes.status, 400, `Expected 400 for whitespace locality, got ${wsLocalityRes.status}`);
    console.log(`  [PASS] Whitespace locality returns HTTP 400: "${wsLocalityRes.body.error}"`);

    // C. Missing document_id
    const noDocRes = await makeRequest({
      method: 'POST',
      path: '/api/analyses',
      headers: { 'Content-Type': 'application/json' },
      body: { locality: 'Ward 4' },
    });
    assert.strictEqual(noDocRes.status, 400, `Expected 400 for missing document_id, got ${noDocRes.status}`);
    assert(noDocRes.body.error.includes('document_id'), 'Error must mention document_id');
    console.log(`  [PASS] Missing document_id returns HTTP 400: "${noDocRes.body.error}"`);

    // D. Non-existent document_id
    const nonExistentDocRes = await makeRequest({
      method: 'POST',
      path: '/api/analyses',
      headers: { 'Content-Type': 'application/json' },
      body: { document_id: 'fake-doc-uuid-999', locality: 'Ward 4' },
    });
    assert.strictEqual(nonExistentDocRes.status, 404, `Expected 404 for non-existent document_id, got ${nonExistentDocRes.status}`);
    console.log(`  [PASS] Non-existent document_id returns HTTP 404: "${nonExistentDocRes.body.error}"`);

    // ─────────────────────────────────────────────────────────────
    // 4. Auditing GET /api/analyses/:id/report Status Codes & Silent Failure Detection
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 4. Auditing GET /api/analyses/:id/report Status Codes ---');

    // A. 404 for non-existent analysis
    const notFoundReportRes = await makeRequest({
      method: 'GET',
      path: '/api/analyses/non-existent-analysis-id-000/report',
    });
    assert.strictEqual(notFoundReportRes.status, 404, `Expected 404, got ${notFoundReportRes.status}`);
    console.log('  [PASS] Non-existent analysis ID returns HTTP 404');

    // B. 202 for pending/in-progress analysis
    const pendingAnalysisId = 'test-pending-' + uuidv4();
    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, mode, created_at)
      VALUES (?, ?, 'Audit Locality', 'pending', 'offline', ?)
    `).run(pendingAnalysisId, uploadedDocId, new Date().toISOString());

    const pendingReportRes = await makeRequest({
      method: 'GET',
      path: `/api/analyses/${pendingAnalysisId}/report`,
    });
    assert.strictEqual(pendingReportRes.status, 202, `Expected 202 for pending analysis, got ${pendingReportRes.status}`);
    assert.strictEqual(pendingReportRes.body.status, 'pending');
    console.log(`  [PASS] In-progress analysis returns HTTP 202: "${pendingReportRes.body.message}"`);

    // C. 500 for explicitly failed analysis
    const failedAnalysisId = 'test-failed-' + uuidv4();
    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, mode, created_at)
      VALUES (?, ?, 'Audit Locality', 'failed', 'offline', ?)
    `).run(failedAnalysisId, uploadedDocId, new Date().toISOString());

    const failedReportRes = await makeRequest({
      method: 'GET',
      path: `/api/analyses/${failedAnalysisId}/report`,
    });
    assert.strictEqual(failedReportRes.status, 500, `Expected 500 for failed analysis, got ${failedReportRes.status}`);
    assert.strictEqual(failedReportRes.body.status, 'failed');
    console.log(`  [PASS] Explicitly failed analysis returns HTTP 500: "${failedReportRes.body.error}"`);

    // D. 500 for silently failed analysis (marked 'complete' but report_json missing or empty)
    const silentFailId = 'test-silent-fail-' + uuidv4();
    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, mode, report_json, created_at)
      VALUES (?, ?, 'Audit Locality', 'complete', 'offline', NULL, ?)
    `).run(silentFailId, uploadedDocId, new Date().toISOString());

    const silentFailRes = await makeRequest({
      method: 'GET',
      path: `/api/analyses/${silentFailId}/report`,
    });
    assert.strictEqual(silentFailRes.status, 500, `Expected 500 for silent failure, got ${silentFailRes.status}`);
    assert(silentFailRes.body.error.includes('report_json is missing'), 'Expected missing report_json detection');
    console.log(`  [PASS] Silent failure (status complete but report_json missing) detected and returned HTTP 500: "${silentFailRes.body.error}"`);

    // ─────────────────────────────────────────────────────────────
    // 5. Synchronous Analysis Execution & Mode Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Pipeline Execution, Atomic Transitions & Mode Field ---');
    const syncRes = await makeRequest({
      method: 'POST',
      path: '/api/analyses?wait=true',
      headers: { 'Content-Type': 'application/json' },
      body: { document_id: uploadedDocId, locality: 'Indiranagar 100ft Road' },
    });
    assert.strictEqual(syncRes.status, 201, `Expected 201 for sync analysis, got ${syncRes.status}`);
    assert.strictEqual(syncRes.body.status, 'complete');
    assert(syncRes.body.mode === 'gemini' || syncRes.body.mode === 'offline', 'Expected mode to be gemini or offline');
    console.log(`  [PASS] Synchronous analysis completed atomically: ID ${syncRes.body.id}, Status: ${syncRes.body.status}, Mode: ${syncRes.body.mode}`);

    // Fetch report of completed analysis (must be 200 with mode field)
    const completedReportRes = await makeRequest({
      method: 'GET',
      path: `/api/analyses/${syncRes.body.id}/report`,
    });
    assert.strictEqual(completedReportRes.status, 200, `Expected 200 for completed report, got ${completedReportRes.status}`);
    assert.strictEqual(completedReportRes.body.status, 'complete');
    assert(completedReportRes.body.mode, 'Completed report must include mode field');
    console.log(`  [PASS] GET /api/analyses/:id/report returns HTTP 200 with verified mode: "${completedReportRes.body.mode}"`);

    console.log('\n================================================================');
    console.log('  🎉 ALL STATIC + RUNTIME AUDIT VERIFICATION CHECKS PASSED!');
    console.log('================================================================\n');
  } finally {
    try {
      db.prepare("DELETE FROM analyses WHERE id LIKE 'test-%'").run();
    } catch (_cleanErr) {}
    if (server) {
      server.close();
    }
  }
}

if (require.main === module) {
  runAuditVerificationSuite().catch((err) => {
    console.error('Audit verification error:', err);
    process.exit(1);
  });
}

module.exports = { runAuditVerificationSuite };
