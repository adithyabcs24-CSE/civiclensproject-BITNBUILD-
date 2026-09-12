const assert = require('assert');
const db = require('./db');
const { runEvidenceAgent } = require('./pipeline/agents/evidenceAgent');

async function testAntiHallucinationGate() {
  console.log('================================================================');
  console.log('   CIVICLENS AI — ANTI-HALLUCINATION GATE VERIFICATION');
  console.log('================================================================\n');

  // Find a document with real sections
  const doc = db.prepare('SELECT id, title FROM documents LIMIT 1').get();
  assert(doc, 'Test requires at least one document in DB.');

  const sections = db.prepare('SELECT id, heading, text, page, order_index FROM document_sections WHERE document_id = ?').all(doc.id);
  assert(sections.length > 0, 'Document must have at least one section in document_sections table.');

  const realSec1 = sections[0];
  const realSec2 = sections[1] || sections[0];
  const fakeSecId = 'completely_fabricated_section_id_99999';

  console.log(`Auditing with Real Document: "${doc.title}" (ID: ${doc.id})`);
  console.log(`Real Section 1: ${realSec1.id}`);
  console.log(`Fake Section Tested: ${fakeSecId}\n`);

  const stage1Output = {
    doc_type: 'zoning_proposal',
    title: doc.title,
    summary: 'Document test summary.',
    sections: sections.map(s => ({ id: s.id, heading: s.heading, text: s.text, page: s.page })),
  };

  const stage2Output = {
    policies: [
      {
        id: 'pol_real',
        name: 'Grounded Real Policy',
        description: 'This policy references an authentic, real section in the DB.',
        source_section_id: realSec1.id,
        confidence: 'high',
        evidence: {
          section_id: realSec1.id,
          excerpt_location: 'Page 1, Section 1',
          grounded: true,
        },
      },
      {
        id: 'pol_fake',
        name: 'Hallucinated Fake Policy',
        description: 'This policy references a non-existent section ID and MUST be dropped.',
        source_section_id: fakeSecId,
        confidence: 'high',
        evidence: {
          section_id: fakeSecId,
          excerpt_location: 'Fabricated page 99',
          grounded: true,
        },
      },
    ],
  };

  const stage3Output = {
    impacts: [
      {
        id: 'imp_real',
        category: 'housing',
        statement: 'This impact is supported by real policy and real section.',
        based_on_policy_ids: ['pol_real'],
        confidence: 'high',
        evidence: {
          section_id: realSec2.id,
          excerpt_location: 'Real section location',
          grounded: true,
        },
      },
      {
        id: 'imp_fake_section',
        category: 'cost',
        statement: 'This impact uses a fabricated section ID and MUST be dropped.',
        based_on_policy_ids: ['pol_real'],
        confidence: 'high',
        evidence: {
          section_id: fakeSecId,
          excerpt_location: 'Fake location',
          grounded: true,
        },
      },
      {
        id: 'imp_orphan_policy',
        category: 'traffic',
        statement: 'This impact relies exclusively on the fake policy and MUST be dropped.',
        based_on_policy_ids: ['pol_fake'],
        confidence: 'high',
        evidence: {
          section_id: realSec1.id,
          excerpt_location: 'Real section location',
          grounded: true,
        },
      },
    ],
  };

  const audited = await runEvidenceAgent({
    document: doc,
    sections,
    stage1Output,
    stage2Output,
    stage3Output,
  });

  console.log('Audit Results:');
  console.log(`- Policies in: ${stage2Output.policies.length} -> Policies out: ${audited.policies.length}`);
  console.log(`- Impacts in: ${stage3Output.impacts.length} -> Impacts out: ${audited.impacts.length}\n`);

  // 1. Confirm fake policy was dropped
  const polFakeFound = audited.policies.find(p => p.id === 'pol_fake' || p.source_section_id === fakeSecId);
  assert(!polFakeFound, 'FAIL: Hallucinated policy with fake section ID was NOT dropped!');
  console.log('  [PASS] Hallucinated policy with fake section ID was dropped.');

  // 2. Confirm grounded policy was retained
  const polRealFound = audited.policies.find(p => p.id === 'pol_real');
  assert(polRealFound, 'FAIL: Real grounded policy was dropped!');
  console.log('  [PASS] Grounded policy was verified and retained.');

  // 3. Confirm impact with fake section ID was dropped
  const impFakeFound = audited.impacts.find(i => i.id === 'imp_fake_section' || i.evidence?.section_id === fakeSecId);
  assert(!impFakeFound, 'FAIL: Impact with fake section ID was NOT dropped!');
  console.log('  [PASS] Impact with fake section ID was dropped.');

  // 4. Confirm orphan impact whose parent policy was dropped also gets dropped
  const impOrphanFound = audited.impacts.find(i => i.id === 'imp_orphan_policy');
  assert(!impOrphanFound, 'FAIL: Impact whose supporting policy was dropped was NOT dropped!');
  console.log('  [PASS] Orphaned impact based on dropped fake policy was dropped.');

  // 5. Confirm grounded impact was retained
  const impRealFound = audited.impacts.find(i => i.id === 'imp_real');
  assert(impRealFound, 'FAIL: Real grounded impact was dropped!');
  console.log('  [PASS] Grounded impact was verified and retained.');

  console.log('\n================================================================');
  console.log('  🎉 ALL ANTI-HALLUCINATION GATE VERIFICATION CHECKS PASSED!');
  console.log('================================================================\n');
}

if (require.main === module) {
  testAntiHallucinationGate().catch(err => {
    console.error('Anti-hallucination verification error:', err);
    process.exit(1);
  });
}

module.exports = { testAntiHallucinationGate };
