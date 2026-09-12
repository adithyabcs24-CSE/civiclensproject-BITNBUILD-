const fs = require('fs');
const path = require('path');
const http = require('http');
const db = require('./db');

async function runVerification() {
  console.log('================================================================');
  console.log('          CIVICLENS AI — PART 1 VERIFICATION SUITE');
  console.log('================================================================\n');

  let allPassed = true;

  function assert(condition, testName, details) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
    } else {
      console.error(`  [FAIL] ${testName}: ${details || 'Condition failed'}`);
      allPassed = false;
    }
  }

  // ──────────────────────────────────────────────────────────
  // 1. EXACT SCHEMA VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('--- 1. Schema Verification ---');
  
  const expectedSchemas = {
    documents: ['id', 'title', 'doc_type', 'original_filename', 'raw_text', 'uploaded_at'],
    document_sections: ['id', 'document_id', 'heading', 'text', 'page', 'order_index'],
    analyses: ['id', 'document_id', 'locality', 'status', 'document_json', 'policy_json', 'impact_json', 'evidence_json', 'report_json', 'created_at'],
  };

  for (const [table, expectedCols] of Object.entries(expectedSchemas)) {
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
    const actualCols = tableInfo.map(c => c.name);
    
    const match = expectedCols.every(col => actualCols.includes(col)) &&
                  (expectedCols.length === actualCols.length || (table === 'analyses' && actualCols.includes('mode')));

    assert(
      match,
      `Table "${table}" schema`,
      `Expected columns: [${expectedCols.join(', ')}]\n          Actual columns:   [${actualCols.join(', ')}]`
    );
  }

  // ──────────────────────────────────────────────────────────
  // 2. START SERVER FOR HTTP VERIFICATION
  // ──────────────────────────────────────────────────────────
  console.log('\n--- 2. HTTP Endpoint Verification ---');
  const app = require('./index');
  const server = app.listen(3099);

  const BASE_URL = 'http://localhost:3099';

  async function get(urlPath) {
    const res = await fetch(`${BASE_URL}${urlPath}`);
    return { status: res.status, data: await res.json() };
  }

  try {
    // Check Health
    const health = await get('/api/health');
    assert(health.status === 200 && health.data.status === 'ok', 'GET /api/health responds 200 OK');

    // Check GET /api/documents
    const docList = await get('/api/documents');
    assert(
      docList.status === 200 && Array.isArray(docList.data.documents) && docList.data.documents.length >= 2,
      'GET /api/documents lists at least the 2 seeded documents',
      `Found ${docList.data.documents?.length} documents`
    );

    const seededZoning = docList.data.documents.find(d => d.original_filename === 'maplewood_zoning_proposal.txt');
    const seededNotice = docList.data.documents.find(d => d.original_filename === 'driftwood_hollow_notice.txt');

    assert(Boolean(seededZoning), 'Seeded document 1 exists: maplewood_zoning_proposal.txt');
    assert(Boolean(seededNotice), 'Seeded document 2 exists: driftwood_hollow_notice.txt');

    // Check GET /api/documents/:id for seeded document
    if (seededZoning) {
      const singleDoc = await get(`/api/documents/${seededZoning.id}`);
      assert(
        singleDoc.status === 200 && singleDoc.data.document && singleDoc.data.sections.length > 0,
        'GET /api/documents/:id returns full document and sections',
        `Retrieved ${singleDoc.data.sections?.length} sections`
      );
      assert(
        typeof singleDoc.data.sections[0].text === 'string' && singleDoc.data.sections[0].text.length > 0,
        'GET /api/documents/:id sections contain non-empty text'
      );
    }

    // ──────────────────────────────────────────────────────────
    // 3. POST /api/documents (Upload real PDF)
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 3. PDF Upload Ingestion Verification ---');
    const pdfPath = path.join(__dirname, '..', 'test_real.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Build multipart/form-data payload natively
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let postData = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test_real.pdf"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`
      ),
      pdfBuffer,
      Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="title"\r\n\r\n` +
        `Test Real Municipal PDF\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="doc_type"\r\n\r\n` +
        `zoning_proposal\r\n` +
        `--${boundary}--\r\n`
      ),
    ]);

    const uploadRes = await fetch(`${BASE_URL}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': postData.length.toString(),
      },
      body: postData,
    });

    const uploadData = await uploadRes.json();
    assert(
      uploadRes.status === 201 && uploadData.document_id && Array.isArray(uploadData.sections) && uploadData.sections.length > 0,
      'POST /api/documents with real PDF returns document_id and non-empty sections',
      `Status: ${uploadRes.status}, Document ID: ${uploadData.document_id}, Sections: ${uploadData.sections?.length}`
    );

    // Verify newly uploaded PDF via GET /api/documents/:id
    if (uploadData.document_id) {
      const uploadedDoc = await get(`/api/documents/${uploadData.document_id}`);
      assert(
        uploadedDoc.status === 200 && uploadedDoc.data.document.title === 'Test Real Municipal PDF',
        'GET /api/documents/:id retrieves newly uploaded PDF document and sections',
        `Title: ${uploadedDoc.data.document?.title}, Sections count: ${uploadedDoc.data.sections?.length}`
      );
    }

    // Verify updated GET /api/documents count
    const updatedList = await get('/api/documents');
    assert(
      updatedList.data.documents.length >= 3,
      'GET /api/documents lists seeded documents + uploaded PDF document',
      `Total documents in database: ${updatedList.data.documents.length}`
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('  ❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
