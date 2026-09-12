/**
 * Seed script — runs both fictional documents through the same ingestDocument()
 * pipeline that the POST /api/documents endpoint uses, verifying end-to-end.
 */

require('./db'); // Initialize DB and create tables if not already present

const fs = require('fs');
const path = require('path');
const { ingestDocument } = require('./routes/documents');
const db = require('./db');

const SEEDS_DIR = path.join(__dirname, '..', 'seeds');

const seedFiles = [
  {
    filename: 'maplewood_zoning_proposal.txt',
    title: 'Maplewood Heights Transit-Oriented Mixed-Use Overlay District Proposal',
    doc_type: 'zoning_proposal',
  },
  {
    filename: 'driftwood_hollow_notice.txt',
    title: 'Driftwood Hollow Special Town Council Meeting Notice — November 2024',
    doc_type: 'public_notice',
  },
  {
    filename: 'karnataka_municipal_corporations_act.pdf',
    title: 'The Karnataka Municipal Corporations Act, 1976 (BBMP Framework)',
    doc_type: 'infrastructure_plan',
  },
];

async function seed() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  CivicLens AI — Database Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const seed of seedFiles) {
    const filePath = path.join(SEEDS_DIR, seed.filename);

    // Check if already seeded by original_filename to allow idempotent re-runs
    const existing = db.prepare(
      'SELECT id FROM documents WHERE original_filename = ?'
    ).get(seed.filename);

    if (existing) {
      console.log(`⏭  Already seeded: ${seed.filename} (id: ${existing.id})`);
      continue;
    }

    console.log(`📄 Ingesting: ${seed.filename}`);
    const buffer = fs.readFileSync(filePath);

    try {
      const result = await ingestDocument({
        buffer,
        mimetype: seed.filename.endsWith('.pdf') ? 'application/pdf' : 'text/plain',
        originalname: seed.filename,
        title: seed.title,
        doc_type: seed.doc_type,
      });

      console.log(`   ✅ document_id : ${result.document_id}`);
      console.log(`   ✅ sections    : ${result.sections.length}`);
      result.sections.forEach((s, i) => {
        const preview = s.text.substring(0, 80).replace(/\n/g, ' ');
        console.log(`      [${i}] heading="${s.heading || '(none)'}" → "${preview}…"`);
      });
      console.log();
    } catch (err) {
      console.error(`   ❌ Failed to ingest ${seed.filename}:`, err.message);
      process.exit(1);
    }
  }

  // Final verification
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Verification — all documents in DB');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const docs = db.prepare(`
    SELECT d.id, d.title, d.doc_type, COUNT(s.id) AS section_count
    FROM documents d
    LEFT JOIN document_sections s ON s.document_id = d.id
    GROUP BY d.id
    ORDER BY d.uploaded_at ASC
  `).all();

  for (const doc of docs) {
    console.log(`📁 [${doc.doc_type}] ${doc.title}`);
    console.log(`   id: ${doc.id}  |  sections: ${doc.section_count}`);
  }

  console.log('\n✅ Seed complete.\n');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
