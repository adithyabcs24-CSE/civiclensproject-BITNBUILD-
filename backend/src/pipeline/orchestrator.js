const db = require('../db');
const { runDocumentAgent } = require('./agents/documentAgent');
const { runPolicyAgent } = require('./agents/policyAgent');
const { runImpactAgent } = require('./agents/impactAgent');
const { runEvidenceAgent } = require('./agents/evidenceAgent');
const { runReportAgent } = require('./agents/reportAgent');

/**
 * Execute a pipeline stage with exactly one retry on failure.
 */
async function executeStageWithRetry(stageName, stageFn) {
  try {
    return await stageFn();
  } catch (firstError) {
    console.warn(`[Pipeline] Stage "${stageName}" failed on first attempt (${firstError.message}). Retrying once...`);
    try {
      return await stageFn();
    } catch (retryError) {
      console.error(`[Pipeline] Stage "${stageName}" retry also failed: ${retryError.message}`);
      throw retryError;
    }
  }
}

/**
 * Atomic stage updater with status guard:
 * Runs inside an SQLite transaction so that the DB row's `status` field
 * ONLY advances after its corresponding *_json column is fully written.
 * If the analysis was marked 'failed', throws to prevent stale/partial stage updates.
 */
const updateStageTransition = db.transaction((id, jsonColumn, jsonStr, nextStatus, mode = null) => {
  const current = db.prepare('SELECT status FROM analyses WHERE id = ?').get(id);
  if (!current) {
    throw new Error(`Analysis ${id} does not exist.`);
  }
  if (current.status === 'failed') {
    throw new Error(`Aborting transition: Analysis ${id} is already in failed status.`);
  }

  if (mode) {
    db.prepare(`
      UPDATE analyses
      SET ${jsonColumn} = ?, status = ?, mode = ?
      WHERE id = ?
    `).run(jsonStr, nextStatus, mode, id);
  } else {
    db.prepare(`
      UPDATE analyses
      SET ${jsonColumn} = ?, status = ?
      WHERE id = ?
    `).run(jsonStr, nextStatus, id);
  }
});

/**
 * Run Stages 1→5 in strict sequence for a given analysis_id.
 * Updates the analyses row in SQLite atomically after each stage completes.
 */
async function runPipeline(analysisId) {
  const analysis = db.prepare('SELECT * FROM analyses WHERE id = ?').get(analysisId);
  if (!analysis) {
    throw new Error(`Analysis with id ${analysisId} not found.`);
  }

  const { document_id, locality } = analysis;

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
  if (!document) {
    db.prepare("UPDATE analyses SET status = 'failed' WHERE id = ?").run(analysisId);
    throw new Error(`Document with id ${document_id} not found.`);
  }

  const sections = db.prepare(`
    SELECT id, heading, text, page, order_index
    FROM document_sections
    WHERE document_id = ?
    ORDER BY order_index ASC
  `).all(document_id);

  if (!sections || sections.length === 0) {
    db.prepare("UPDATE analyses SET status = 'failed' WHERE id = ?").run(analysisId);
    throw new Error(`No document_sections found for document ${document_id}.`);
  }

  let stage1Output = null;
  let stage2Output = null;
  let stage3Output = null;
  let stage4Output = null;
  let stage5Output = null;

  try {
    // ──────────────────────────────────────────────────
    // STAGE 1: Document Agent
    // ──────────────────────────────────────────────────
    stage1Output = await executeStageWithRetry('document', () =>
      runDocumentAgent({ document, sections })
    );
    updateStageTransition(analysisId, 'document_json', JSON.stringify(stage1Output), 'document');

    // ──────────────────────────────────────────────────
    // STAGE 2: Policy Agent
    // ──────────────────────────────────────────────────
    stage2Output = await executeStageWithRetry('policy', () =>
      runPolicyAgent({ document, sections, stage1Output })
    );
    updateStageTransition(analysisId, 'policy_json', JSON.stringify(stage2Output), 'policy');

    // ──────────────────────────────────────────────────
    // STAGE 3: Impact Agent
    // ──────────────────────────────────────────────────
    stage3Output = await executeStageWithRetry('impact', () =>
      runImpactAgent({ document, sections, locality, stage1Output, stage2Output })
    );
    updateStageTransition(analysisId, 'impact_json', JSON.stringify(stage3Output), 'impact');

    // ──────────────────────────────────────────────────
    // STAGE 4: Evidence Agent (Anti-hallucination gate)
    // ──────────────────────────────────────────────────
    stage4Output = await executeStageWithRetry('evidence', () =>
      runEvidenceAgent({ document, sections, stage1Output, stage2Output, stage3Output })
    );
    updateStageTransition(analysisId, 'evidence_json', JSON.stringify(stage4Output), 'evidence');

    // ──────────────────────────────────────────────────
    // STAGE 5: Citizen Report Agent
    // ──────────────────────────────────────────────────
    stage5Output = await executeStageWithRetry('report', () =>
      runReportAgent({
        document,
        sections,
        locality,
        stage1Output,
        evidenceOutput: stage4Output,
      })
    );

    const executionMode = stage5Output.mode || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'gemini' : 'offline');

    // Atomic completion: persist report_json, set execution mode, and advance status to 'complete' in one transaction
    updateStageTransition(analysisId, 'report_json', JSON.stringify(stage5Output), 'complete', executionMode);

    return {
      analysis_id: analysisId,
      status: 'complete',
      mode: executionMode,
      document_json: stage1Output,
      policy_json: stage2Output,
      impact_json: stage3Output,
      evidence_json: stage4Output,
      report_json: stage5Output,
    };
  } catch (pipelineErr) {
    console.error(`[Pipeline Failed for Analysis ${analysisId}]:`, pipelineErr);
    // Mark status as failed, keeping partial json columns intact
    db.prepare("UPDATE analyses SET status = 'failed' WHERE id = ?").run(analysisId);
    throw pipelineErr;
  }
}

module.exports = { runPipeline };
