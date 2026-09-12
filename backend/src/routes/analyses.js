const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { runPipeline } = require('../pipeline/orchestrator');

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
    const { document_id, locality } = req.body;

    if (!document_id) {
      return res.status(400).json({ error: 'Missing required field: document_id' });
    }

    const doc = db.prepare('SELECT id, title FROM documents WHERE id = ?').get(document_id);
    if (!doc) {
      return res.status(404).json({ error: `Document ${document_id} not found.` });
    }

    const analysisId = uuidv4();
    const resolvedLocality = (locality && String(locality).trim()) || 'General / Ward 4';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO analyses (id, document_id, locality, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(analysisId, document_id, resolvedLocality, now);

    // If caller requested synchronous wait (useful for tests and automation)
    if (req.query.wait === 'true' || req.query.sync === 'true') {
      try {
        await runPipeline(analysisId);
        const updated = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
        return res.status(201).json({
          id: updated.id,
          document_id: updated.document_id,
          locality: updated.locality,
          status: updated.status,
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
      document_id,
      locality: resolvedLocality,
      status: 'pending',
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
      SELECT a.id, a.document_id, a.locality, a.status, a.created_at,
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
// Returns report_json once status is complete,
// 202 if still in progress, 500/failed state if failed.
// ──────────────────────────────────────────────
router.get('/:id/report', (req, res) => {
  try {
    const row = db.prepare('SELECT id, status, report_json, locality FROM analyses WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Analysis not found.' });
    }

    if (row.status === 'failed') {
      return res.status(500).json({
        status: 'failed',
        error: 'The analysis pipeline failed to complete the report.',
      });
    }

    if (row.status !== 'complete') {
      return res.status(202).json({
        status: row.status,
        message: `Report is not ready yet. Current stage: ${row.status}`,
        report: null,
      });
    }

    const reportData = parseJsonColumn(row.report_json);
    return res.status(200).json({
      status: 'complete',
      ...reportData,
      report: reportData,
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

module.exports = router;
