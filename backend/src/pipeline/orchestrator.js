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
 * Run Stages 1→4 in strict sequence for a given analysis_id.
 * Updates the analyses row in SQLite after each stage completes.
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

    db.prepare(`
      UPDATE analyses
      SET document_json = ?, status = 'document'
      WHERE id = ?
    `).run(JSON.stringify(stage1Output), analysisId);

    // ──────────────────────────────────────────────────
    // STAGE 2: Policy Agent
    // ──────────────────────────────────────────────────
    stage2Output = await executeStageWithRetry('policy', () =>
      runPolicyAgent({ document, sections, stage1Output })
    );

    db.prepare(`
      UPDATE analyses
      SET policy_json = ?, status = 'policy'
      WHERE id = ?
    `).run(JSON.stringify(stage2Output), analysisId);

    // ──────────────────────────────────────────────────
    // STAGE 3: Impact Agent
    // ──────────────────────────────────────────────────
    stage3Output = await executeStageWithRetry('impact', () =>
      runImpactAgent({ document, sections, locality, stage1Output, stage2Output })
    );

    db.prepare(`
      UPDATE analyses
      SET impact_json = ?, status = 'impact'
      WHERE id = ?
    `).run(JSON.stringify(stage3Output), analysisId);

    // ──────────────────────────────────────────────────
    // STAGE 4: Evidence Agent (Anti-hallucination gate)
    // ──────────────────────────────────────────────────
    stage4Output = await executeStageWithRetry('evidence', () =>
      runEvidenceAgent({ document, sections, stage1Output, stage2Output, stage3Output })
    );

    db.prepare(`
      UPDATE analyses
      SET evidence_json = ?, status = 'evidence'
      WHERE id = ?
    `).run(JSON.stringify(stage4Output), analysisId);

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

    db.prepare(`
      UPDATE analyses
      SET report_json = ?, status = 'report'
      WHERE id = ?
    `).run(JSON.stringify(stage5Output), analysisId);

    // Final status transition to complete
    db.prepare(`
      UPDATE analyses
      SET status = 'complete'
      WHERE id = ?
    `).run(analysisId);

    return {
      analysis_id: analysisId,
      status: 'complete',
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
