// Thin wrappers around the Jira REST API using the Forge runtime.
// asApp() is used because validators and post functions run without an
// interactive user; Jira invokes them on behalf of the app.
// `route` is a tagged template that safely URL-encodes interpolated values.
import api, { route } from '@forge/api';
import { textToAdf } from './adf.js';
import { LIB_VERSION } from './version.js';

// Throws a descriptive error for any non-2xx response so callers can log it.
async function ensureOk(response, action) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${action} failed with HTTP ${response.status}: ${body}`);
  }
}

/** Fetches an issue, optionally limited to specific fields. */
export async function getIssue(issueKeyOrId, fields = []) {
  const fieldList = fields.join(',');
  const path = fieldList
    ? route`/rest/api/3/issue/${issueKeyOrId}?fields=${fieldList}`
    : route`/rest/api/3/issue/${issueKeyOrId}`;
  const response = await api.asApp().requestJira(path, {
    headers: { Accept: 'application/json' },
  });
  await ensureOk(response, `getIssue(${issueKeyOrId})`);
  return response.json();
}

/** Adds a comment prefixed with the library version, e.g. "[forge-common v1.0.0] ...". */
export async function addComment(issueKeyOrId, text) {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKeyOrId}/comment`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: textToAdf(`[forge-common v${LIB_VERSION}] ${text}`) }),
  });
  await ensureOk(response, `addComment(${issueKeyOrId})`);
  return response.json();
}

/** Adds one label without removing existing labels (uses the "update" verb, not "fields"). */
export async function setLabel(issueKeyOrId, label) {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKeyOrId}`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ update: { labels: [{ add: label }] } }),
  });
  await ensureOk(response, `setLabel(${issueKeyOrId})`); // Jira returns 204 No Content
}
