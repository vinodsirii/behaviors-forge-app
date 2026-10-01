# Architecture

This document explains how the Behaviors Forge App works and what every file does.
It is written for developers who know JavaScript but are new to Forge or to this app.

## How it works

```
1. `forge deploy` uploads the app
      │
2. manifest.yml declares a UI modification + a backend sync function
      │
3. On install / upgrade / daily → src/index.js (syncContexts) runs on Atlassian's servers
      │   └─ tells Jira: "run my UI modification on the Create screen of every project + issue type"
      │
4. A user clicks Create in Jira
      │
5. Jira loads static/behaviors/build/index.js in a hidden frame in the browser
      │   └─ static/behaviors/src/index.js runs the behaviours in src/behaviours/
      │
6. Fields are hidden / renamed / made required / made read-only live on the form
```

The app has two halves:

- **Backend** (`src/`) – runs on Atlassian's servers. Decides *where* the behaviours apply.
- **Frontend** (`static/behaviors/`) – runs in the user's browser. Decides *what* the behaviours do.

## Root files

### `manifest.yml`

Forge's description of the app.

| Section | Purpose |
|---|---|
| `jira:uiModifications` (`basic-behaviors`) | Declares the UI modification and points to the `behaviors` resource. Do not change the `key`: the sync function finds the existing record by this name. |
| `trigger` (`sync-on-install`) | Runs the `sync` function when the app is installed or upgraded. |
| `scheduledTrigger` (`sync-daily`) | Runs the `sync` function once a day, so new projects are picked up. |
| `function` (`sync`) | Maps to `src/index.js` → exported `syncContexts`. |
| `resources` (`behaviors`) | Points to `static/behaviors/build`, the **built** browser code. |
| `permissions.scopes` | `manage:jira-configuration` (create/update UI modification records), `read:jira-work` (projects, issue types, fields), `write:jira-work` (change values on the form), `read:jira-user` (Assignee/Reporter). |
| `app` | Node runtime for the backend and the app ID that links this folder to the registered Forge app. |

### `package.json` / `package-lock.json`

Backend dependencies. Only `@forge/api` is used, to call the Jira REST API from `src/index.js`.

### `src/index.js` – `syncContexts`

A UI modification only runs where it has a **context**: a project + issue type + view.
This function keeps those contexts up to date.

| Function | Purpose |
|---|---|
| `jira()` | Calls the Jira REST API as the app and throws on a failed response. |
| `getAllPages()` | Follows Jira's pagination (50 results per page). |
| `buildContexts()` | Lists every project and its issue types and builds one context per pair, with `viewType: 'GIC'` (the Create dialog). |
| `findExisting()` | Finds the UI modification record named `basic-behaviors`. |
| `syncContexts()` | Updates that record, or creates it when missing. Safe to run repeatedly – it never creates duplicates. |

## Frontend – `static/behaviors/`

### `package.json`

| Package | Purpose |
|---|---|
| `@forge/jira-bridge` | `uiModificationsApi` – `onInit`, `onChange`, `getFieldById`. |
| `@forge/bridge` | `view.getContext()` – used to read the current issue type. |
| `esbuild` (dev) | Bundler used by `npm run build`. |

### `build.mjs`

1. Deletes the old `build/` folder.
2. Bundles `src/index.js` and everything it imports into one minified `build/index.js`.
3. Copies `public/index.html` to `build/` and adds a `<script>` tag for `index.js`.

Run `npm run build` before every deploy – Forge uploads `build/`, not `src/`.

### `public/index.html`

An empty page. Jira loads it in a hidden frame; its only job is to run `index.js`.

### `src/index.js` – wiring

Connects Jira to the behaviours. Contains no business rules.

- `ALL_FIELDS` – every field id used by any behaviour. Jira only lets the app work with registered fields.
- `readIssueType()` – reads the current issue type name from the Forge context.
- `createContext()` – builds the `ctx` object passed to every behaviour:

  | Property | Meaning |
  |---|---|
  | `ctx.issueType` | Lower-case issue type name, e.g. `"bug"`, `"story"`, `"epic"`. |
  | `ctx.isInit` | `true` when the form just opened, `false` when a field changed. |
  | `ctx.field(id)` | The Jira field object, or `undefined` when it is not on the screen. |
  | `ctx.value(id)` | The field's current value, including the change being processed. |
  | `ctx.setValue(id, v)` | Changes a value; behaviours that listen to that field run too. |

- `runBehaviours()` – runs each behaviour in its own `try/catch`, so one failure does not stop the others.
- `onInit` – runs **all** behaviours when the form opens, and again when the project or issue type changes.
- `onChange` – runs only the behaviours whose `triggers` include the changed field, then any behaviours triggered by values the app itself changed (Jira does not fire `onChange` for those).

### `src/helpers.js`

| Function | Purpose |
|---|---|
| `PRIORITY_IDS`, `priorityNameOf()` | Converts `"1"` or `{ name: "Highest" }` to `"Highest"`. Assumes the default Jira priority ids. |
| `labelsOf()` | Returns the Labels value as lower-case strings. |
| `hasText()` | Checks whether a value (rich text or plain text) contains any text. |
| `renameField()` | Renames a field and remembers its original name so it can be restored. |

### `src/behaviours/index.js`

- Imports and exports all behaviours, **in run order**.
- Contains the **ownership table**: each field property (e.g. "duedate → required") is changed by exactly one behaviour. If two behaviours set the same property, the last one silently wins.
- To disable a behaviour, comment out its line in the exported array.

### `src/behaviours/NN-name.js`

One rule per file. Every behaviour exports the same shape:

```js
export default {
  id: 'priority-sla',                        // unique name, used in log messages
  fields: ['priority', 'duedate', 'labels'], // every field it reads or changes
  triggers: ['priority'],                    // re-run when these change ([] = on open only)
  apply(ctx) { /* the rule */ },
};
```

| File | Rule | Triggers |
|---|---|---|
| `01-summary-quality.js` | Summary helper text / length warning; "URGENT…" sets Priority to Highest | `summary` |
| `02-description-template.js` | Pre-fills an empty Description (Bug or default template) | on open |
| `03-bug-reporting.js` | Bug: "Steps to reproduce" and "Found in version(s)" required | on open |
| `04-priority-sla.js` | High/Highest: Due date required; Highest: Labels required | `priority` |
| `05-ownership.js` | Reporter read-only; Assignee helper text | on open |
| `06-epic-planning.js` | Epic: Assignee read-only; Fix versions → "Target release", required | on open |
| `07-customer-escalation.js` | Label `customer`: Components required | `labels` |
| `08-release-fields.js` | Affects versions only for Bugs; Fix versions hidden for Bugs and Sub-tasks | on open |
| `09-story-parent.js` | Story: Parent → "Epic", required; Assignee → "Developer" | on open |
| `10-incident-mode.js` | Highest: Summary → "Incident summary", Components → "Affected service" | `priority` |

### `build/` (not in git)

Output of `npm run build`. Deployed by Forge; never edited by hand.

## Other files

| File | Purpose |
|---|---|
| `README.md` | Behaviour overview, how to add a behaviour, redeploy and debug. |
| `AGENTS.md` | Instructions for AI coding assistants working in this repository. Not used by Jira. |
| `.gitignore` | Excludes `node_modules/`, `build/`, `.env`, `.forge/` and logs. |

## Common tasks

| Task | Where |
|---|---|
| Change a rule | `static/behaviors/src/behaviours/NN-*.js` |
| Add a behaviour | New file in `behaviours/` + one line in `behaviours/index.js`; check the ownership table |
| Apply to the issue view as well as Create | `src/index.js` – add contexts with `viewType: 'IssueView'` (not every field change is supported there, e.g. `setRequired`) |
| Add a scope | `manifest.yml`, then `forge deploy` and `forge install --upgrade` |
| Ship a change | `npm run build` in `static/behaviors`, then `forge deploy -e development` |

## Known limitations

- Behaviours only apply in the **Create** dialog, not on the issue view or edit screen.
- A behaviour is skipped silently when its field is not on the project's create screen.
- Priority rules assume the default priority ids (`1` = Highest … `5` = Lowest); adjust `PRIORITY_IDS` in `helpers.js` for custom priority schemes.
- The Description template is chosen when the form opens; switching issue type afterwards keeps the existing text.
