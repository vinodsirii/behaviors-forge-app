/*
 * Small shared helpers used by the individual behaviours.
 *
 * Keeping these in one place means every behaviour reads field values the same way,
 * no matter which shape Jira hands them to us in (plain string, object, array, ADF).
 */

// Default Jira priority ids. Priority values sometimes arrive as just an id ("1"),
// so this lets us translate them back to a name. Sites with a custom priority
// scheme may use different ids - adjust here if needed.
export const PRIORITY_IDS = { Highest: '1', High: '2', Medium: '3', Low: '4', Lowest: '5' };
const PRIORITY_NAMES_BY_ID = Object.fromEntries(Object.entries(PRIORITY_IDS).map(([name, id]) => [id, name]));

// Returns the priority *name* (e.g. "High") from whatever value shape the field returns.
export function priorityNameOf(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return PRIORITY_NAMES_BY_ID[value] || value;
  return value.name || PRIORITY_NAMES_BY_ID[value.id];
}

// Returns the labels as an array of lower-case strings. The Labels field value is
// normally an array of strings, but we also accept objects just in case.
export function labelsOf(value) {
  if (!Array.isArray(value)) return [];
  return value.map((label) => String(typeof label === 'string' ? label : label?.label || label?.name || '').toLowerCase());
}

// True when a value (ADF document or plain string) contains any visible text.
export function hasText(node) {
  if (!node) return false;
  if (typeof node === 'string') return node.trim().length > 0;
  if (node.type === 'text') return (node.text || '').trim().length > 0;
  return Array.isArray(node.content) && node.content.some(hasText);
}

// Remembers each field's original label the first time we see it, so a behaviour can
// rename a field (e.g. "Components" -> "Affected service") and later put it back.
// Reading the original name (instead of hard-coding "Components") keeps this working
// on sites where Jira is shown in another language.
const originalNames = new Map();

export function renameField(field, newName) {
  if (!field) return;
  const id = field.getId();
  if (!originalNames.has(id)) originalNames.set(id, field.getName());
  field.setName(newName || originalNames.get(id));
}
