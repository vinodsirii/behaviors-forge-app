# forge-apple

A Forge monorepo with **two Jira workflow apps** that share **one common library**.
The goal is to prove that shared logic is written once, unit-tested once and reused by both apps.

| Part | Path | Used by |
|---|---|---|
| Shared library `@vinod/forge-common` | `packages/forge-common` | both apps |
| App 1 `forge-apple-1` | `apps/forge-apple-1` | Jira workflow **Forge Apple 1** |
| App 2 `forge-apple-2` | `apps/forge-apple-2` | Jira workflow **Forge Apple 2** |

- **Jira site:** `vinodsirii.atlassian.net`
- **Forge account:** `vinodsirii.228@gmail.com`
- **Environment:** `development`

**Documentation**

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): diagrams of the components, the build and deploy pipeline,
  the runtime sequence, how the apps relate, and the design decisions
- [docs/CODE-WALKTHROUGH.md](docs/CODE-WALKTHROUGH.md): every file and function explained line by line
- [docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md): the plan and tooling for migrating Jira Data Center
  workflow logic (ScriptRunner, JSU, JMWE…) to Forge apps using this pattern

```
forge-apple/
├── packages/forge-common/
│   ├── src/version.js       LIB_VERSION (shown in every audit comment)
│   ├── src/validators.js    isFieldPresent, validateRequiredFields, validateSummaryLength (pure)
│   ├── src/adf.js           textToAdf (Atlassian Document Format)
│   ├── src/jira.js          getIssue, addComment, setLabel (api.asApp() + route)
│   ├── src/index.js         public entry point
│   └── test/*.test.js       Jest unit tests (@forge/api is mocked)
├── apps/forge-apple-1/      validator + condition + post function (FA1)
├── apps/forge-apple-2/      validator + condition + post function (FA2)
├── templates/workflow-app/  starting point for new per-workflow apps (DC migration)
├── tools/workflow-discovery/ reads DC workflow XML exports and builds the migration inventory
└── scripts/
    ├── pack-common.sh       test + npm pack the library into dist/
    ├── deploy-all.sh        pack, install the tarball in every registered app, lint, deploy all
    └── new-workflow-app.sh  scaffold + register a new workflow app from the template
```

### Migrating Data Center workflows (quick start)

```bash
# 1. Build the inventory from DC workflow XML exports (one file per workflow, named after it)
cd tools/workflow-discovery && npm install && npm test
node src/cli.js ../../workflow-exports --out ../../migration-inventory

# 2. Scaffold an app per workflow (interactive forge register; add --no-register to skip)
cd ../.. && ./scripts/new-workflow-app.sh wf-purchase-approval PA "Purchase Approval"

# 3. Replace the EXAMPLE rules, then deploy every app
./scripts/deploy-all.sh
```

See [docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md) for the full process.

## How the apps consume the library

Forge only bundles files **inside** each app folder, so a folder link
(`npm install ../../packages/forge-common`) would break `forge tunnel` and `forge deploy`.
Instead, the library is packed into a tarball, and each app installs a **copy** of it:

```
packages/forge-common ──npm pack──► dist/vinod-forge-common-1.0.0.tgz
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
     apps/forge-apple-1/node_modules/@vinod/forge-common   apps/forge-apple-2/node_modules/...
```

Each app's handlers import only from `@vinod/forge-common`; no logic is duplicated.
`@forge/api` is a **peer** dependency of the library, so it is provided by each app.

---

## 1. Run the library unit tests

```bash
cd ~/Forge-WorkFlow-Apps/forge-apple/packages/forge-common
npm install
npm test
```

You should see `Test Suites: 4 passed` and `Tests: 26 passed`.
The `ExperimentalWarning: VM Modules` message is expected: Jest needs that Node flag to run native ES modules.

## 2. Register, deploy and install (development)

The apps are already registered: `forge create` was run once per app, and the app IDs are in each `manifest.yml`.
For reference, they were created with:

```bash
cd ~/Forge-WorkFlow-Apps/forge-apple/apps
forge create -t jira-workflow-validator forge-apple-1   # then replace manifest.yml + src/index.js
forge create -t jira-workflow-validator forge-apple-2
```

Pack the library and install it into both apps:

```bash
cd ~/Forge-WorkFlow-Apps/forge-apple
./scripts/pack-common.sh

cd apps/forge-apple-1 && npm install ../../packages/forge-common/dist/vinod-forge-common-1.0.0.tgz && forge lint
cd ../forge-apple-2   && npm install ../../packages/forge-common/dist/vinod-forge-common-1.0.0.tgz && forge lint
```

Deploy and install. Run these in **each** app folder:

```bash
forge deploy --non-interactive -e development
forge install --non-interactive --site vinodsirii.atlassian.net --product jira --environment development
```

Alternatively, deploy both apps in one go (this runs the tests, packs, installs and deploys):

```bash
cd ~/Forge-WorkFlow-Apps/forge-apple
./scripts/deploy-all.sh
```

Re-run `forge install --upgrade ...` only when you change **scopes** or egress in a manifest.

> `forge install` must be run by an account that is an **admin of the target site**.
> Otherwise it fails with `Principal has insufficient permissions`.

## 3. Debugging

```bash
cd ~/Forge-WorkFlow-Apps/forge-apple/apps/forge-apple-1   # or forge-apple-2
forge logs -e development --since 15m -n 50                # handler logs (console.log / console.error)
forge tunnel                                               # run handlers locally with live reload
```

- **Tunnel:** `src/` changes reload automatically. Manifest changes need `forge deploy`, then a tunnel restart.
- **Library changes during a tunnel:** run `./scripts/pack-common.sh`, then re-run `npm install <tgz>` in that app.
  The tunnel only sees what is inside the app's `node_modules`.
- **Failed validator:** if the validator cannot read the issue, it **fails closed** and shows
  `FA1/FA2: could not check ...`. Check `forge logs` for the HTTP error.

---

## 4. Jira test plan

### 4.1 Setup (once)

1. **Create two company-managed projects** (Projects → Create project → choose a *company-managed* template),
   for example **FAPA** for Forge Apple 1 and **FAPB** for Forge Apple 2.
2. **Create the workflows.** Go to ⚙ Settings → Work items → Workflows → **Create workflow**.
   - **Forge Apple 1**: statuses `To Do → In Progress → Done`.
   - **Forge Apple 2**: same statuses.
3. **Add the rules to the To Do → In Progress transition** of each workflow:

   | Workflow | Rule type in editor | Rule to add |
   |---|---|---|
   | Forge Apple 1 | Restrict transition (condition) | **FA1 – Condition: Only assignee can transition** |
   | Forge Apple 1 | Validate details (validator) | **FA1 – Validator: Summary length ≥ 10** |
   | Forge Apple 1 | Perform actions (post function) | **FA1 – Post function: Add audit comment** |
   | Forge Apple 2 | Restrict transition (condition) | **FA2 – Condition: Issue must have a label** |
   | Forge Apple 2 | Validate details (validator) | **FA2 – Validator: Description and priority required** |
   | Forge Apple 2 | Perform actions (post function) | **FA2 – Post function: Add audit comment + label** |

   Save or publish each workflow.
4. **Apply the workflows.** Go to ⚙ Settings → Work items → Workflow schemes → create
   **Forge Apple 1 scheme** (all work types → Forge Apple 1) and **Forge Apple 2 scheme**.
   Then in each project go to Project settings → Workflows → **Switch scheme**.

### 4.2 Forge Apple 1 (project FAPA)

| # | Rule | Setup | Action | Expected |
|---|---|---|---|---|
| 1.1 | Condition ✗ | Issue unassigned | Open issue | **In Progress** is not offered |
| 1.2 | Condition ✗ | Assigned to another user | Open issue | **In Progress** is not offered |
| 1.3 | Condition ✓ | Assigned to you | Open issue | **In Progress** is offered |
| 1.4 | Validator ✗ | Assigned to you, summary `Short` (5 chars) | To Do → In Progress | Blocked: *Summary must be at least 10 characters (currently 5).* |
| 1.5 | Validator ✗ | Summary `   abc    ` (spaces trimmed → 3) | Transition | Blocked: *(currently 3)* |
| 1.6 | Validator ✓ | Summary `1234567890` (exactly 10) | Transition | Allowed |
| 1.7 | Post function | After 1.6 | Wait a few seconds, refresh | Comment: **`[forge-common v1.0.0] Forge Apple 1 transition executed`** |

### 4.3 Forge Apple 2 (project FAPB)

| # | Rule | Setup | Action | Expected |
|---|---|---|---|---|
| 2.1 | Condition ✗ | No labels | Open issue | **In Progress** is not offered |
| 2.2 | Condition ✓ | Label `test` | Open issue | **In Progress** is offered |
| 2.3 | Validator ✗ | Label `test`, description empty | Transition | Blocked: *Required field(s) missing: description* |
| 2.4 | Validator ✓ | Label, description and priority set | Transition | Allowed |
| 2.5 | Post function | After 2.4 | Refresh | Comment **`[forge-common v1.0.0] Forge Apple 2 transition executed`** and label **`forge-apple-2-processed`** added; `test` is kept |

**Testing missing priority:** company-managed projects normally give every issue a default priority.
"Priority missing" can only be produced by hiding the Priority field in the field configuration.
The unit tests in `validators.test.js` cover that case.

---

## 5. Prove the library is shared

### 5.1 One library change reaches both apps

1. Bump the version. Update **both** files; `version.test.js` fails the pack if they differ.
   ```bash
   cd ~/Forge-WorkFlow-Apps/forge-apple/packages/forge-common
   npm version 1.1.0 --no-git-tag-version
   sed -i "s/LIB_VERSION = '1.0.0'/LIB_VERSION = '1.1.0'/" src/version.js
   ```
2. Ship it to both apps with one command:
   ```bash
   cd ~/Forge-WorkFlow-Apps/forge-apple
   ./scripts/deploy-all.sh
   ```
   No `forge install --upgrade` is needed, because the scopes did not change.
3. Transition one new issue in **FAPA** (case 1.6) and one in **FAPB** (case 2.4).
4. **Expected:** both comments now start with **`[forge-common v1.1.0]`**, even though
   neither app's own `src/index.js` was changed.
5. Check the deployed version from the logs as well:
   ```bash
   cd apps/forge-apple-1 && forge logs -e development --since 15m | grep forge-common
   ```

### 5.2 Rules are reusable across workflows without code changes

1. Edit the **Forge Apple 2** workflow → To Do → In Progress → *Validate details* → add **FA1 – Validator: Summary length ≥ 10**. Publish.
2. In **FAPB**, create an issue with a label, a description, priority, and summary `Short`.
3. Transition it. It is **blocked by the FA1 rule**: *Summary must be at least 10 characters (currently 5).*
4. Change the summary to 10+ characters. The transition succeeds, and the FA2 post function adds its comment and label.

The FA1 validator now runs inside the Forge Apple 2 workflow, with no code change and no redeploy.
