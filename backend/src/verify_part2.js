const db = require('./db');
const app = require('./index');

async function runPart2Verification() {
  console.log('================================================================');
  console.log('          CIVICLENS AI — PART 2 VERIFICATION SUITE');
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

  // 1. Fetch the 2 seeded documents from DB
  const maplewoodDoc = db.prepare(
    "SELECT * FROM documents WHERE original_filename = 'maplewood_zoning_proposal.txt'"
  ).get();
  const driftwoodDoc = db.prepare(
    "SELECT * FROM documents WHERE original_filename = 'driftwood_hollow_notice.txt'"
  ).get();

  assert(Boolean(maplewoodDoc), 'Maplewood Heights seeded document found');
  assert(Boolean(driftwoodDoc), 'Driftwood Hollow seeded document found');

  if (!maplewoodDoc || !driftwoodDoc) {
    console.error('Seeded documents missing from DB. Run npm run seed first.');
    process.exit(1);
  }

  const server = app.listen(3199);
  const BASE_URL = 'http://localhost:3199';

  try {
    // ──────────────────────────────────────────────────────────
    // TEST 1: Pipeline run on Maplewood Heights (Zoning Proposal)
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing Pipeline on Seed 1 (Maplewood Heights - Zoning) ---');
    const res1 = await fetch(`${BASE_URL}/api/analyses?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: maplewoodDoc.id,
        locality: 'Ward 4 - Greenway Corridor'
      })
    });

    const analysis1 = await res1.json();
    assert(res1.status === 201, 'POST /api/analyses returns 201 Created');
    assert(analysis1.status === 'evidence' || analysis1.status === 'complete', 'Analysis 1 progresses past "evidence" stage', `Status: ${analysis1.status}`);

    // Verify Stage 1: Document JSON
    const doc1Json = analysis1.document_json;
    assert(
      doc1Json && doc1Json.doc_type === 'zoning_proposal' && typeof doc1Json.summary === 'string',
      'Stage 1 (Document Agent): valid doc_type and summary'
    );
    assert(
      Array.isArray(doc1Json.sections) && doc1Json.sections.length > 0,
      'Stage 1 (Document Agent): sections array populated'
    );
    assert(
      Array.isArray(doc1Json.key_dates) && doc1Json.entities && Array.isArray(doc1Json.entities.location_mentions),
      'Stage 1 (Document Agent): key_dates and entities strictly formatted'
    );

    // Verify Stage 2: Policy JSON
    const pol1Json = analysis1.policy_json;
    assert(
      pol1Json && Array.isArray(pol1Json.policies) && pol1Json.policies.length > 0,
      'Stage 2 (Policy Agent): policies array populated'
    );

    const doc1SectionIds = new Set(doc1Json.sections.map(s => s.id));
    const allPoliciesGrounded1 = pol1Json.policies.every(p => doc1SectionIds.has(p.source_section_id));
    assert(
      allPoliciesGrounded1,
      'Stage 2: Every policy has a source_section_id that exists in the real document'
    );

    // Verify Stage 3: Impact JSON
    const imp1Json = analysis1.impact_json;
    assert(
      imp1Json && Array.isArray(imp1Json.impacts) && imp1Json.impacts.length > 0,
      'Stage 3 (Impact Agent): impacts array populated'
    );
    const pol1Ids = new Set(pol1Json.policies.map(p => p.id));
    const allImpactsHavePolicy1 = imp1Json.impacts.every(
      i => Array.isArray(i.based_on_policy_ids) && i.based_on_policy_ids.some(pid => pol1Ids.has(pid))
    );
    assert(
      allImpactsHavePolicy1,
      'Stage 3: Every impact has at least one based_on_policy_ids entry that exists in policies'
    );

    // Verify Stage 4: Evidence JSON
    const ev1Json = analysis1.evidence_json;
    assert(
      ev1Json && Array.isArray(ev1Json.policies) && Array.isArray(ev1Json.impacts),
      'Stage 4 (Evidence Agent): output contains policies and impacts arrays'
    );
    const allEvidenceAnchored1 = ev1Json.policies.every(p => p.evidence && p.evidence.grounded === true) &&
                                 ev1Json.impacts.every(i => i.evidence && i.evidence.grounded === true);
    assert(
      allEvidenceAnchored1,
      'Stage 4: Every retained policy and impact has an evidence anchor with grounded: true'
    );

    // ──────────────────────────────────────────────────────────
    // TEST 2: Pipeline run on Driftwood Hollow (Thin Public Notice)
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Anti-Hallucination Gate on Seed 2 (Driftwood Hollow - Thin Notice) ---');
    const res2 = await fetch(`${BASE_URL}/api/analyses?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: driftwoodDoc.id,
        locality: 'Driftwood Hollow Village'
      })
    });

    const analysis2 = await res2.json();
    assert(res2.status === 201, 'POST /api/analyses returns 201 for thin document');
    assert(analysis2.status === 'evidence' || analysis2.status === 'complete', 'Analysis 2 progresses past "evidence" stage');

    const ev2Json = analysis2.evidence_json;
    const imp2Json = analysis2.impact_json;

    // Confirm that on the thin document, items are dropped or marked inferred
    const droppedCount = imp2Json.impacts.length - ev2Json.impacts.length;
    const inferredItems = ev2Json.impacts.filter(i => i.inferred === true);

    assert(
      droppedCount > 0 || inferredItems.length > 0,
      'Anti-hallucination gate: ungrounded items are dropped OR marked inferred',
      `Dropped items: ${droppedCount}, Inferred items with downgraded confidence: ${inferredItems.length}`
    );

    const inferredHaveLowConfidence = inferredItems.every(i => i.confidence === 'low');
    assert(
      inferredHaveLowConfidence,
      'Anti-hallucination gate: all inferred items have confidence downgraded to "low"'
    );

    // ──────────────────────────────────────────────────────────
    // TEST 3: Incremental State Progression & GET /api/analyses/:id
    // ──────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Incremental State & GET /api/analyses/:id ---');

    // Create an analysis asynchronously without ?wait=true
    const asyncRes = await fetch(`${BASE_URL}/api/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: maplewoodDoc.id,
        locality: 'Ward 4'
      })
    });
    const asyncCreated = await asyncRes.json();
    assert(
      asyncRes.status === 201 && asyncCreated.status === 'pending',
      'Async POST /api/analyses returns 201 with initial status "pending"'
    );

    // Poll GET /api/analyses/:id to observe progression
    const observedStatuses = new Set([asyncCreated.status]);
    const maxPolls = 20;
    for (let p = 0; p < maxPolls; p++) {
      await new Promise(r => setTimeout(r, 80));
      const pollRes = await fetch(`${BASE_URL}/api/analyses/${asyncCreated.id}`);
      const pollData = await pollRes.json();
      observedStatuses.add(pollData.status);
      if (pollData.status === 'evidence' || pollData.status === 'complete' || pollData.status === 'failed') {
        break;
      }
    }

    assert(
      observedStatuses.has('pending'),
      'Status lifecycle includes "pending"'
    );
    assert(
      observedStatuses.has('evidence') || observedStatuses.has('complete'),
      'Status lifecycle completes past "evidence"'
    );

    // Final GET verification
    const finalGetRes = await fetch(`${BASE_URL}/api/analyses/${asyncCreated.id}`);
    const finalData = await finalGetRes.json();
    assert(
      (finalData.status === 'evidence' || finalData.status === 'complete') &&
      finalData.document_json !== null &&
      finalData.policy_json !== null &&
      finalData.impact_json !== null &&
      finalData.evidence_json !== null,
      'GET /api/analyses/:id returns all populated stage JSON columns'
    );

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('  🎉 ALL PART 2 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  } else {
    console.error('  ❌ SOME CHECKS FAILED.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runPart2Verification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
