import api, { route } from '@forge/api';

/*
 * A UI modification only runs where it has a "context" (project + issue type + view).
 * This function makes sure our single UI modification covers the Create issue dialog
 * (viewType "GIC") for every issue type in every project on the site.
 *
 * It runs on install, on upgrade, and once a day so newly created projects are picked up.
 * It is idempotent: it updates the existing UI modification instead of creating duplicates.
 */

const UI_MODIFICATION_NAME = 'basic-behaviors';

const jira = async (path, options = {}) => {
  const res = await api.asApp().requestJira(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${options.method || 'GET'} failed: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

// Collects all pages of a paginated Jira REST endpoint.
async function getAllPages(buildRoute) {
  const values = [];
  for (let startAt = 0; ; startAt += 50) {
    const page = await jira(buildRoute(startAt));
    values.push(...page.values);
    if (page.isLast || page.values.length === 0) return values;
  }
}

async function buildContexts() {
  const projects = await getAllPages(
    (startAt) => route`/rest/api/3/project/search?expand=issueTypes&maxResults=50&startAt=${startAt}`,
  );
  return projects.flatMap((project) =>
    (project.issueTypes || []).map((issueType) => ({
      projectId: project.id,
      issueTypeId: issueType.id,
      viewType: 'GIC',
    })),
  );
}

async function findExisting() {
  const all = await getAllPages(
    (startAt) => route`/rest/api/3/uiModifications?expand=contexts&maxResults=50&startAt=${startAt}`,
  );
  return all.find((uim) => uim.name === UI_MODIFICATION_NAME);
}

export async function syncContexts() {
  try {
    const contexts = await buildContexts();
    const existing = await findExisting();

    if (existing) {
      await jira(route`/rest/api/3/uiModifications/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ contexts }),
      });
      console.log(`Updated UI modification ${existing.id} with ${contexts.length} contexts`);
    } else {
      const created = await jira(route`/rest/api/3/uiModifications`, {
        method: 'POST',
        body: JSON.stringify({
          name: UI_MODIFICATION_NAME,
          description: 'Basic behaviors for the Create issue dialog',
          contexts,
        }),
      });
      console.log(`Created UI modification ${created.id} with ${contexts.length} contexts`);
    }
  } catch (e) {
    console.error('Failed to sync UI modification contexts', e);
  }
}
