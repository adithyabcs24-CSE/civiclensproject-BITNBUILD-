const { callLLM } = require('../llmClient');

const SYSTEM_INSTRUCTION = `You are the Policy Agent of CivicLens AI.
Your role is to extract distinct municipal policies, regulatory decisions, zoning changes, or official actions from the structured document.

STRICT OUTPUT CONTRACT:
You must output ONLY a valid JSON object matching this EXACT schema:
{
  "policies": [
    {
      "id": "pol_1",
      "name": "concise policy title",
      "description": "plain-English explanation of the policy or action",
      "source_section_id": "must be a real id from the provided sections",
      "confidence": "high | medium | low"
    }
  ]
}

HARD RULES:
1. Every policy MUST cite a valid "source_section_id" matching one of the real section IDs in the input.
2. If you cannot ground a policy in an actual section, DROP it entirely. Do NOT fabricate or invent a section ID.
3. Use sequential IDs (pol_1, pol_2, ...).
4. Confidence must be one of: "high", "medium", "low".
5. Do NOT output any additional keys outside this schema.`;

async function runPolicyAgent({ document, sections, stage1Output }) {
  const validSectionIds = new Set(stage1Output.sections.map(s => s.id));

  const maxPromptSections = 35;
  const promptSections = stage1Output.sections.length > maxPromptSections
    ? stage1Output.sections
        .filter(s => s.text && s.text.length > 60)
        .slice(0, maxPromptSections)
        .map(s => ({
          id: s.id,
          heading: s.heading,
          text: s.text.substring(0, 600) + (s.text.length > 600 ? '…' : '')
        }))
    : stage1Output.sections.map(s => ({ id: s.id, heading: s.heading, text: s.text }));

  const userPrompt = `Extract policies from the following document analyzed in Stage 1:

DOCUMENT SUMMARY:
Title: ${stage1Output.title}
Doc Type: ${stage1Output.doc_type}
Summary: ${stage1Output.summary}

SECTIONS AVAILABLE FOR GROUNDING (${stage1Output.sections.length} total, showing ${promptSections.length} candidate sections):
${JSON.stringify(promptSections, null, 2)}

Identify all concrete policies. Ground every policy in a real section ID.`;

  const rawResult = await callLLM({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    stage: 'policy',
    document,
    sections,
    stage1Output,
  });

  if (!rawResult || !Array.isArray(rawResult.policies)) {
    throw new Error('Policy Agent did not return a "policies" array.');
  }

  // Enforce HARD RULE: drop any policy that is not grounded in a real section ID
  const groundedPolicies = [];
  let index = 1;

  for (const pol of rawResult.policies) {
    if (!pol.source_section_id || !validSectionIds.has(pol.source_section_id)) {
      // Hard rule: Drop ungrounded policy
      continue;
    }

    const confidence = ['high', 'medium', 'low'].includes(pol.confidence?.toLowerCase())
      ? pol.confidence.toLowerCase()
      : 'medium';

    groundedPolicies.push({
      id: `pol_${index++}`,
      name: String(pol.name || 'Unnamed Policy'),
      description: String(pol.description || ''),
      source_section_id: pol.source_section_id,
      confidence: confidence,
    });
  }

  return {
    policies: groundedPolicies,
  };
}

module.exports = { runPolicyAgent };
