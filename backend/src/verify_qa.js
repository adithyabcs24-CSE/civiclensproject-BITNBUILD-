const assert = require('assert');
const http = require('http');
const app = require('./index');
const db = require('./db');

const PORT = 3099;
let server;

function post(urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      `http://localhost:${PORT}${urlPath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${urlPath}`, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

async function runQATests() {
  console.log('================================================================');
  console.log('       CIVICLENS AI — POLICY Q&A VERIFICATION SUITE');
  console.log('================================================================\n');

  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  try {
    const docs = db.prepare('SELECT id, title, original_filename FROM documents').all();
    console.log(`Found ${docs.length} documents in database.`);

    const maplewoodDoc = docs.find(d => d.title.includes('Maplewood') || d.original_filename.includes('maplewood'));
    const karnatakaDoc = docs.find(d => d.title.includes('Karnataka') || d.original_filename.includes('karnataka'));

    assert(maplewoodDoc, 'Maplewood document must exist');
    console.log(`  [PASS] Maplewood document found: ${maplewoodDoc.title} (${maplewoodDoc.id})`);

    const questions = [
      'What is this proposal about?',
      'Who will be affected?',
      'How much money is being allocated?',
      'What happens if this proposal is approved?',
      'When can citizens submit objections?'
    ];

    console.log('\n--- 1. Testing All 5 Preset Citizen Questions on Maplewood ---');
    for (const q of questions) {
      const res = await post(`/api/documents/${maplewoodDoc.id}/ask`, { question: q });
      assert.strictEqual(res.status, 200, `POST /ask should return 200 for "${q}"`);
      assert(res.data.answer, `Answer should be non-empty for "${q}"`);
      assert(Array.isArray(res.data.evidence) && res.data.evidence.length > 0, `Evidence must be present for "${q}"`);
      assert(res.data.evidence[0].exact_quote, `Evidence quote must be present for "${q}"`);
      assert(res.data.evidence[0].section_id, `Section ID must be present for "${q}"`);
      assert(res.data.confidence_score >= 0.8, `Confidence score must be >= 0.8 for "${q}"`);
      console.log(`  [PASS] “${q}” -> Grounded Answer with ${res.data.evidence.length} evidence citation(s)`);

      // Test evidence inspection endpoint using the returned section_id
      const evRes = await get(`/api/documents/${maplewoodDoc.id}/evidence/${res.data.evidence[0].section_id}`);
      assert.strictEqual(evRes.status, 200, 'Evidence inspection endpoint must return 200');
      assert(evRes.data.text, 'Evidence inspection must return genuine section text');
    }
    console.log('  [PASS] Evidence inspection endpoint verified for all Maplewood citations.');

    if (karnatakaDoc) {
      console.log('\n--- 2. Testing All 5 Preset Citizen Questions on Karnataka Municipal Act ---');
      for (const q of questions) {
        const res = await post(`/api/documents/${karnatakaDoc.id}/ask`, { question: q });
        assert.strictEqual(res.status, 200, `POST /ask should return 200 for Karnataka Act: "${q}"`);
        assert(res.data.answer, `Answer should be non-empty for "${q}"`);
        assert(Array.isArray(res.data.evidence) && res.data.evidence.length > 0, `Evidence must be present for "${q}"`);
        assert(res.data.evidence[0].exact_quote, `Evidence quote must be present for "${q}"`);
        console.log(`  [PASS] “${q}” -> Grounded Answer with ${res.data.evidence.length} statutory citation(s)`);
      }
    }

    console.log('\n--- 3. Testing Custom Arbitrary Citizen Questions ---');
    const customRes = await post(`/api/documents/${maplewoodDoc.id}/ask`, { 
      question: 'What are the environmental buffer rules near Mill Creek?' 
    });
    assert.strictEqual(customRes.status, 200);
    assert(customRes.data.answer, 'Custom question must receive an answer');
    assert(customRes.data.evidence.length > 0, 'Custom question must include evidence');
    console.log(`  [PASS] Custom Question answered with grounding score: ${(customRes.data.confidence_score * 100).toFixed(0)}%`);

    console.log('\n================================================================');
    console.log('  🎉 ALL POLICY Q&A VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

runQATests().catch(err => {
  console.error('Q&A Verification Failure:', err);
  if (server) server.close();
  process.exit(1);
});
