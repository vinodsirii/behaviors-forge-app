# Architecture

This document explains how the forge-apple monorepo fits together:
- which pieces exist
- how the shared library reaches both apps
- what happens inside Jira when a workflow transition runs

For a file-by-file explanation of the code, see [CODE-WALKTHROUGH.md](CODE-WALKTHROUGH.md).

---

## 1. Goal

Two Jira Forge apps need overlapping logic: reading issues, validating fields and writing audit comments.
Instead of copying that logic into each app, it lives in **one library**, `@vinod/forge-common`. The library is:

- **written once**, in `packages/forge-common/src`
- **unit-tested once**, in `packages/forge-common/test` (26 Jest tests, no Jira needed)
- **reused by both apps**, which contain only thin handlers that call the library

---

## 2. Component overview

```mermaid
flowchart TB
    subgraph repo["forge-apple (Git monorepo)"]
        direction TB
        subgraph lib["packages/forge-common  ·  @vinod/forge-common"]
            version["version.js<br/>LIB_VERSION"]
            validators["validators.js<br/>pure rules"]
            adf["adf.js<br/>textToAdf"]
            jira["jira.js<br/>getIssue · addComment · setLabel"]
            index["index.js<br/>public exports"]
            tests["test/*.test.js<br/>Jest (26 tests)"]
            index --> version & validators & adf & jira
            jira --> adf & version
            tests -.tests.-> validators & adf & jira & version
        end

        subgraph app1["apps/forge-apple-1"]
            m1["manifest.yml<br/>validator · condition · post function"]
            h1["src/index.js<br/>validateSummary · auditComment"]
            m1 --> h1
        end

        subgraph app2["apps/forge-apple-2"]
            m2["manifest.yml<br/>validator · condition · post function"]
            h2["src/index.js<br/>validateRequired · auditCommentAndLabel"]
            m2 --> h2
        end

        scripts["scripts/<br/>pack-common.sh · deploy-all.sh"]
    end

    h1 -- "import '@vinod/forge-common'" --> index
    h2 -- "import '@vinod/forge-common'" --> index
    scripts -. "test · pack · install · deploy" .-> lib & app1 & app2
```

| Component | Responsibility | Knows about Jira? | Knows about Forge? |
|---|---|---|---|
| `validators.js` | Decide whether data is valid | Only the `{result, errorMessage}` shape | No |
| `adf.js` | Build comment bodies in Atlassian Document Format | ADF format only | No |
| `jira.js` | Call the Jira REST API | Yes | Yes (`@forge/api`) |
| App `src/index.js` | Translate Jira workflow events into library calls | Event payloads | Yes (handler signatures) |
| App `manifest.yml` | Tell Jira which rules exist and which handler runs each one | Yes | Yes |

Keeping `validators.js` and `adf.js` free of Forge calls makes them trivial to test and reuse anywhere.

---

## 3. How the library gets into each app

Forge bundles only files that are **inside the app folder**. A folder link created by
`npm install ../../packages/forge-common` is a symlink pointing *outside* the app, so it breaks `forge tunnel`.
Instead, the library is shipped as an npm **tarball** and each app installs a real copy of it.

```mermaid
flowchart LR
    src["packages/forge-common/src/*.js"] -->|"npm test"| ok{"26 tests pass?"}
    ok -- no --> stop["STOP<br/>nothing is packed"]
    ok -- yes --> pack["npm pack"]
    pack --> tgz["dist/vinod-forge-common-1.0.0.tgz<br/>(package.json + 5 src files)"]
    tgz -->|"npm install tgz"| nm1["apps/forge-apple-1/node_modules/@vinod/forge-common"]
    tgz -->|"npm install tgz"| nm2["apps/forge-apple-2/node_modules/@vinod/forge-common"]
    nm1 -->|"forge deploy<br/>bundles src + node_modules"| cloud1["Atlassian cloud<br/>forge-apple-1 (development)"]
    nm2 -->|"forge deploy"| cloud2["Atlassian cloud<br/>forge-apple-2 (development)"]
```

Key points:

- **`"files": ["src"]`** in the library's `package.json` keeps tests out of the tarball.
- **The version is in the file name**, e.g. `vinod-forge-common-1.1.0.tgz`, so bumping the version produces a new artifact.
- **`@forge/api` is a peer dependency.** The library does not ship its own copy; each app provides it,
  so there is exactly one `@forge/api` per bundle.
- **`scripts/deploy-all.sh` automates the whole diagram**, for both apps, in one command.

---

## 4. Runtime: what happens during a transition

A Jira workflow transition can run three kinds of Forge rules. They run at different times:

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant J as Jira
    participant C as Condition<br/>(Jira expression)
    participant V as Validator<br/>(app handler)
    participant L as @vinod/forge-common
    participant P as Post function<br/>(app handler)

    U->>J: Opens issue
    J->>C: Evaluate expression
    C-->>J: true / false
    Note over J: false → transition button hidden

    U->>J: Clicks "In Progress"
    J->>V: invoke({ issue, transition })
    V->>L: getIssue() + validateXxx()
    L->>J: GET /rest/api/3/issue/{key}
    J-->>L: fields
    L-->>V: { result, errorMessage }
    V-->>J: { result, errorMessage }
    Note over J: result=false → transition blocked, message shown

    J->>J: Status changes to In Progress
    J-)P: invoke({ issue, transition }) (async)
    P->>L: addComment() [+ setLabel()]
    L->>J: POST /comment, PUT /issue
    Note over U,J: Comment appears a few seconds later
```

| Rule type | Runs | Implemented as | Can block? | Return value |
|---|---|---|---|---|
| **Condition** | When the issue is viewed | Jira expression in `manifest.yml` (no code) | Hides the transition | Boolean |
| **Validator** | When the user attempts the transition | App function | Yes, with a message | `{ result, errorMessage? }` |
| **Post function** | After the transition, asynchronously | App function | No | Ignored; errors go to `forge logs` |

### The rules in each app

```mermaid
flowchart LR
    subgraph FA1["Workflow: Forge Apple 1 · To Do → In Progress"]
        c1["Condition<br/>issue.assignee.accountId == user.accountId"] --> v1["Validator<br/>validateSummaryLength(summary, 10)"] --> p1["Post function<br/>addComment('Forge Apple 1 transition executed')"]
    end
    subgraph FA2["Workflow: Forge Apple 2 · To Do → In Progress"]
        c2["Condition<br/>issue.labels.length > 0"] --> v2["Validator<br/>validateRequiredFields(['description','priority'])"] --> p2["Post function<br/>addComment(...) + setLabel('forge-apple-2-processed')"]
    end
```

---

## 5. How the two apps relate

The apps **do not call each other**. Forge has no app-to-app calls, and each app has its own ID,
scopes, storage and deployment. They share:

```mermaid
flowchart TB
    lib["@vinod/forge-common<br/>(shared CODE, copied at build time)"]
    a1["forge-apple-1"]
    a2["forge-apple-2"]
    jira[("Jira site<br/>issues · comments · labels · workflows<br/>(shared DATA)")]
    lib --> a1 & a2
    a1 <--> jira
    a2 <--> jira
```

| Shared? | What |
|---|---|
| ✅ Code | `@vinod/forge-common`; each app holds an identical copy |
| ✅ Jira data | Both apps read and write the same issues, comments and labels |
| ✅ Workflows | One workflow can contain rules from both apps (README §5.2) |
| ❌ Forge Storage | Private to each app |
| ❌ Function calls | No direct app-to-app calls |

If the apps ever need to exchange data, the recommended route is through Jira, e.g. **issue properties**.
Add `getIssueProperty` and `setIssueProperty` to `jira.js` once, and both apps can use them.

---

## 6. Design decisions

| Decision | Why |
|---|---|
| Tarball instead of folder link or workspaces | Forge only bundles files inside the app folder; tunnel and deploy break with symlinks |
| `@forge/api` as a peer dependency | Avoids two copies in one bundle; the app controls the version |
| `api.asApp()` instead of `asUser()` | Validators and post functions are invoked by Jira with no interactive user session |
| `route` tagged template | Forge requires it; it URL-encodes values and prevents path injection |
| Validators **fail closed** | If Jira cannot be read, block the transition instead of letting bad data through |
| Validators read `transition.modifiedFields` first | Values typed on a transition screen are not saved yet; this checks what the user entered |
| `setLabel` uses `update.labels.add` | `fields.labels` would replace all labels; `add` keeps existing ones |
| Conditions are Jira expressions | Evaluated by Jira itself: instant, no function invocation cost |
| `LIB_VERSION` in every comment, enforced to match `package.json` | Visible proof of which library build each app is running |
| Minimal scopes `read:jira-work`, `write:jira-work` | Least privilege: just enough to read issues and write comments and labels |

---

## 7. Environments and site

| Item | Value |
|---|---|
| Jira site | `vinodsirii.atlassian.net` |
| Forge account | `vinodsirii.228@gmail.com` (app owner and site admin) |
| Environment | `development` |
| forge-apple-1 app ID | `fbb12828-bdc6-4e33-86f8-66e98d5b305a` |
| forge-apple-2 app ID | `9da1f2d9-37e1-4a3a-a000-c0ed5ff96d6f` |
| Runtime | `nodejs22.x`, arm64, 256 MB |
