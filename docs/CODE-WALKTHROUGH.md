# Code walkthrough

This page goes through every file in the repo:
- what each file does
- why it is written the way it is
- how it connects to the other files

Read [ARCHITECTURE.md](ARCHITECTURE.md) first for the big picture.

```
forge-apple/
├── .gitignore / .gitattributes
├── packages/forge-common/        the shared library
│   ├── package.json
│   ├── src/version.js
│   ├── src/validators.js
│   ├── src/adf.js
│   ├── src/jira.js
│   ├── src/index.js
│   └── test/*.test.js
├── apps/forge-apple-1/           manifest.yml · src/index.js · package.json
├── apps/forge-apple-2/           manifest.yml · src/index.js · package.json
└── scripts/                      pack-common.sh · deploy-all.sh
```

---

## Part 1: The shared library (`packages/forge-common`)

### `package.json`

```json
"name": "@vinod/forge-common",
"version": "1.0.0",
"type": "module",
"exports": { ".": "./src/index.js" },
"files": ["src"],
"peerDependencies": { "@forge/api": ">=4" },
"devDependencies": { "@forge/api": "^5.0.0", "jest": "^29.7.0" },
"scripts": { "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js" },
"jest": { "testEnvironment": "node", "transform": {} }
```

| Field | Meaning |
|---|---|
| `name` | What apps write in `import ... from '@vinod/forge-common'` |
| `version` | Becomes part of the tarball name. Must equal `LIB_VERSION` (a test enforces this) |
| `type: module` | Files use `import`/`export` (ES modules) |
| `exports` | The only entry point apps can import. Internal files stay private |
| `files` | Only `src/` goes into the tarball. Tests are not shipped |
| `peerDependencies` | "The app using me must provide `@forge/api`", so there is one copy per bundle |
| `devDependencies` | Needed only to run tests in this folder |
| `test` script | Jest needs `--experimental-vm-modules` to run native ES modules |
| `transform: {}` | Turns off Babel: the code runs as-is |

### `src/version.js`

```js
export const LIB_VERSION = '1.0.0';
```

This is the version the running code reports about itself. `addComment` puts it in every comment, so
you can see in Jira which library build an app is using. `test/version.test.js` fails if it differs
from `package.json`.

### `src/validators.js`: pure rules

These functions have **no side effects**: same input, same output, and no network calls. That makes them the easiest code to test and reuse.

**`isFieldPresent(fields, fieldId)`**: is this Jira field filled in?

```js
if (!fields || typeof fields !== 'object') return false;   // defensive: bad input = not present
const value = fields[fieldId];
if (value === null || value === undefined) return false;   // never set
if (typeof value === 'string') return value.trim().length > 0;   // "   " counts as empty
if (Array.isArray(value)) return value.length > 0;               // e.g. labels: []
if (typeof value === 'object' && value.type === 'doc') {         // rich text (ADF)
  return Array.isArray(value.content) && value.content.length > 0;
}
return true;                                                      // e.g. priority: { name: 'High' }
```

Jira returns different shapes for different field types. This one function hides those differences.

**`validateRequiredFields(fields, fieldIds)`**

```js
const missing = fieldIds.filter((id) => !isFieldPresent(fields, id));
if (missing.length === 0) return { result: true };
return { result: false, errorMessage: `Required field(s) missing: ${missing.join(', ')}` };
```

It lists **every** missing field, not just the first, so the user can fix them all at once.

**`validateSummaryLength(summary, min)`**

```js
const length = typeof summary === 'string' ? summary.trim().length : 0;
if (length >= min) return { result: true };
return { result: false, errorMessage: `Summary must be at least ${min} characters (currently ${length}).` };
```

Both validators return `{ result, errorMessage? }`, which is **exactly the object a Jira Forge validator must return**.
App handlers can therefore `return` the library result directly.

### `src/adf.js`: Atlassian Document Format

Jira Cloud REST API v3 does not accept plain text for comments. It needs a JSON document tree called ADF.

```js
export function textToAdf(text) {
  const safeText = text === null || text === undefined ? '' : String(text);
  const content = safeText.split(/\r?\n/).map((line) =>
    line.length > 0
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph', content: [] }   // ADF rejects empty text nodes
  );
  return { version: 1, type: 'doc', content };
}
```

- `String(text)` accepts numbers and other values safely.
- `/\r?\n/` splits on both Windows and Unix newlines.
- Each line becomes a paragraph. A blank line becomes an *empty paragraph*, because `{ type: 'text', text: '' }` is invalid ADF.

### `src/jira.js`: talking to Jira

```js
import api, { route } from '@forge/api';
```

- **`api.asApp()`** makes requests with the app's own identity. Validators and post functions are
  triggered by Jira, not by a user's browser session, so there is no user to act as.
- **`route`** is a *tagged template*. In `` route`/rest/api/3/issue/${key}` `` Forge URL-encodes `key`,
  so a value like `../admin` cannot change the path. Forge rejects plain string URLs.

**`ensureOk(response, action)`**, a private helper:

```js
if (!response.ok) {
  const body = await response.text();
  throw new Error(`${action} failed with HTTP ${response.status}: ${body}`);
}
```

`fetch`-style APIs do **not** throw on 404 or 500. This helper turns HTTP errors into exceptions with a
readable message, which then appears in `forge logs`.

**`getIssue(issueKeyOrId, fields = [])`**

```js
const path = fieldList
  ? route`/rest/api/3/issue/${issueKeyOrId}?fields=${fieldList}`
  : route`/rest/api/3/issue/${issueKeyOrId}`;
```

`?fields=summary` asks Jira for only the fields needed. The response is smaller and faster.

**`addComment(issueKeyOrId, text)`**

```js
body: JSON.stringify({ body: textToAdf(`[forge-common v${LIB_VERSION}] ${text}`) })
```

This adds the version prefix, converts the text to ADF and POSTs it to `/rest/api/3/issue/{key}/comment`.

**`setLabel(issueKeyOrId, label)`**

```js
body: JSON.stringify({ update: { labels: [{ add: label }] } })
```

Jira's edit API has two styles:

| Style | Effect |
|---|---|
| `fields: { labels: ['x'] }` | **Replaces** all labels with `['x']` |
| `update: { labels: [{ add: 'x' }] }` ✅ | **Adds** `x` and keeps the existing labels |

Jira returns `204 No Content`, so nothing is parsed or returned.

### `src/index.js`: the public entry point

```js
export { LIB_VERSION } from './version.js';
export { isFieldPresent, validateRequiredFields, validateSummaryLength } from './validators.js';
export { textToAdf } from './adf.js';
export { getIssue, addComment, setLabel } from './jira.js';
```

This is the "front door" referenced by `exports` in `package.json`. Apps never import internal files directly,
so files can be reorganised later without breaking the apps.

### Tests (`test/`)

Run them with `npm test`: 4 suites, 26 tests.

| File | What it proves |
|---|---|
| `validators.test.js` | Every rule with valid, invalid and edge inputs (whitespace, `null`, empty ADF, exact boundary of 10) |
| `adf.test.js` | Single line, `\r\n` and blank lines, `null` and number input |
| `jira.test.js` | The correct URL, HTTP method and JSON body for each API call, and that HTTP errors throw |
| `version.test.js` | `LIB_VERSION` equals `package.json` `version` |

**How `jira.test.js` tests Jira calls without Jira:**

```js
const mockRequestJira = jest.fn();

jest.unstable_mockModule('@forge/api', () => ({          // 1. register a fake @forge/api
  default: { asApp: () => ({ requestJira: mockRequestJira }) },
  route: (strings, ...values) => /* join + encodeURIComponent */,
}));

const { getIssue, addComment, setLabel } = await import('../src/jira.js');   // 2. THEN import
```

- With ES modules, mocks must be registered **before** the module under test is loaded.
  That is why it uses `unstable_mockModule` followed by `await import(...)`, not a normal top-level `import`.
- Each test then sets what the fake returns (`mockResolvedValue`) and inspects what was sent
  (`mockRequestJira.mock.calls[0]`).

---

## Part 2: The apps

Both apps follow the same pattern: **the manifest declares the rules, and `src/index.js` connects them to the library**.

### `apps/forge-apple-1/manifest.yml`

```yaml
modules:
  jira:workflowValidator:
    - key: fa1-summary-length-validator      # stable ID Jira stores in the workflow; don't rename after use
      name: "FA1 – Summary length ≥ 10"      # what admins see in the workflow editor
      description: "..."
      function: fa1-validate-summary         # points to a function module below

  jira:workflowCondition:
    - key: fa1-assignee-only-condition
      name: "FA1 – Only assignee can transition"
      expression: issue.assignee != null && issue.assignee.accountId == user.accountId

  jira:workflowPostFunction:
    - key: fa1-audit-comment-postfunction
      name: "FA1 – Add audit comment"
      function: fa1-audit-comment

  function:
    - key: fa1-validate-summary
      handler: index.validateSummary         # file src/index.js, export validateSummary
    - key: fa1-audit-comment
      handler: index.auditComment

app:
  runtime: { name: nodejs22.x, memoryMB: 256, architecture: arm64 }
  id: ari:cloud:ecosystem::app/fbb12828-...  # generated by forge create; never change it

permissions:
  scopes: [read:jira-work, write:jira-work]
```

- **The condition has no `function`.** It is a [Jira expression](https://developer.atlassian.com/cloud/jira/platform/jira-expressions/)
  that Jira evaluates itself, with variables such as `issue`, `user` and `project` available.
  - `issue.assignee != null` is checked first, so `.accountId` is never read on `null`.
  - `user` is the person viewing the issue, so only the assignee sees the transition.
- **Module `key`s are permanent.** Workflows store the key. Renaming it later would orphan the rule in existing workflows.

### `apps/forge-apple-1/src/index.js`

```js
import { getIssue, validateSummaryLength, addComment, LIB_VERSION } from '@vinod/forge-common';
const MIN_SUMMARY_LENGTH = 10;
```

**`validateSummary(args)`**, the validator handler:

```js
const issueKey = args.issue.key;
try {
  let summary = args.transition?.modifiedFields?.summary;      // (1)
  if (summary == null) {
    const issue = await getIssue(issueKey, ['summary']);       // (2)
    summary = issue.fields.summary;
  }
  return validateSummaryLength(summary, MIN_SUMMARY_LENGTH);   // (3)
} catch (error) {
  console.error(`[FA1 validator] ${issueKey}: ${error.message}`);
  return { result: false, errorMessage: 'FA1: could not check the summary. Please try again.' };  // (4)
}
```

1. If the workflow shows a **transition screen**, the value the user just typed arrives in `modifiedFields`.
   It is not saved to the issue yet. `?.` safely handles a missing `transition` or `modifiedFields`.
2. Otherwise, read the saved summary from Jira. `== null` matches both `null` and `undefined`.
3. The library decides, and its `{ result, errorMessage }` is returned straight to Jira.
4. **Fail closed.** If Jira can't be reached, the transition is blocked with a clear message rather than allowed blindly.

**`auditComment(event)`**, the post function handler:

```js
const issueKey = event.issue.key ?? event.issue.id;
try {
  await addComment(issueKey, 'Forge Apple 1 transition executed');
  console.log(`[FA1 post function] commented on ${issueKey} (forge-common v${LIB_VERSION})`);
} catch (error) {
  console.error(`[FA1 post function] ${issueKey}: ${error.message}`);
}
```

- Post functions run **after** the transition and their return value is ignored, so there is nothing to return.
- Failures would be invisible to users, which is why both outcomes are logged. Check them with `forge logs`.
- `?? event.issue.id` falls back to the numeric ID; the Jira REST API accepts either.

### `apps/forge-apple-2/manifest.yml`

The structure is the same as app 1, with different rules:

| Module | Key | Logic |
|---|---|---|
| Validator | `fa2-required-fields-validator` | `index.validateRequired` |
| Condition | `fa2-has-label-condition` | `issue.labels.length > 0` |
| Post function | `fa2-audit-comment-label-postfunction` | `index.auditCommentAndLabel` |

### `apps/forge-apple-2/src/index.js`

**`validateRequired(args)`**

```js
const issue = await getIssue(issueKey, REQUIRED_FIELDS);   // ['description', 'priority']
const fields = { ...issue.fields };                         // copy saved values
const modified = args.transition?.modifiedFields ?? {};
for (const fieldId of REQUIRED_FIELDS) {
  if (modified[fieldId] != null) fields[fieldId] = modified[fieldId];   // screen values win
}
return validateRequiredFields(fields, REQUIRED_FIELDS);
```

This merges the **saved** values with any values **typed on the transition screen**, then lets the library decide.
`{ ...issue.fields }` copies the object so the original response is not mutated.

**`auditCommentAndLabel(event)`**

```js
await addComment(issueKey, 'Forge Apple 2 transition executed');
await setLabel(issueKey, PROCESSED_LABEL);   // 'forge-apple-2-processed'
```

The two calls run in sequence, so the comment always exists before the label is added.

### `apps/*/package.json`

```json
"dependencies": {
  "@forge/api": "^8.2.0",
  "@vinod/forge-common": "file:../../packages/forge-common/dist/vinod-forge-common-1.0.0.tgz"
}
```

- `file:...tgz` was written by `npm install <tarball>`. npm unpacked a **copy** into `node_modules/@vinod/forge-common/`.
- `@forge/api` is installed here because the library declares it as a peer dependency.

### Files generated by `forge create` and left as-is

| File | Purpose |
|---|---|
| `apps/*/.gitignore` | Ignores `node_modules`, `.forge`, IDE folders |
| `apps/*/AGENTS.md` | Forge guidance for AI coding assistants |
| `apps/*/package-lock.json` | Exact dependency versions for reproducible deploys |

---

## Part 3: Scripts

### `scripts/pack-common.sh`

```bash
set -euo pipefail                                     # stop on any error
ROOT="$(cd "$(dirname "$0")/.." && pwd)"              # repo root, from wherever it's called
cd "$ROOT/packages/forge-common"
npm test 1>&2                                         # test output → stderr
mkdir -p dist
TARBALL="$(npm pack --pack-destination dist --silent | tail -1)"
echo "$LIB/dist/$TARBALL"                             # the ONLY line on stdout
```

| Line | Why |
|---|---|
| `set -euo pipefail` | `-e`: stop on error. `-u`: error on undefined variables. `pipefail`: a failure inside a pipe counts |
| `dirname "$0"/..` | Works no matter which folder you run the script from |
| `npm test 1>&2` | A failing test stops the script, so nothing broken is ever packed |
| stdout = path only | Lets `deploy-all.sh` capture the result with `$( ... )` |

### `scripts/deploy-all.sh`

```bash
ENVIRONMENT="${1:-development}"                       # optional argument, default development
APPS=(forge-apple-1 forge-apple-2)
TARBALL_NAME="$(basename "$("$ROOT/scripts/pack-common.sh" | tail -1)")"
for APP in "${APPS[@]}"; do
  cd "$ROOT/apps/$APP"
  npm install "../../packages/forge-common/dist/$TARBALL_NAME"   # relative path → portable package.json
  forge lint
  forge deploy --non-interactive -e "$ENVIRONMENT"
done
```

- It uses only the tarball's **file name** with a relative path, so each app's `package.json` does not contain
  a machine-specific absolute path.
- Adding a third app is one change: add it to `APPS`.

### `.gitattributes` / `.gitignore`

| File | Rule | Why |
|---|---|---|
| `.gitattributes` | `*.sh text eol=lf` | Git on Windows can convert scripts to CRLF, which breaks bash with `$'\r': command not found` |
| `.gitignore` | `node_modules/`, `packages/forge-common/dist/` | Installed dependencies and built tarballs are regenerated, never committed |

---

## Part 4: Common tasks

| I want to… | Do this |
|---|---|
| Change a rule's logic | Edit `packages/forge-common/src/*.js`, add a test, run `npm test`, then `./scripts/deploy-all.sh` |
| Add a new shared function | Write it in `src/`, export it from `src/index.js`, test it, bump the version, then deploy all |
| Add a new rule to an app | Add the module and function to that app's `manifest.yml`, add the handler to its `src/index.js`, `forge lint`, `forge deploy` |
| Add a new scope | Edit the manifest, `forge deploy`, **then** `forge install --upgrade ...` |
| Debug a failure | `forge logs -e development --since 15m` in the app folder |
| Check what's installed | `forge install list` in the app folder |
