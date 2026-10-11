// Pure validation logic: no Forge or network calls, so it is trivial to unit test.

/**
 * Returns true when a Jira field has a meaningful value.
 * Treats null/undefined, blank strings, empty arrays and empty ADF docs as "missing".
 */
export function isFieldPresent(fields, fieldId) {
  if (!fields || typeof fields !== 'object') return false;
  const value = fields[fieldId];
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  // Rich-text fields (e.g. description) come back as ADF: { type: 'doc', content: [...] }
  if (typeof value === 'object' && value.type === 'doc') {
    return Array.isArray(value.content) && value.content.length > 0;
  }
  return true;
}

/**
 * Checks that every field in fieldIds is present.
 * Returns the shape Jira workflow validators expect: { result, errorMessage? }.
 */
export function validateRequiredFields(fields, fieldIds) {
  const missing = fieldIds.filter((id) => !isFieldPresent(fields, id));
  if (missing.length === 0) return { result: true };
  return { result: false, errorMessage: `Required field(s) missing: ${missing.join(', ')}` };
}

/** Checks that the trimmed summary is at least `min` characters long. */
export function validateSummaryLength(summary, min) {
  const length = typeof summary === 'string' ? summary.trim().length : 0;
  if (length >= min) return { result: true };
  return {
    result: false,
    errorMessage: `Summary must be at least ${min} characters (currently ${length}).`,
  };
}
