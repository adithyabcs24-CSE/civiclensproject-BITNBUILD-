const { callLLM } = require('../llmClient');

const ALLOWED_CATEGORIES = [
  'traffic',
  'environment',
  'cost',
  'noise',
  'safety',
  'housing',
  'other'
];

const SYSTEM_INSTRUCTION = `You are the Impact Agent of CivicLens AI.
Your role is to evaluate how the identified policies may impact residents, infrastructure, and services in the specified locality.

STRICT OUTPUT CONTRACT:
You must output ONLY a valid JSON object matching this EXACT schema:
{
  "locality": "target locality string",
  "impacts": [
    {
      "id": "imp_1",
      "category": "traffic | environment | cost | noise | safety | housing | other",
      "statement": "plain-English, hedged language ('may increase', 'could affect') — never stated as certain fact unless the source document states it directly",
      "based_on_policy_ids": ["pol_1"],
      "confidence": "high | medium | low"
    }
  ]
}

CRITICAL RULES:
1. Category MUST be one of: "traffic", "environment", "cost", "noise", "safety", "housing", "other".
2. "statement" MUST use hedged, probabilistic phrasing (e.g., "may increase", "could affect", "potential disruption") unless the document makes an absolute factual commitment.
3. Every impact MUST cite one or more real policy IDs from the provided policies in "based_on_policy_ids".
4. Confidence must be one of: "high", "medium", "low".
5. Do NOT output any additional keys outside this schema.`;

async function runImpactAgent({ document, sections, locality, stage1Output, stage2Output }) {
  const resolvedLocality = locality || 'Target Locality';
  const validPolicyIds = new Set(stage2Output.policies.map(p => p.id));

  const userPrompt = `Assess localized impacts for locality: "${resolvedLocality}".

DOCUMENT CONTEXT:
Title: ${stage1Output.title}
Document Type: ${stage1Output.doc_type}
Locations: ${JSON.stringify(stage1Output.entities?.location_mentions || [])}

EXTRACTED POLICIES:
${JSON.stringify(stage2Output.policies, null, 2)}

Provide the local impact assessment strictly in JSON adhering to the exact schema.`;

  const rawResult = await callLLM({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    stage: 'impact',
    document,
    sections,
    locality: resolvedLocality,
    stage1Output,
    stage2Output,
  });

  if (!rawResult || !Array.isArray(rawResult.impacts)) {
    throw new Error('Impact Agent did not return an "impacts" array.');
  }

  const sanitizedImpacts = [];
  let index = 1;

  for (const imp of rawResult.impacts) {
    // Validate based_on_policy_ids
    const validBasedPolicies = Array.isArray(imp.based_on_policy_ids)
      ? imp.based_on_policy_ids.filter(pid => validPolicyIds.has(pid))
      : [];

    if (validBasedPolicies.length === 0 && validPolicyIds.size > 0) {
      // If no valid policy is cited, drop the ungrounded impact
      continue;
    }

    const category = ALLOWED_CATEGORIES.includes(imp.category?.toLowerCase())
      ? imp.category.toLowerCase()
      : 'other';

    const confidence = ['high', 'medium', 'low'].includes(imp.confidence?.toLowerCase())
      ? imp.confidence.toLowerCase()
      : 'medium';

    sanitizedImpacts.push({
      id: `imp_${index++}`,
      category: category,
      statement: String(imp.statement || ''),
      based_on_policy_ids: validBasedPolicies.length > 0 ? validBasedPolicies : Array.from(validPolicyIds).slice(0, 1),
      confidence: confidence,
    });
  }

  return {
    locality: resolvedLocality,
    impacts: sanitizedImpacts,
  };
}

module.exports = { runImpactAgent };
