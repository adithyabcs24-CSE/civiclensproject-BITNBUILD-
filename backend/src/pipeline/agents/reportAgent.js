const { callLLM } = require('../llmClient');

const SYSTEM_INSTRUCTION = `You are the Citizen Report Agent of CivicLens AI.
Your role is to translate complex municipal actions into an accessible, evidence-grounded citizen impact report.

STRICT OUTPUT CONTRACT:
You must output ONLY a valid JSON object matching this EXACT schema:
{
  "project_title": "string",
  "location": "string (the locality)",
  "what_is_happening": "string",
  "why_it_matters": "string",
  "who_may_be_affected": "string",
  "important_dates": [
    {
      "label": "string",
      "date": "string"
    }
  ],
  "impacts": [ /* pass through the grounded impacts array from input, unchanged */ ],
  "policies": [ /* pass through the grounded policies array from input, unchanged */ ],
  "suggested_questions": ["string", "string", "string"],
  "citizen_actions": ["string", "string"]
}

CRITICAL RULES:
1. HARD RULE: You may ONLY use the policies and impacts provided in the input that already passed through the Evidence Agent. DO NOT introduce new policy or impact claims of your own.
2. DO NOT re-derive or re-word the impacts or policies in a way that loses their evidence anchors. Pass through the exact items from the input.
3. If the input contains zero or minimal grounded impacts/policies (such as a brief notice or thin agenda), you MUST state this plainly (e.g. why_it_matters: "This document did not contain enough detail to identify specific local impacts; see the original document for full context.") rather than inventing content to fill the report.
4. "suggested_questions" must provide 2 to 4 actionable, incisive questions citizens can ask officials.
5. "citizen_actions" must list concrete steps (public hearings, comment deadlines, contact info).
6. Do NOT output any additional keys outside this schema.`;

async function runReportAgent({ document, sections, locality, stage1Output, evidenceOutput }) {
  const resolvedLocality = locality || 'Target Locality';

  const userPrompt = `Synthesize a citizen impact report for locality: "${resolvedLocality}".

DOCUMENT METADATA:
Title: ${stage1Output.title}
Doc Type: ${stage1Output.doc_type}
Summary: ${stage1Output.summary}
Key Dates: ${JSON.stringify(stage1Output.key_dates || [])}
Entities: ${JSON.stringify(stage1Output.entities || {})}

VERIFIED POLICIES FROM EVIDENCE AGENT:
${JSON.stringify(evidenceOutput.policies, null, 2)}

VERIFIED IMPACTS FROM EVIDENCE AGENT:
${JSON.stringify(evidenceOutput.impacts, null, 2)}

Compose the citizen report strictly conforming to the JSON schema.`;

  const rawResult = await callLLM({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    stage: 'report',
    document,
    sections,
    locality: resolvedLocality,
    stage1Output,
    evidenceOutput,
  });

  // Extract dates from stage1 if not cleanly provided by model
  let importantDates = [];
  if (Array.isArray(rawResult.important_dates) && rawResult.important_dates.length > 0) {
    importantDates = rawResult.important_dates.map(d => ({
      label: String(d.label || 'Event'),
      date: String(d.date || 'TBD'),
    }));
  } else if (Array.isArray(stage1Output.key_dates)) {
    importantDates = stage1Output.key_dates.map(d => ({
      label: String(d.label || 'Event'),
      date: String(d.date || 'TBD'),
    }));
  }

  // Handle thin or empty document inputs honestly
  const hasGroundedImpacts = evidenceOutput.impacts && evidenceOutput.impacts.length > 0;
  let whyItMatters = String(rawResult.why_it_matters || '');
  if (!hasGroundedImpacts) {
    whyItMatters = 'This document did not contain enough detail to identify specific local impacts; see the original document for full context.';
  }

  // Strict enforcement: Pass through the grounded policies and impacts from Evidence Agent UNCHANGED
  return {
    project_title: String(rawResult.project_title || stage1Output.title),
    location: resolvedLocality,
    what_is_happening: String(rawResult.what_is_happening || stage1Output.summary),
    why_it_matters: whyItMatters,
    who_may_be_affected: String(rawResult.who_may_be_affected || `Residents and community members in ${resolvedLocality}.`),
    important_dates: importantDates,
    impacts: evidenceOutput.impacts, // Intact passthrough preserving evidence anchors
    policies: evidenceOutput.policies, // Intact passthrough preserving evidence anchors
    suggested_questions: Array.isArray(rawResult.suggested_questions) && rawResult.suggested_questions.length > 0
      ? rawResult.suggested_questions.map(String)
      : [
          'How will the city measure the direct community impacts of this proposal?',
          'What public review opportunities remain before final adoption?'
        ],
    citizen_actions: Array.isArray(rawResult.citizen_actions) && rawResult.citizen_actions.length > 0
      ? rawResult.citizen_actions.map(String)
      : [
          'Submit written comments to the municipal clerk.',
          'Attend upcoming town council or planning board public sessions.'
        ],
  };
}

module.exports = { runReportAgent };
