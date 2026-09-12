const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { extractSections } = require('../sectioner');

// Multer: store uploaded files in memory (max 20 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or plain text files are accepted.'));
    }
  },
});

/**
 * Ingest a document: extract text, section it, persist to DB.
 * Can accept either a Buffer (for seeding) or a multer file object.
 */
async function ingestDocument({ buffer, mimetype, originalname, title, doc_type }) {
  let rawText = '';

  if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    rawText = data.text;
  } else {
    rawText = buffer.toString('utf-8');
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('Could not extract any text from the uploaded file.');
  }

  const docId = uuidv4();
  const now = new Date().toISOString();

  // Derive title from filename if not provided
  const resolvedTitle = title || originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const resolvedType = doc_type || 'unknown';

  // Insert document row
  const insertDoc = db.prepare(`
    INSERT INTO documents (id, title, doc_type, original_filename, raw_text, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertDoc.run(docId, resolvedTitle, resolvedType, originalname, rawText, now);

  // Section the text
  const sections = extractSections(rawText);

  // Insert each section
  const insertSection = db.prepare(`
    INSERT INTO document_sections (id, document_id, heading, text, page, order_index)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((secs) => {
    for (const s of secs) {
      insertSection.run(s.id, docId, s.heading || null, s.text, s.page || null, s.order_index);
    }
  });
  insertMany(sections);

  return { document_id: docId, sections };
}

// ──────────────────────────────────────────────
// POST /api/documents  — upload & ingest
// ──────────────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a PDF or .txt as form-data field "file".' });
    }

    const { title, doc_type } = req.body;

    const result = await ingestDocument({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      title,
      doc_type,
    });

    res.status(201).json({
      document_id: result.document_id,
      section_count: result.sections.length,
      sections: result.sections.map(s => ({
        id: s.id,
        heading: s.heading,
        order_index: s.order_index,
        text_preview: s.text.substring(0, 120) + (s.text.length > 120 ? '…' : ''),
      })),
    });
  } catch (err) {
    console.error('Ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/documents  — list all
// ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const docs = db.prepare(`
    SELECT d.id, d.title, d.doc_type, d.original_filename, d.uploaded_at,
           COUNT(s.id) AS section_count
    FROM documents d
    LEFT JOIN document_sections s ON s.document_id = d.id
    GROUP BY d.id
    ORDER BY d.uploaded_at DESC
  `).all();

  res.json({ documents: docs });
});

// ──────────────────────────────────────────────
// GET /api/documents/:id  — single doc + sections
// ──────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found.' });
  }

  const sections = db.prepare(`
    SELECT id, heading, text, page, order_index
    FROM document_sections
    WHERE document_id = ?
    ORDER BY order_index ASC
  `).all(req.params.id);

  res.json({ document: doc, sections });
});

module.exports = { router, ingestDocument };
