const { callLLM } = require('../llmClient');

const ALLOWED_DOC_TYPES = [
  'zoning_proposal',
  'budget',
  'council_agenda',
  'public_notice',
  'infrastructure_plan',
  'environmental_review'
];

const SYSTEM_INSTRUCTION = `You are the Document Agent of CivicLens AI.
Your role is to analyze a municipal document's raw text and its pre-extracted sections, classify its document type, extract key dates, and identify mentioned entities.

STRICT OUTPUT CONTRACT:
You must output ONLY a valid JSON object matching this EXACT schema:
{
  "doc_type": "zoning_proposal | budget | council_agenda | public_notice | infrastructure_plan | environmental_review",
  "title": "string",
  "summary": "2-3 sentence plain-English summary",
  "sections": [
    {
      "id": "exact section id from input",
      "heading": "section heading",
      "text": "section text",
      "page": 1
    }
  ],
  "key_dates": [
    {
      "label": "name of meeting/deadline",
      "date": "YYYY-MM-DD or null"
    }
  ],
  "entities": {
    "location_mentions": ["string"],
    "departments": ["string"]
  }
}

CRITICAL RULES:
1. The "sections" array MUST strictly reference the real document sections provided in the input (with their exact ids and text). DO NOT invent new section content or IDs.
2. "doc_type" must be exactly one of: zoning_proposal, budget, council_agenda, public_notice, infrastructure_plan, environmental_review.
3. Summary must be 2-3 concise, plain-English sentences.
4. Do NOT output any additional keys outside this schema.`;

async function runDocumentAgent({ document, sections }) {
  const sectionsPayload = sections.map(s => ({
    id: s.id,
    heading: s.heading || 'Untitled Section',
    text: s.text,
    page: s.page || 1,
    order_index: s.order_index
  }));

  const maxPromptSections = 35;
  const promptSections = sections.length > maxPromptSections
    ? sections
        .filter(s => s.text && s.text.length > 50)
        .slice(0, maxPromptSections)
        .map(s => ({
          id: s.id,
          heading: s.heading || 'Section',
          text_preview: s.text.substring(0, 300) + (s.text.length > 300 ? '…' : ''),
          page: s.page || 1,
        }))
    : sectionsPayload;

  const userPrompt = `Analyze the following municipal document and its sections:

DOCUMENT METADATA:
Title: ${document.title}
Original Filename: ${document.original_filename}
Reported Type: ${document.doc_type}

SECTIONS IN DATABASE (${sectionsPayload.length} total sections, showing sample of ${promptSections.length}):
${JSON.stringify(promptSections, null, 2)}

RAW TEXT EXCERPT (first 4000 characters):
${document.raw_text.substring(0, 4000)}

Respond strictly in JSON adhering to the exact schema.`;

  const rawResult = await callLLM({
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt,
    stage: 'document',
    document,
    sections,
  });

  // Strict schema validation and post-processing
  const docType = ALLOWED_DOC_TYPES.includes(rawResult.doc_type)
    ? rawResult.doc_type
    : (ALLOWED_DOC_TYPES.includes(document.doc_type) ? document.doc_type : 'zoning_proposal');

  const realSectionsMap = new Map(sections.map(s => [s.id, s]));

  // Ensure sections map strictly to real DB sections
  let sanitizedSections = [];
  if (Array.isArray(rawResult.sections) && rawResult.sections.length > 0) {
    for (const sec of rawResult.sections) {
      if (realSectionsMap.has(sec.id)) {
        const realSec = realSectionsMap.get(sec.id);
        sanitizedSections.push({
          id: realSec.id,
          heading: sec.heading || realSec.heading || 'Section',
          text: realSec.text,
          page: realSec.page || sec.page || 1,
        });
      }
    }
  }

  // Fallback if model omitted or mangled section IDs
  if (sanitizedSections.length === 0) {
    sanitizedSections = sections.map(s => ({
      id: s.id,
      heading: s.heading || 'Section',
      text: s.text,
      page: s.page || 1,
    }));
  }

  const keyDates = Array.isArray(rawResult.key_dates)
    ? rawResult.key_dates.map(kd => ({
        label: String(kd.label || 'Date'),
        date: typeof kd.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(kd.date) ? kd.date : null
      }))
    : [];

  const entities = {
    location_mentions: Array.isArray(rawResult.entities?.location_mentions)
      ? rawResult.entities.location_mentions.map(String)
      : [],
    departments: Array.isArray(rawResult.entities?.departments)
      ? rawResult.entities.departments.map(String)
      : []
  };

  return {
    doc_type: docType,
    title: String(rawResult.title || document.title),
    summary: String(rawResult.summary || 'Summary not provided.'),
    sections: sanitizedSections,
    key_dates: keyDates,
    entities: entities,
  };
}

module.exports = { runDocumentAgent };
