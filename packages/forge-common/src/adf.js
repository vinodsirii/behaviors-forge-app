// Jira Cloud REST API v3 needs rich text (comments, descriptions) in
// Atlassian Document Format (ADF), not plain strings.

/** Converts plain text to an ADF document. Each line becomes one paragraph. */
export function textToAdf(text) {
  const safeText = text === null || text === undefined ? '' : String(text);
  const content = safeText.split(/\r?\n/).map((line) =>
    // ADF forbids empty text nodes, so blank lines become empty paragraphs.
    line.length > 0
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph', content: [] }
  );
  return { version: 1, type: 'doc', content };
}
