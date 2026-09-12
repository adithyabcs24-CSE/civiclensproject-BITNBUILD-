const { v4: uuidv4 } = require('uuid');

/**
 * Split raw text into sections by detecting headings or falling back to
 * paragraph splitting. Returns an array of { heading, text, page, order_index }.
 *
 * Heading detection: lines that are ALL-CAPS, or match common title patterns
 * (numbered sections like "1.", "SECTION 1", "Article", etc.)
 */
function extractSections(rawText) {
  const sections = [];

  // Normalize line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  const headingPatterns = [
    /^#{1,6}\s+.+/,                          // Markdown headings
    /^[A-Z][A-Z\s\-:,]{4,}$/,                 // ALL CAPS lines (min 5 chars)
    /^[\[\(]?\s*(SECTION|ARTICLE|PART|CHAPTER|SCHEDULE)\s+[\dIVXA-Z-]+/i,
    /^[\[\(]?\s*\d+[-A-Za-z0-9]*\.\s+[A-Z]/,  // "1. Title", "108A. Levy...", "[295A. Obligation..."
    /^[\[\(]?\s*[IVXLCDM]+\.\s+[A-Z]/,        // Roman numeral sections
    /^[A-Z]\.\s+[A-Z].{2,}/,                 // "A. Something"
  ];

  function cleanHeading(heading) {
    if (!heading) return null;
    return heading
      .replace(/^[\[\(]+/, '')
      .replace(/[\]\)]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isHeading(line) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 140) return false;
    return headingPatterns.some(re => re.test(trimmed));
  }

  let currentHeading = null;
  let currentLines = [];
  let orderIdx = 0;

  function flushSection() {
    const sectionText = currentLines.join('\n').trim();
    if (sectionText.length > 20) {
      sections.push({
        id: uuidv4(),
        heading: currentHeading,
        text: sectionText,
        page: null,      // page-level extraction requires PDF metadata; set null here
        order_index: orderIdx++,
      });
    }
    currentLines = [];
  }

  for (const line of lines) {
    if (isHeading(line)) {
      flushSection();
      currentHeading = cleanHeading(line);
    } else {
      currentLines.push(line);
    }
  }
  flushSection(); // Flush remaining

  // If no sections were detected (no headings found), fall back to paragraphs
  if (sections.length === 0) {
    const paragraphs = text.split(/\n{2,}/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length > 20) {
        sections.push({
          id: uuidv4(),
          heading: null,
          text: trimmed,
          page: null,
          order_index: orderIdx++,
        });
      }
    }
  }

  return sections;
}

module.exports = { extractSections };
