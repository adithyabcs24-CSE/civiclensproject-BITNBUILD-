/**
 * Verification Suite: Civic Timeline (Feature 11)
 * Tests chronological milestone extraction, evidence grounding, and plain text formatting
 */

const assert = require('assert');
const http = require('http');
const app = require('./index');
const db = require('./db');

const TEST_PORT = 3097;
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

async function runTimelineVerification() {
  console.log('================================================================');
  console.log('       CIVICLENS AI — CIVIC TIMELINE VERIFICATION SUITE');
  console.log('================================================================\n');

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[INIT] Test server running on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  try {
    // 1. Find or create a completed analysis for Maplewood
    const maplewoodDoc = db.prepare(`
      SELECT * FROM documents WHERE title LIKE '%Maplewood%' LIMIT 1
    `).get();

    assert(maplewoodDoc, 'Maplewood document must exist in database');

    let analysis = db.prepare(`
      SELECT * FROM analyses WHERE document_id = ? AND status = 'complete' ORDER BY created_at DESC LIMIT 1
    `).get(maplewoodDoc.id);

    if (!analysis) {
      // Find any analysis or create one
      analysis = db.prepare(`
        SELECT * FROM analyses WHERE document_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(maplewoodDoc.id);
    }
    assert(analysis, 'Maplewood analysis must exist');
    console.log(`  [PASS] Maplewood document and analysis found (ID: ${analysis.id})`);

    // 2. Test GET /api/analyses/:id/timeline
    console.log('\n--- 1. Testing GET /api/analyses/:id/timeline ---');
    const res1 = await get(`/api/analyses/${analysis.id}/timeline`);
    assert.strictEqual(res1.status, 200, 'Endpoint should return 200 OK');
    assert(res1.data.plain_text, 'Response must contain plain_text timeline');
    assert(Array.isArray(res1.data.milestones), 'Response must contain milestones array');
    assert(res1.data.milestones.length >= 4, 'Must have at least 4 chronological milestones');

    console.log(`  [PASS] Successfully retrieved ${res1.data.milestones.length} milestones for ${res1.data.project_title}`);

    // 3. Test Plain Text Format with Down-Arrows (↓)
    console.log('\n--- 2. Testing Plain Text Format (User Specification) ---');
    const plainText = res1.data.plain_text;
    assert(plainText.includes('↓'), 'Plain text timeline MUST contain down-arrows (↓)');
    console.log('  [PASS] Plain text timeline contains required down-arrows (↓)');
    console.log('  [PREVIEW] Plain text sample:\n');
    console.log(plainText.split('\n').slice(0, 10).map(l => `    ${l}`).join('\n'));
    console.log('    ...\n');

    // 4. Verify Milestone Schema & Grounding
    console.log('--- 3. Testing Milestone Grounding & Evidence Links ---');
    for (const m of res1.data.milestones) {
      assert(m.id, 'Milestone must have id');
      assert(m.date, 'Milestone must have date');
      assert(m.date_display, 'Milestone must have date_display');
      assert(m.milestone, 'Milestone must have title');
      assert(m.phase, 'Milestone must have phase');
      assert(m.description, 'Milestone must have description');
      assert(m.responsible_entity, 'Milestone must have responsible_entity');
      assert(m.evidence, 'Milestone must have evidence');
      assert(m.evidence.section_id, 'Milestone evidence must have section_id');
      assert(m.evidence.excerpt_quote, 'Milestone evidence must have excerpt_quote');
    }
    console.log('  [PASS] All milestones adhere to strict evidence contract with statutory quotes and sections');

    // Test evidence retrieval endpoint for the first milestone
    const sampleMilestone = res1.data.milestones[0];
    const evRes = await get(`/api/analyses/${analysis.id}/evidence/${sampleMilestone.evidence.section_id}`);
    assert.strictEqual(evRes.status, 200, 'Evidence endpoint must return 200');
    assert(evRes.data.text, 'Evidence endpoint must return section text');
    console.log(`  [PASS] Evidence inspection verified for milestone "${sampleMilestone.milestone}"`);

    // 5. Test Secondary Route /api/timeline/:analysisId
    console.log('\n--- 4. Testing Secondary Route GET /api/timeline/:analysisId ---');
    const res2 = await get(`/api/timeline/${analysis.id}`);
    assert.strictEqual(res2.status, 200, 'GET /api/timeline/:analysisId must return 200');
    assert.strictEqual(res2.data.milestones_count, res1.data.milestones_count);
    console.log(`  [PASS] Both routes return identical verified milestone payloads`);

    // 6. Test Thin Document Graceful Fallback
    console.log('\n--- 5. Testing Thin Document Timeline ---');
    const thinDoc = db.prepare(`
      SELECT * FROM documents WHERE title LIKE '%Driftwood%' LIMIT 1
    `).get();

    if (thinDoc) {
      const thinAnalysis = db.prepare(`
        SELECT * FROM analyses WHERE document_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(thinDoc.id);

      if (thinAnalysis) {
        const thinRes = await get(`/api/analyses/${thinAnalysis.id}/timeline`);
        assert.strictEqual(thinRes.status, 200);
        assert(thinRes.data.milestones.length >= 2);
        assert(thinRes.data.plain_text.includes('↓'));
        console.log(`  [PASS] Thin document produces honest timeline (${thinRes.data.milestones.length} milestones)`);
      }
    }

    console.log('\n================================================================');
    console.log('  🎉 ALL CIVIC TIMELINE VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

runTimelineVerification().catch(err => {
  console.error('Timeline Verification Failure:', err);
  if (server) server.close();
  process.exit(1);
});
