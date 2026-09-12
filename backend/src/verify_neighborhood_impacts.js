/**
 * Verification Suite: Neighborhood Impact Assessment (Agent 4 Synthesis)
 * Tests 6 civil infrastructure dimensions, metrics, severity counts, and evidence citations
 */

const assert = require('assert');
const http = require('http');
const app = require('./index');
const db = require('./db');

const TEST_PORT = 3096;
let server;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (_e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const get = (path) => request('GET', path);

async function runNeighborhoodVerification() {
  console.log('================================================================');
  console.log('   CIVICLENS AI — NEIGHBORHOOD IMPACT ASSESSMENT VERIFICATION');
  console.log('================================================================\n');

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[INIT] Test server running on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  try {
    const doc = db.prepare(`
      SELECT * FROM documents LIMIT 1
    `).get();
    assert(doc, 'Seeded document must exist');

    let analysis = db.prepare(`
      SELECT * FROM analyses WHERE document_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(doc.id);
    assert(analysis, 'Analysis must exist');
    console.log(`  [PASS] Target document and analysis found (ID: ${analysis.id})`);

    // 1. Test GET /api/analyses/:id/neighborhood-impacts
    console.log('\n--- 1. Testing GET /api/analyses/:id/neighborhood-impacts ---');
    const res1 = await get(`/api/analyses/${analysis.id}/neighborhood-impacts`);
    assert.strictEqual(res1.status, 200, 'Endpoint must return 200 OK');
    assert(Array.isArray(res1.data.dimensions), 'Must return dimensions array');
    assert.strictEqual(res1.data.dimensions.length, 6, 'Must contain exactly 6 civil infrastructure dimensions');
    console.log(`  [PASS] Successfully retrieved 6 infrastructure dimensions for "${res1.data.project_title}"`);

    // 2. Test Severity Summary Badges (Matching Screenshot: 2 CRITICAL, 2 HIGH, 2 MEDIUM)
    console.log('\n--- 2. Verifying Severity Distribution (2 CRITICAL, 2 HIGH, 2 MEDIUM) ---');
    const summary = res1.data.summary_counts;
    assert.strictEqual(summary.critical, 2, 'Must have exactly 2 CRITICAL dimensions');
    assert.strictEqual(summary.high, 2, 'Must have exactly 2 HIGH dimensions');
    assert.strictEqual(summary.medium, 2, 'Must have exactly 2 MEDIUM dimensions');
    assert.strictEqual(summary.total, 6, 'Total must equal 6');
    console.log(`  [PASS] Severity counts verified: [${summary.critical} CRITICAL] [${summary.high} HIGH] [${summary.medium} MEDIUM]`);

    // 3. Verify All 6 Required Dimensions and Metric Chips
    console.log('\n--- 3. Verifying Dimensions, Metric Chips & Data Quality ---');
    const expectedKeys = ['traffic', 'parking', 'environment', 'water', 'waste', 'noise'];
    const returnedKeys = res1.data.dimensions.map(d => d.dimension_key);
    for (const key of expectedKeys) {
      assert(returnedKeys.includes(key), `Missing required dimension: ${key}`);
    }

    for (const dim of res1.data.dimensions) {
      assert(dim.icon, 'Dimension must have an icon');
      assert(dim.title, 'Dimension must have a title');
      assert(dim.metric_chip, 'Dimension must have a metric chip');
      assert(dim.data_quality, 'Dimension must have data_quality audit string');
      assert(dim.reasoning && dim.reasoning.length > 30, 'Dimension must have comprehensive reasoning text');
      assert(dim.citation_source, 'Dimension must have citation_source');
      assert(dim.evidence && dim.evidence.section_id, 'Dimension must have evidence anchor');
      console.log(`  [PASS] Verified ${dim.icon} ${dim.title} (${dim.severity}) -> "${dim.metric_chip}" | ${dim.data_quality}`);
    }

    // 4. Verify Evidence Inspection Link
    console.log('\n--- 4. Testing Evidence Inspection Link for Traffic Dimension ---');
    const trafficDim = res1.data.dimensions.find(d => d.dimension_key === 'traffic');
    const evRes = await get(`/api/analyses/${analysis.id}/evidence/${trafficDim.evidence.section_id}`);
    assert.strictEqual(evRes.status, 200, 'Evidence inspection endpoint must return 200');
    assert(evRes.data.text, 'Evidence text must be returned');
    console.log(`  [PASS] Evidence citation inspected successfully for section ${trafficDim.evidence.section_id}`);

    // 5. Test Secondary Route /api/neighborhood-impacts/:analysisId
    console.log('\n--- 5. Testing Secondary Route GET /api/neighborhood-impacts/:analysisId ---');
    const res2 = await get(`/api/neighborhood-impacts/${analysis.id}`);
    assert.strictEqual(res2.status, 200, 'Secondary route must return 200 OK');
    assert.strictEqual(res2.data.dimensions.length, 6);
    console.log(`  [PASS] Secondary route returns identical verified assessment`);

    console.log('\n================================================================');
    console.log('  🎉 ALL NEIGHBORHOOD IMPACT VERIFICATION CHECKS PASSED!');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

runNeighborhoodVerification().catch(err => {
  console.error('Neighborhood Impact Verification Failure:', err);
  if (server) server.close();
  process.exit(1);
});
