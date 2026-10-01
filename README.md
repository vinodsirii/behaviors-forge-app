# Behaviors Forge App

Jira Cloud Forge app using **UI modifications** (the Forge equivalent of ScriptRunner Behaviours) to change fields live in the **Create issue** dialog.

| # | Behaviour | When | Fields and effect |
|---|---|---|---|
| 1 | Summary quality | Always / Summary changes | Summary: helper text, warning over 80 chars · Priority: set to Highest when Summary starts with "URGENT" |
| 2 | Description template | Form opens | Description: pre-filled template (Bug-specific for Bugs) |
| 3 | Bug reporting | Issue type = Bug | Description → "Steps to reproduce", required · Affects versions → "Found in version(s)", required |
| 4 | Priority SLA | Priority changes | Due date required for High/Highest · Labels required for Highest |
| 5 | Ownership | Always | Reporter read-only + help · Assignee help text |
| 6 | Epic planning | Issue type = Epic | Assignee read-only · Fix versions → "Target release", required |
| 7 | Customer escalation | Labels contain "customer" | Components required + help · Affects versions help |
| 8 | Release fields | Issue type | Affects versions only for Bugs · Fix versions hidden for Bugs and Sub-tasks |
| 9 | Story structure | Issue type = Story | Parent → "Epic", required · Assignee → "Developer" |
| 10 | Incident mode | Priority = Highest | Summary → "Incident summary" · Components → "Affected service" |

Behaviours are skipped for any field that isn't on the project's create screen.

## Layout

- `static/behaviors/src/behaviours/` – one file per behaviour, listed in `behaviours/index.js` (which also documents which behaviour owns which field property)
- `static/behaviors/src/index.js` – wires the behaviours to Jira's `onInit` / `onChange` (no business rules)
- `static/behaviors/src/helpers.js` – shared helpers (priority names, labels, renaming)
- `src/index.js` – registers the UI modification for every project and issue type. Runs on install, on upgrade and once a day.
- `manifest.yml` – modules and permissions

New to the app? Start with [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) – a beginner's guide that follows the calls between files step by step. For a shorter technical reference, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Adding a behaviour

1. Copy a file in `static/behaviors/src/behaviours/`, give it a new `id`, and set `fields`, `triggers` and `apply`.
2. Add it to the array in `behaviours/index.js`.
3. Make sure it doesn't change a field property another behaviour already owns (see the table there).

No `manifest.yml` change is needed unless the behaviour needs new permissions. See [docs/ADDING-A-BEHAVIOUR.md](docs/ADDING-A-BEHAVIOUR.md) for the full step-by-step guide with a worked example, a template and a checklist.

## Change and redeploy

```sh
cd static/behaviors && npm install && npm run build && cd ../..
forge deploy -e development
```

Always run `npm run build` before `forge deploy`, because Forge uploads the built files in `static/behaviors/build`.

## Debugging

```sh
forge logs -e development
```

Browser-side errors appear in the browser developer console on the Create issue dialog, prefixed with `[Behaviours]`.
