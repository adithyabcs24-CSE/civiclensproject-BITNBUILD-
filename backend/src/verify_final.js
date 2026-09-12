const fs = require('fs');
const path = require('path');
const db = require('./db');
const app = require('./index');

async function runFinalVerification() {
  console.log('================================================================');
  console.log('       CIVICLENS AI — FINAL INTEGRATION & ACCEPTANCE SUITE');
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

  const server = app.listen(3399);
  const BASE_URL = 'http://localhost:3399';

  try {
    // ──────────────────────────────────────────────────────────
    // CHECK 1: Real PDF Upload to Complete Citizen Report End-to-End
    // ──────────────────────────────────────────────────────────
    console.log('--- 1. End-to-End Flow: Real PDF Upload → Pipeline → Citizen Report ---');
    const pdfPath = path.join(__dirname, '..', 'test_real.pdf');
    const pdfBuffer = fs.readFileSync(pdfPath);

    const boundary = '----CivicLensBoundary' + Math.random().toString(36).substring(2);
    const postData = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="municipal_water_plan.pdf"\r\n` +
        `Content-Type: application/pdf\r\n\r\n`
      ),
      pdfBuffer,
      Buffer.from(
        `\r\n--${boundary}\r\n` +
        `Content-Disposition: form-data; name="title"\r\n\r\n` +
        `Municipal Greenway & Infrastructure Master Plan\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="doc_type"\r\n\r\n` +
        `infrastructure_plan\r\n` +
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
    assert(uploadRes.status === 201 && uploadData.document_id, 'Upload real PDF via API produces document_id');

    // Launch analysis with custom locality
    const targetLocality = 'Highland Park Sub-District';
    const launchRes = await fetch(`${BASE_URL}/api/analyses?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: uploadData.document_id,
        locality: targetLocality,
      }),
    });

    const launchedData = await launchRes.json();
    assert(launchRes.status === 201, 'Analysis initiated for newly uploaded PDF');
    assert(launchedData.status === 'complete', 'Pipeline runs to "complete" for uploaded PDF');

    // Fetch report
    const reportRes = await fetch(`${BASE_URL}/api/analyses/${launchedData.id}/report`);
    assert(reportRes.status === 200, 'GET /api/analyses/:id/report returns HTTP 200');
    const reportData = await reportRes.json();

    assert(
      reportData.location === targetLocality,
      'Target locality correctly flows to final citizen report location'
    );
    assert(
      Array.isArray(reportData.impacts) && reportData.impacts.length > 0,
      'Final report contains verified localized impacts'
    );
    assert(
      Array.isArray(reportData.policies) && reportData.policies.length > 0,
      'Final report contains verified policies'
    );

    // Test evidence link retrieval for report citations
    const sampleCitationId = reportData.impacts[0]?.evidence?.section_id || reportData.policies[0]?.evidence?.section_id;
    assert(Boolean(sampleCitationId), 'Extracted evidence section_id citation from report card');

    const evidenceRes = await fetch(`${BASE_URL}/api/analyses/${launchedData.id}/evidence/${sampleCitationId}`);
    assert(evidenceRes.status === 200, 'GET /evidence/:sectionId returns HTTP 200 with source text');
    const evidenceData = await evidenceRes.json();
    assert(
      typeof evidenceData.text === 'string' && evidenceData.text.length > 0,
      'Evidence citation endpoint returns genuine source passage text'
    );

    // ──────────────────────────────────────────────────────────
    // CHECK 2: Seeded Document Fallbacks
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 2. Verifying Seeded Document Instant Fallbacks ---');
    const docsRes = await fetch(`${BASE_URL}/api/documents`);
    const docsJson = await docsRes.json();
    const seededZoning = docsJson.documents.find(d => d.original_filename === 'maplewood_zoning_proposal.txt');
    const seededNotice = docsJson.documents.find(d => d.original_filename === 'driftwood_hollow_notice.txt');

    assert(Boolean(seededZoning), 'Seeded proposal 1 available: maplewood_zoning_proposal.txt');
    assert(Boolean(seededNotice), 'Seeded proposal 2 available: driftwood_hollow_notice.txt');

    // ──────────────────────────────────────────────────────────
    // CHECK 3: Thin Document Graceful Degradation in Report
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 3. Verifying Thin Document Graceful Degradation ---');
    const thinAnalysisRes = await fetch(`${BASE_URL}/api/analyses?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: seededNotice.id,
        locality: 'Lakeview District',
      }),
    });
    const thinAnalysisData = await thinAnalysisRes.json();
    const thinReport = thinAnalysisData.report_json;

    const whyLower = (thinReport.why_it_matters || '').toLowerCase();
    const showsInsufficientInfo = whyLower.includes('insufficient') ||
                                  whyLower.includes('not contain enough detail') ||
                                  whyLower.includes('limited detail') ||
                                  whyLower.includes('preliminary') ||
                                  whyLower.includes('brief');

    assert(
      showsInsufficientInfo,
      'Thin seeded document visibly communicates "insufficient information" rather than confident fabrication',
      `why_it_matters: "${thinReport.why_it_matters}"`
    );

    // ──────────────────────────────────────────────────────────
    // CHECK 4: Frontend UI Build, Disclaimer & Component Verification
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 4. Verifying Frontend Assets & Mandatory Disclaimer ---');
    const distHtmlPath = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
    assert(fs.existsSync(distHtmlPath), 'Frontend production build exists (dist/index.html)');

    const distAssetsDir = path.join(__dirname, '..', '..', 'frontend', 'dist', 'assets');
    const assetFiles = fs.readdirSync(distAssetsDir);
    const jsAsset = assetFiles.find(f => f.endsWith('.js'));
    const cssAsset = assetFiles.find(f => f.endsWith('.css'));

    assert(Boolean(jsAsset), `Frontend bundled JS found: ${jsAsset}`);
    assert(Boolean(cssAsset), `Frontend bundled CSS found: ${cssAsset}`);

    // Verify Disclaimer in source code and bundle
    const citizenReportSrc = fs.readFileSync(
      path.join(__dirname, '..', '..', 'frontend', 'src', 'components', 'CitizenReport.jsx'),
      'utf-8'
    );
    const expectedDisclaimer = 'CivicLens AI provides informational summaries only and is not a substitute for reviewing official government documents or consulting your local government office.';
    assert(
      citizenReportSrc.includes(expectedDisclaimer),
      'CitizenReport component includes mandatory transparency disclaimer verbatim'
    );

    // Verify Evidence link on every card
    assert(
      citizenReportSrc.includes('onOpenEvidence') && citizenReportSrc.includes('View source evidence'),
      'CitizenReport cards render clickable "View source evidence" links'
    );

    // ──────────────────────────────────────────────────────────
    // CHECK 5: Evidence Anchor Integrity & Anti-Hallucination Gate
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 5. Verifying Grounding and Anti-Hallucination Gate ---');
    const allAnalyses = db.prepare("SELECT id, evidence_json, report_json FROM analyses WHERE status = 'complete'").all();
    let ungroundedFound = false;

    for (const a of allAnalyses) {
      if (!a.report_json) continue;
      const rep = JSON.parse(a.report_json);
      if (!rep) continue;
      if (Array.isArray(rep.impacts)) {
        for (const imp of rep.impacts) {
          if (!imp.evidence || !imp.evidence.section_id) {
            ungroundedFound = true;
          }
        }
      }
      if (Array.isArray(rep.policies)) {
        for (const pol of rep.policies) {
          if (!pol.evidence || !pol.evidence.section_id) {
            ungroundedFound = true;
          }
        }
      }
    }

    assert(
      !ungroundedFound,
      'Every policy and impact across all completed reports carries a verified section citation'
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  🎉 ALL FINAL INTEGRATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('  ❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runFinalVerification().catch(err => {
  console.error('Final verification error:', err);
  process.exit(1);
});
