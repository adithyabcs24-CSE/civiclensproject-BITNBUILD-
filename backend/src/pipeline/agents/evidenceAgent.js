const { callLLM } = require('../llmClient');

const SYSTEM_INSTRUCTION = `You are the Evidence Agent of CivicLens AI, the critical anti-hallucination gate.
Your job is to audit and verify every policy and impact statement against the source text sections from Stage 1.

VERIFICATION RULES FOR EVERY ITEM:
1. DIRECTLY GROUNDED: If the claim is directly supported by the source text:
   - Retain the item with its original confidence.
   - Set "inferred": false.
   - Attach evidence: {"section_id": "real_section_id", "excerpt_location": "e.g. Section 2, paragraph 1", "grounded": true}.
2. REASONABLE INFERENCE: If the claim is a logical or contextual inference but not explicitly stated:
   - Downgrade "confidence" to "low".
   - Set "inferred": true.
   - Attach evidence: {"section_id": "real_section_id", "excerpt_location": "paraphrased location pointer", "grounded": true}.
3. UNGROUNDED / FABRICATED / EXAGGERATED: If the claim is not supported by the document text:
   - DROP IT ENTIRELY from the output. Do NOT pass it downstream.

CRITICAL INSTRUCTIONS:
- In "excerpt_location", paraphrase or reference the location (e.g. "Page 2, Section 2.3", "Agenda Item 2"). NEVER reproduce large blocks of verbatim source text.
- You must output ONLY valid JSON.

STRICT OUTPUT CONTRACT:
{
  "policies": [
    {
      "id": "pol_1",
      "name": "string",
      "description": "string",
      "source_section_id": "must match a real section id",
      "confidence": "high | medium | low",
      "inferred": false,
      "evidence": {
        "section_id": "real section id",
        "excerpt_location": "e.g. Section 2.3, paragraph 2",
        "grounded": true
      }
    }
  ],
  "impacts": [
    {
      "id": "imp_1",
      "category": "traffic | environment | cost | noise | safety | housing | other",
      "statement": "string",
      "based_on_policy_ids": ["pol_1"],
      "confidence": "high | medium | low",
      "inferred": false,
      "evidence": {
        "section_id": "real section id",
        "excerpt_location": "e.g. Section 3.1",
        "grounded": true
      }
    }
  ]
}`;

async function runEvidenceAgent({ document, sections, stage1Output, stage2Output, stage3Output }) {
  const validSectionIds = new Set(stage1Output.sections.map(s => s.id));

  const policySecIds = new Set(stage2Output.policies.map(p => p.source_section_id));
  const maxPromptSections = 30;
  const promptSections = stage1Output.sections.length > maxPromptSections
    ? stage1Output.sections
        .filter(s => policySecIds.has(s.id) || (s.text && s.text.length > 100))
        .slice(0, maxPromptSections)
        .map(s => ({
          id: s.id,
          heading: s.heading,
          text: s.text.substring(0, 800)
        }))
    : stage1Output.sections.map(s => ({ id: s.id, heading: s.heading, text: s.text.substring(0, 1500) }));

  const userPrompt = `Audit the following policies and impacts against the source text sections:

SOURCE SECTIONS (${stage1Output.sections.length} total, showing ${promptSections.length} candidate sections):
${JSON.stringify(promptSections, null, 2)}

POLICIES TO AUDIT:
${JSON.stringify(stage2Output.policies, null, 2)}

IMPACTS TO AUDIT:
${JSON.stringify(stage3Output.impacts, null, 2)}

Verify grounding. Drop any ungrounded items. Mark inferences as inferred: true with confidence downgraded to "low". Return JSON adhering to the exact schema.`;

  const rawResult = await callLLM({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    stage: 'evidence',
    document,
    sections,
    stage1Output,
    stage2Output,
    stage3Output,
  });

  if (!rawResult || !Array.isArray(rawResult.policies) || !Array.isArray(rawResult.impacts)) {
    throw new Error('Evidence Agent did not return valid policies and impacts arrays.');
  }

  // Anti-hallucination post-processor and safety gate
  const verifiedPolicies = [];
  for (const pol of rawResult.policies) {
    // Must have a real section ID
    const secId = pol.evidence?.section_id || pol.source_section_id;
    if (!secId || !validSectionIds.has(secId)) {
      // Drop ungrounded policy
      continue;
    }

    const isInferred = Boolean(pol.inferred);
    const confidence = isInferred ? 'low' : (['high', 'medium', 'low'].includes(pol.confidence?.toLowerCase()) ? pol.confidence.toLowerCase() : 'medium');

    verifiedPolicies.push({
      id: pol.id,
      name: pol.name,
      description: pol.description,
      source_section_id: secId,
      confidence: confidence,
      inferred: isInferred,
      evidence: {
        section_id: secId,
        excerpt_location: String(pol.evidence?.excerpt_location || 'Source document text'),
        grounded: true,
      },
    });
  }

  const verifiedPolicyIds = new Set(verifiedPolicies.map(p => p.id));
  const verifiedImpacts = [];

  for (const imp of rawResult.impacts) {
    // If evidence explicitly marked grounded as false or missing, drop it
    if (imp.evidence && imp.evidence.grounded === false) {
      continue;
    }

    // Must be based on retained policies
    const validBasedPolicies = Array.isArray(imp.based_on_policy_ids)
      ? imp.based_on_policy_ids.filter(pid => verifiedPolicyIds.has(pid))
      : [];

    if (validBasedPolicies.length === 0 && verifiedPolicies.length > 0) {
      // Drop impact if its supporting policies were dropped
      continue;
    }

    const secId = imp.evidence?.section_id && validSectionIds.has(imp.evidence.section_id)
      ? imp.evidence.section_id
      : (stage1Output.sections[0]?.id || '');

    const isInferred = Boolean(imp.inferred);
    const confidence = isInferred ? 'low' : (['high', 'medium', 'low'].includes(imp.confidence?.toLowerCase()) ? imp.confidence.toLowerCase() : 'medium');

    verifiedImpacts.push({
      id: imp.id,
      category: imp.category || 'other',
      statement: imp.statement,
      based_on_policy_ids: validBasedPolicies.length > 0 ? validBasedPolicies : [verifiedPolicies[0].id],
      confidence: confidence,
      inferred: isInferred,
      evidence: {
        section_id: secId,
        excerpt_location: String(imp.evidence?.excerpt_location || 'Source section context'),
        grounded: true,
      },
    });
  }

  return {
    policies: verifiedPolicies,
    impacts: verifiedImpacts,
  };
}

module.exports = { runEvidenceAgent };
