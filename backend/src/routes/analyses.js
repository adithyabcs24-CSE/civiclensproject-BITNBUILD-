const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { runPipeline } = require('../pipeline/orchestrator');
const { buildMilestonesForAnalysis, formatPlainTextTimeline } = require('./timeline');
const { buildNeighborhoodImpacts } = require('./neighborhoodImpacts');

/**
 * Safely parse a JSON column string, or return null.
 */
function parseJsonColumn(val) {
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch (_e) {
    return val;
  }
}

// ──────────────────────────────────────────────
// POST /api/analyses
// Body: { document_id, locality }
// Optional query: ?wait=true (waits for pipeline to complete before responding)
// ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body. JSON object expected.' });
    }

    const { document_id, locality } = req.body;

    // Strict validation for document_id
    if (!document_id || typeof document_id !== 'string' || !document_id.trim()) {
      return res.status(400).json({
        error: 'Missing or invalid required field: document_id. Must be a non-empty string.'
      });
    }

    // Strict validation for locality
    if (!locality || typeof locality !== 'string' || !locality.trim()) {
      return res.status(400).json({
        error: 'Missing or invalid required field: locality. Must be a non-empty string.'
      });
    }

    const cleanDocId = document_id.trim();
    const cleanLocality = locality.trim();

    const doc = db.prepare('SELECT id, title FROM documents WHERE id = ?').get(cleanDocId);
    if (!doc) {
      return res.status(404).json({ error: `Document ${cleanDocId} not found.` });
    }

    const analysisId = uuidv4();
    const now = new Date().toISOString();
    const initialMode = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'gemini' : 'offline';

    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, mode, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(analysisId, cleanDocId, cleanLocality, initialMode, now);

    // If caller requested synchronous wait (useful for tests and automation)
    if (req.query.wait === 'true' || req.query.sync === 'true') {
      try {
        const pipelineResult = await runPipeline(analysisId);
        const updated = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
        const resolvedMode = pipelineResult?.mode || updated?.mode || initialMode;
        return res.status(201).json({
          id: updated.id,
          document_id: updated.document_id,
          locality: updated.locality,
          status: updated.status,
          mode: resolvedMode,
          created_at: updated.created_at,
          document_json: parseJsonColumn(updated.document_json),
          policy_json: parseJsonColumn(updated.policy_json),
          impact_json: parseJsonColumn(updated.impact_json),
          evidence_json: parseJsonColumn(updated.evidence_json),
          report_json: parseJsonColumn(updated.report_json),
        });
      } catch (pipelineErr) {
        const failed = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
        return res.status(500).json({
          error: pipelineErr.message,
          analysis: failed,
        });
      }
    }

    // Default: kick off pipeline asynchronously
    setImmediate(() => {
      runPipeline(analysisId).catch(err => {
        console.error(`Async pipeline execution error for analysis ${analysisId}:`, err);
      });
    });

    res.status(201).json({
      id: analysisId,
      document_id: cleanDocId,
      locality: cleanLocality,
      status: 'pending',
      mode: initialMode,
      created_at: now,
    });
  } catch (err) {
    console.error('POST /api/analyses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/analyses
// List all analyses
// ──────────────────────────────────────────────
router.get('/', (_req, res) => {
  try {
    const analyses = db.prepare(`
      SELECT a.id, a.document_id, a.locality, a.status, a.mode, a.created_at,
             d.title AS document_title, d.doc_type AS document_type
      FROM analyses a
      LEFT JOIN documents d ON d.id = a.document_id
      ORDER BY a.created_at DESC
    `).all();

    res.json({ analyses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/analyses/:id/report
// Returns report_json once status is complete (200),
// 202 if still in progress, 500 if failed or silent error.
// ──────────────────────────────────────────────
router.get('/:id/report', (req, res) => {
  try {
    const row = db.prepare('SELECT id, document_id, status, mode, report_json, locality FROM analyses WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    // Explicit failure status
    if (row.status === 'failed' || row.status === 'error') {
      return res.status(500).json({
        status: 'failed',
        error: 'The analysis pipeline failed to complete the report.',
      });
    }

    // In-progress stages return 202 Accepted
    const inProgressStages = ['pending', 'document', 'policy', 'impact', 'evidence', 'report'];
    if (inProgressStages.includes(row.status)) {
      return res.status(202).json({
        status: row.status,
        mode: row.mode || 'offline',
        message: `Report is not ready yet. Current stage: ${row.status}`,
        report: null,
      });
    }

    // Complete state: verify report_json actually exists and parsed cleanly
    if (row.status === 'complete') {
      if (!row.report_json) {
        // Silent failure detection: status was complete but report_json is missing
        return res.status(500).json({
          status: 'failed',
          error: 'The analysis completed with an internal error: report_json is missing.',
        });
      }

      const reportData = parseJsonColumn(row.report_json);
      if (!reportData || typeof reportData !== 'object') {
        return res.status(500).json({
          status: 'failed',
          error: 'The analysis completed with an internal error: malformed report_json payload.',
        });
      }

      const resolvedMode = row.mode || reportData.mode || 'offline';
      return res.status(200).json({
        status: 'complete',
        mode: resolvedMode,
        document_id: row.document_id,
        ...reportData,
        report: {
          ...reportData,
          mode: resolvedMode,
          document_id: row.document_id,
        },
      });
    }

    // Unrecognized or corrupt status -> 500
    return res.status(500).json({
      status: 'failed',
      error: `Analysis is in an invalid or unrecognized state: ${row.status}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/analyses/:id/evidence/:sectionId
// Returns the real section text, heading, and page number for citation inspection
// ──────────────────────────────────────────────
router.get('/:id/evidence/:sectionId', (req, res) => {
  try {
    const analysis = db.prepare('SELECT document_id FROM analyses WHERE id = ?').get(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    const section = db.prepare(`
      SELECT id, document_id, heading, text, page, order_index
      FROM document_sections
      WHERE id = ? AND document_id = ?
    `).get(req.params.sectionId, analysis.document_id);

    if (!section) {
      return res.status(404).json({ error: `Section ${req.params.sectionId} not found for this document.` });
    }

    res.json({
      id: section.id,
      document_id: section.document_id,
      heading: section.heading,
      text: section.text,
      page: section.page,
      order_index: section.order_index,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/analyses/:id
// Return current status and populated JSON stages
// ──────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    res.json({
      id: row.id,
      document_id: row.document_id,
      locality: row.locality,
      status: row.status,
      mode: row.mode || 'offline',
      created_at: row.created_at,
      document_json: parseJsonColumn(row.document_json),
      policy_json: parseJsonColumn(row.policy_json),
      impact_json: parseJsonColumn(row.impact_json),
      evidence_json: parseJsonColumn(row.evidence_json),
      report_json: parseJsonColumn(row.report_json),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/analyses/:id/ask
// Citizen Q&A on completed analysis
// ──────────────────────────────────────────────
const { answerPolicyQuestion } = require('../pipeline/llmClient');

router.post('/:id/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Please provide a valid question.' });
    }

    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(req.params.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(analysis.document_id);
    if (!doc) {
      return res.status(404).json({ error: 'Associated document not found.' });
    }

    const sections = db.prepare(`
      SELECT id, heading, text, page, order_index
      FROM document_sections
      WHERE document_id = ?
      ORDER BY order_index ASC
    `).all(analysis.document_id);

    const answerPayload = await answerPolicyQuestion({
      document: doc,
      sections,
      question: String(question).trim(),
      locality: analysis.locality || 'General / Ward 4',
      analysis
    });

    res.json(answerPayload);
  } catch (err) {
    console.error('Analysis Q&A error:', err);
    res.status(500).json({ error: err.message || 'Failed to answer policy question.' });
  }
});

// ──────────────────────────────────────────────
// GET /api/analyses/:id/timeline
// Returns chronological milestones and plain text format
// ──────────────────────────────────────────────
router.get('/:id/timeline', (req, res) => {
  try {
    const { id } = req.params;

    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(analysis.document_id);
    const sections = db.prepare('SELECT * FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(analysis.document_id);

    const milestones = buildMilestonesForAnalysis(analysis, doc, sections);
    const plainText = formatPlainTextTimeline(milestones);

    res.json({
      analysis_id: id,
      document_id: analysis.document_id,
      project_title: doc?.title || 'Civic Document',
      location: analysis.locality,
      milestones_count: milestones.length,
      plain_text: plainText,
      milestones
    });
  } catch (err) {
    console.error('GET /api/analyses/:id/timeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/analyses/:id/neighborhood-impacts
// Returns 6-dimension infrastructure impact assessment
// ──────────────────────────────────────────────
router.get('/:id/neighborhood-impacts', (req, res) => {
  try {
    const { id } = req.params;

    const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(id);
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(analysis.document_id);
    const sections = db.prepare('SELECT * FROM document_sections WHERE document_id = ? ORDER BY order_index ASC').all(analysis.document_id);

    const assessment = buildNeighborhoodImpacts(analysis, doc, sections);
    res.json(assessment);
  } catch (err) {
    console.error('GET /api/analyses/:id/neighborhood-impacts error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
