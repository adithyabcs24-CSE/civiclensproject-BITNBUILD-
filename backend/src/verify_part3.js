const db = require('./db');
const app = require('./index');
const { v4: uuidv4 } = require('uuid');

async function runPart3Verification() {
  console.log('================================================================');
  console.log('          CIVICLENS AI — PART 3 VERIFICATION SUITE');
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

  const maplewoodDoc = db.prepare(
    "SELECT * FROM documents WHERE original_filename = 'maplewood_zoning_proposal.txt'"
  ).get();
  const driftwoodDoc = db.prepare(
    "SELECT * FROM documents WHERE original_filename = 'driftwood_hollow_notice.txt'"
  ).get();

  assert(Boolean(maplewoodDoc), 'Maplewood Heights seeded document found');
  assert(Boolean(driftwoodDoc), 'Driftwood Hollow seeded document found');

  const server = app.listen(3299);
  const BASE_URL = 'http://localhost:3299';

  try {
    // ──────────────────────────────────────────────────────────
    // TEST 1: Full 5-stage analysis on Maplewood Heights (Seed 1)
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing Full 5-Stage Pipeline on Seed 1 (Maplewood Heights) ---');
    const customLocality1 = 'Ward 4 - Elm Street Corridor';
    const res1 = await fetch(`${BASE_URL}/api/analyses?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: maplewoodDoc.id,
        locality: customLocality1
      })
    });

    const analysis1 = await res1.json();
    assert(res1.status === 201, 'POST /api/analyses returns 201 Created');
    assert(analysis1.status === 'complete', 'Pipeline runs to status "complete"', `Status: ${analysis1.status}`);

    const report1 = analysis1.report_json;
    assert(Boolean(report1), 'report_json is populated on analyses row');

    // Verify all required report_json fields
    const requiredReportFields = [
      'project_title',
      'location',
      'what_is_happening',
      'why_it_matters',
      'who_may_be_affected',
      'important_dates',
      'impacts',
      'policies',
      'suggested_questions',
      'citizen_actions'
    ];

    const missingFields1 = requiredReportFields.filter(f => report1[f] === undefined);
    assert(
      missingFields1.length === 0,
      'report_json has all required fields with no omissions',
      `Missing fields: ${missingFields1.join(', ')}`
    );

    assert(
      report1.location === customLocality1,
      'Real locality string flows through to report_json.location',
      `Expected: "${customLocality1}", got: "${report1.location}"`
    );

    // Verify evidence objects are preserved intact on impacts and policies
    const allPoliciesHaveEvidence1 = Array.isArray(report1.policies) && report1.policies.length > 0 &&
      report1.policies.every(p => p.evidence && typeof p.evidence.section_id === 'string' && p.evidence.grounded === true);
    assert(
      allPoliciesHaveEvidence1,
      'Every policy in report_json preserves its Part 2 "evidence" object intact'
    );

    const allImpactsHaveEvidence1 = Array.isArray(report1.impacts) && report1.impacts.length > 0 &&
      report1.impacts.every(i => i.evidence && typeof i.evidence.section_id === 'string' && i.evidence.grounded === true);
    assert(
      allImpactsHaveEvidence1,
      'Every impact in report_json preserves its Part 2 "evidence" object intact'
    );

    // ──────────────────────────────────────────────────────────
    // TEST 2: Evidence citation endpoint GET /api/analyses/:id/evidence/:sectionId
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Evidence Citation Retrieval Endpoint ---');
    const sampleSectionId = report1.policies[0]?.evidence?.section_id;
    assert(Boolean(sampleSectionId), 'Extracted sample section_id from report evidence anchor');

    if (sampleSectionId) {
      const citationRes = await fetch(`${BASE_URL}/api/analyses/${analysis1.id}/evidence/${sampleSectionId}`);
      assert(citationRes.status === 200, 'GET /api/analyses/:id/evidence/:sectionId returns 200 OK');
      const citationData = await citationRes.json();
      assert(
        citationData.id === sampleSectionId &&
        typeof citationData.text === 'string' &&
        citationData.text.length > 0 &&
        citationData.heading !== undefined,
        'Evidence endpoint returns real source text, heading, and page number',
        `Heading: "${citationData.heading}", text length: ${citationData.text?.length}`
      );
    }

    // ──────────────────────────────────────────────────────────
    // TEST 3: Full 5-stage analysis on Driftwood Hollow (Thin Notice)
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Full 5-Stage Pipeline on Seed 2 (Driftwood Hollow - Thin Notice) ---');
    const customLocality2 = 'Driftwood Hollow North';
    const res2 = await fetch(`${BASE_URL}/api/analyses?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: driftwoodDoc.id,
        locality: customLocality2
      })
    });

    const analysis2 = await res2.json();
    assert(res2.status === 201, 'POST /api/analyses returns 201 for thin notice');
    assert(analysis2.status === 'complete', 'Thin document analysis completes successfully');

    const report2 = analysis2.report_json;
    const missingFields2 = requiredReportFields.filter(f => report2[f] === undefined);
    assert(
      missingFields2.length === 0,
      'Thin notice report_json has all required fields with no omissions'
    );

    const whyItMattersLower = report2.why_it_matters.toLowerCase();
    const isHonestLowInfo = whyItMattersLower.includes('insufficient') ||
                            whyItMattersLower.includes('not contain enough detail') ||
                            whyItMattersLower.includes('preliminary') ||
                            whyItMattersLower.includes('brief') ||
                            whyItMattersLower.includes('limited detail');

    assert(
      isHonestLowInfo,
      'Thin document produces an honest "insufficient information" style report',
      `why_it_matters: "${report2.why_it_matters}"`
    );

    // ──────────────────────────────────────────────────────────
    // TEST 4: GET /api/analyses/:id/report in complete, pending, and failed states
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing GET /api/analyses/:id/report Lifecycle Responses ---');

    // 4A: Complete State
    const completeReportRes = await fetch(`${BASE_URL}/api/analyses/${analysis1.id}/report`);
    assert(completeReportRes.status === 200, 'GET /report returns 200 for "complete" status');
    const completeReportData = await completeReportRes.json();
    assert(
      completeReportData.status === 'complete' && Boolean(completeReportData.project_title),
      'GET /report returns full report_json with status "complete"'
    );

    // 4B: Pending / In-progress State
    const dummyPendingId = uuidv4();
    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, created_at)
      VALUES (?, ?, 'Test Pending Locality', 'pending', ?)
    `).run(dummyPendingId, maplewoodDoc.id, new Date().toISOString());

    const pendingReportRes = await fetch(`${BASE_URL}/api/analyses/${dummyPendingId}/report`);
    assert(
      pendingReportRes.status === 202,
      'GET /report returns 202 "not ready" for "pending" status',
      `Status code: ${pendingReportRes.status}`
    );
    const pendingData = await pendingReportRes.json();
    assert(
      pendingData.status === 'pending' && pendingData.report === null,
      'Pending response includes current status and null report'
    );

    // 4C: Failed State
    const dummyFailedId = uuidv4();
    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, created_at)
      VALUES (?, ?, 'Test Failed Locality', 'failed', ?)
    `).run(dummyFailedId, maplewoodDoc.id, new Date().toISOString());

    const failedReportRes = await fetch(`${BASE_URL}/api/analyses/${dummyFailedId}/report`);
    assert(
      failedReportRes.status === 500,
      'GET /report returns 500 for "failed" status',
      `Status code: ${failedReportRes.status}`
    );
    const failedData = await failedReportRes.json();
    assert(
      failedData.status === 'failed' && Boolean(failedData.error),
      'Failed response clearly communicates the failure state'
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  🎉 ALL PART 3 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('  ❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runPart3Verification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
