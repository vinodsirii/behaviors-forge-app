# Adding a new behaviour

A step-by-step guide to adding behaviour #11 (or #30) to this app: which files to create,
which files to change, whether `manifest.yml` needs updating, and how to deploy and test.

New to the app? Read [HOW-IT-WORKS.md](HOW-IT-WORKS.md) first.

---

## 1. The short answer

For a normal behaviour (hide / show / rename / require / lock / pre-fill fields on the Create screen):

| Step | File | Action |
|---|---|---|
| 1 | `static/behaviors/src/behaviours/11-your-behaviour.js` | **Create** – the rule itself |
| 2 | `static/behaviors/src/behaviours/index.js` | **Edit** – import it, add it to the list, update the ownership table |
| 3 | `static/behaviors/src/helpers.js` | *Optional* – only if two or more behaviours need the same helper |
| 4 | `README.md` | **Edit** – add a row to the behaviour table |
| – | `static/behaviors/src/index.js` | **No change** – fields and triggers are picked up automatically |
| – | `manifest.yml` | **No change** – see [section 3](#3-does-manifestyml-need-to-change) for the exceptions |
| – | `src/index.js` (backend sync) | **No change** – unless you want a screen other than Create |

Then: `npm run build` → `forge lint` → `forge deploy` → test → commit.

---

## 2. Before you write code – plan it

Answer these five questions first. They decide everything else.

| Question | Example answer |
|---|---|
| **What** should happen? | "Severity must be filled in for Bugs" |
| **Which fields** are involved? | Severity (custom field), Priority |
| **When** should it run? | When the form opens / when Priority changes / when Labels change |
| **For which** issue types / values? | Issue type = Bug |
| **Which field properties** will it change? | Severity → required, description |

### 2.1 Find the field ids

Behaviours refer to fields by **id**, not by name.

**System fields** – the id is fixed:

| Field | Id | | Field | Id |
|---|---|---|---|---|
| Summary | `summary` | | Assignee | `assignee` |
| Description | `description` | | Reporter | `reporter` |
| Priority | `priority` | | Components | `components` |
| Labels | `labels` | | Fix versions | `fixVersions` |
| Due date | `duedate` | | Affects versions | `versions` |
| Parent | `parent` | | Issue type | `issuetype` |

**Custom fields** – the id looks like `customfield_10042`. To find it, either:

- **Jira admin UI:** ⚙ Settings → Issues → Custom fields → find the field → ⋯ → *Edit details*.
  The page URL ends with `id=10042` → the field id is `customfield_10042`.
- **Browser:** open `https://<your-site>.atlassian.net/rest/api/3/field` while logged in,
  press Ctrl+F and search for the field name. Copy its `"id"`.

> Custom field ids differ between sites. An id from your test site is usually **not** the same on production.

### 2.2 Check the ownership table

Open `static/behaviors/src/behaviours/index.js` and read the **ownership table** at the top.

**Rule: each field property is changed by exactly one behaviour.**
If behaviour 4 already owns `duedate → required`, your new behaviour must **not** call
`duedate.setRequired(...)`. If two behaviours set the same property, the one that runs last silently
wins – a very hard bug to find.

If you need a property that is already owned, **extend the owning behaviour** instead of creating a new one.

### 2.3 What you can do to a field

These methods are available on `ctx.field('<id>')` in the Create dialog:

| Method | Effect |
|---|---|
| `setVisible(true/false)` | Show / hide the field |
| `setRequired(true/false)` | Add / remove the red asterisk (blocks Create while empty) |
| `setReadOnly(true/false)` | Lock / unlock the field |
| `setName('text')` | Change the label – use `renameField()` from `helpers.js` so it can be restored |
| `setDescription('text')` | Helper text under the field (`''` removes it) |
| `setValue(value)` | Change the value – use `ctx.setValue()` so behaviours that listen to it run too |
| `setOptionsVisibility([ids], true/false)` | Show only some options of a select/radio/checkbox field |
| `getValue()`, `getName()`, `getId()` | Read the field (prefer `ctx.value(id)` – it includes the change in progress) |
| `isVisible()`, `isRequired()`, `isReadOnly()` | Read the current state |

> **Never hide a field that can be required.** The user cannot fill in a hidden field, so the form can never be submitted.

---

## 3. Does `manifest.yml` need to change?

**Usually not.** The manifest declares the UI modification *once*; all behaviours live inside it.
Adding behaviour 11 is a code change, just like editing behaviour 4.

| What your new behaviour does | `manifest.yml` | Other files | Deploy | `forge install --upgrade` |
|---|---|---|---|---|
| Changes fields on the Create screen (hide, rename, require, read-only, set value, helper text) | **No** | – | Yes | No |
| Uses a **custom field** | **No** | – | Yes | No |
| Reads **issue type / project** | **No** (already available via `ctx.issueType`) | – | Yes | No |
| Calls a **Jira REST API** from the behaviour (e.g. `requestJira` from `@forge/bridge`) | **Only if** it needs a scope not already listed (`read:jira-work`, `write:jira-work`, `read:jira-user`, `manage:jira-configuration`) | – | Yes | **Yes, if a scope was added** |
| Calls an **external website / API** | **Yes** – add the domain under `permissions.external.fetch` | – | Yes | **Yes** |
| Should also run on the **issue view** or **transition** screen | **No** | `src/index.js` – add contexts with `viewType: 'IssueView'` / `'IssueTransition'` | Yes | No (see note) |
| Needs a **new backend function** (resolver) | **Yes** – add a `function` module and link a `resolver` | New backend file | Yes | No |

**Rule of thumb:** a change to `permissions` (scopes or external domains) in `manifest.yml`
**always** needs `forge deploy` **and then** `forge install --upgrade`. Code-only changes only need `forge deploy`.

> **Note on new screens:** the backend sync (`syncContexts`) runs on install, on upgrade and **once a day**.
> After changing `src/index.js` to add a screen, the new contexts appear after the next daily run.
> Not every field or method is supported on the issue view and transition screens – check Atlassian's "UI modifications – supported fields" documentation before relying on one there.

### Validate the manifest

Whenever you **do** edit `manifest.yml`, run:

```sh
forge lint
```

---

## 4. Step by step – worked example

**Goal (behaviour 11 – "Bug severity"):**
For **Bugs**, the custom field **Severity** is required and gets helper text.
When **Priority** is **Highest**, the helper text asks for "Critical".
For other issue types, Severity is hidden.

Fields: `customfield_10042` (Severity – replace with your real id) and `priority`.
Properties changed: Severity → `visible`, `required`, `description`. None of these are owned yet. ✅

### Step 1 – Create the behaviour file

Create `static/behaviors/src/behaviours/11-bug-severity.js`:

```js
import { priorityNameOf } from '../helpers.js';

/*
 * 11. Bug severity
 *
 *  - Severity: only shown for Bugs, and required for Bugs.
 *  - Severity: helper text; asks for "Critical" when Priority is Highest.
 *
 * Test: Issue type = Bug -> Severity visible with a red asterisk.
 *       Priority = Highest -> helper text asks for "Critical".
 *       Issue type = Task -> Severity hidden.
 */

// Custom field ids differ per site: find yours under
// Jira settings -> Issues -> Custom fields -> Severity -> Edit details (id=NNNNN in the URL).
const SEVERITY_FIELD_ID = 'customfield_10042';

export default {
  // Unique name, shown in console error messages.
  id: 'bug-severity',

  // Every field this behaviour reads or changes. Jira only lets the app touch registered fields;
  // src/index.js collects these automatically.
  fields: [SEVERITY_FIELD_ID, 'priority'],

  // Re-run this behaviour when Priority changes. ([] = only when the form opens.)
  // It always runs when the form opens and when the issue type changes.
  triggers: ['priority'],

  apply(ctx) {
    const severity = ctx.field(SEVERITY_FIELD_ID);
    if (!severity) return; // field not on this project's Create screen -> skip silently

    const isBug = ctx.issueType === 'bug';
    const isHighest = priorityNameOf(ctx.value('priority')) === 'Highest';

    // Always set BOTH states (true and false), so switching issue type or priority
    // back and forth always leaves the field correct.
    severity.setVisible(isBug);
    severity.setRequired(isBug); // only required when visible - never hide a required field
    severity.setDescription(
      isBug && isHighest ? 'Highest priority: Severity should be "Critical".' : isBug ? 'How bad is the impact?' : '',
    );
  },
};
```

**The pattern every behaviour follows:**

1. Get the field with `ctx.field(id)` and **return early** if it is `undefined`.
2. Work out the condition (`isBug`, `isHighest`, …) from `ctx.issueType` and `ctx.value(id)`.
3. Set each property for **both** outcomes (`setRequired(isBug)`, not just `if (isBug) setRequired(true)`).

### Step 2 – Register it in `behaviours/index.js`

Add the import and the list entry, and update the ownership table:

```js
// ownership table (top comment) – add:
//   customfield_10042 (Severity)  visible, required, description -> 11

import incidentMode from './10-incident-mode.js';
import bugSeverity from './11-bug-severity.js';        // ← new

export default [
  // ...
  incidentMode,
  bugSeverity,                                         // ← new (runs last)
];
```

That's all the wiring needed. `src/index.js` reads `fields` and `triggers` from every behaviour,
so the new field is registered and the Priority trigger works automatically.

### Step 3 – Helpers (only if needed)

The example re-uses `priorityNameOf` from `helpers.js`. Only add a new helper when **two or more**
behaviours need the same logic. One-off logic stays in the behaviour file.

### Step 4 – Build

Forge uploads the **built** files, not `src/`:

```sh
cd static/behaviors
npm run build
cd ../..
```

Expected output: `Built static/behaviors/build`.

### Step 5 – Lint

```sh
forge lint
```

Expected: `No issues found.`

### Step 6 – Deploy

```sh
forge deploy --non-interactive -e development
```

No `forge install` needed – the app is already installed and no scopes changed.

> **Faster loop while developing:** run `forge tunnel` in the app folder. After each code change,
> run `npm run build` in `static/behaviors` and refresh Jira – no redeploy needed.
> If you change `manifest.yml`, stop the tunnel, redeploy, and start it again.

### Step 7 – Test in Jira

Refresh Jira (Ctrl+F5) → **Create**, in a project whose Create screen has the Severity field:

| # | Do | Expected |
|---|---|---|
| 11.1 | Issue type = **Bug** | Severity visible, red asterisk, "How bad is the impact?" |
| 11.2 | Priority = **Highest**, click away | Helper text: "Highest priority: Severity should be "Critical"." |
| 11.3 | Leave Severity empty, click Create | Blocked – Severity is required |
| 11.4 | Issue type = **Task** | Severity hidden |
| 11.5 | Run behaviours 1–10 again (see the README) | Still work – nothing else changed |

If it doesn't work:

- Press **F12 → Console**, filter on `[Behaviours]` – errors name the failing behaviour (`"bug-severity" failed`).
- Is the field on the project's **Create screen**? If not, the behaviour is skipped silently.
- Is the custom field **id** right? `ctx.field('customfield_…')` returns `undefined` for a wrong id.
- Did you run `npm run build` before deploying?

### Step 8 – Document and commit

1. Add a row to the behaviour table in `README.md`:

   ```
   | 11 | Bug severity | Issue type = Bug / Priority changes | Severity: shown and required for Bugs, helper text asks for "Critical" at Highest |
   ```

2. Commit and push:

   ```sh
   git add -A
   git commit -m "Add behaviour 11: bug severity"
   git push
   ```

---

## 5. Blank template

Copy this into `static/behaviors/src/behaviours/NN-your-name.js`:

```js
// import { priorityNameOf, labelsOf, hasText, renameField } from '../helpers.js';

/*
 * NN. <Behaviour name>
 *
 *  - <Field>: <what happens and when>
 *  - <Field>: <what happens and when>
 *
 * Test: <what to do in the Create dialog> -> <what you should see>
 */

export default {
  id: 'your-behaviour-id',
  fields: ['fieldIdA', 'fieldIdB'],
  triggers: [], // field ids that should re-run this behaviour when changed

  apply(ctx) {
    const fieldA = ctx.field('fieldIdA');
    if (!fieldA) return;

    const condition = ctx.issueType === 'bug'; // or based on ctx.value('someField')

    fieldA.setRequired(condition);
    fieldA.setDescription(condition ? 'Helper text' : '');
  },
};
```

### What `ctx` gives you

| `ctx.` | Meaning |
|---|---|
| `issueType` | Lower-case issue type name: `"bug"`, `"story"`, `"task"`, `"epic"`, `"sub-task"` … |
| `isInit` | `true` when the form just opened, `false` when a field changed |
| `field(id)` | The field object, or `undefined` when it's not on the screen |
| `value(id)` | Current value of a field, including the change being processed |
| `setValue(id, v)` | Set a value **and** run the behaviours that listen to that field |

---

## 6. Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Forgot `npm run build` | Jira still runs the old code | Build, then deploy |
| Setting a property another behaviour owns | Random-looking "it sometimes doesn't work" | Check the ownership table; extend the owner instead |
| Only setting the "true" state (`if (x) setRequired(true)`) | Field stays required after switching back | Always `setRequired(x)` |
| Hiding a field that can be required | Form can never be submitted | Only hide when it isn't required |
| `setValue` on every `onInit` | Overwrites what the user typed | Only set when empty (see `02-description-template.js`), or only when `!ctx.isInit` |
| Forgot to add the field to `fields` | `ctx.field()` returns `undefined` | List every field id in `fields` |
| Forgot to add the trigger | Behaviour doesn't react to changes | Add the field id to `triggers` |
| Wrong custom field id | Behaviour silently skipped | Check the id via `/rest/api/3/field` |
| Expecting changes while typing | Nothing happens until you click away | `onChange` fires when the user leaves the field |
| Added a scope but only deployed | App doesn't get the permission | `forge deploy`, then `forge install --upgrade` |

---

## 7. Checklist

- [ ] Planned: fields, trigger, issue types, properties
- [ ] Field ids found (custom fields: `customfield_NNNNN`)
- [ ] Ownership table checked – no property already owned
- [ ] `behaviours/NN-name.js` created (early return, both states set)
- [ ] Imported and added to the list in `behaviours/index.js`
- [ ] Ownership table updated
- [ ] `manifest.yml` – only if new scopes / external domains / functions (then `forge lint`)
- [ ] `npm run build` in `static/behaviors`
- [ ] `forge lint`
- [ ] `forge deploy --non-interactive -e development` (+ `forge install --upgrade` if permissions changed)
- [ ] Tested in Create: new behaviour **and** behaviours 1–10 still work
- [ ] `README.md` table updated
- [ ] Committed and pushed
