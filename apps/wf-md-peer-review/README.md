# wf-md-peer-review

Jira workflow rules for the **MD - Peer Review Workflow** workflow.
Function logic comes from the shared library [`@vinod/forge-common`](../../packages/forge-common).

| Rule (as shown in Jira) | Module | Logic | Only acts in this workflow? |
|---|---|---|---|
| MDPR – Condition: Reporter cannot review own work | `jira:workflowCondition` | Jira expression: hides the transition from the reporter | ✅ guarded by `workflow.name` |
| MDPR – Validator: Reviewer assigned (not the reporter) | `jira:workflowValidator` (expression) | The assignee (reviewer) must be set and differ from the reporter | ✅ guarded by `workflow.name` |
| MDPR – Validator: Description required for review | `jira:workflowValidator` (function) | `validateDescription` → `validateRequiredFields(fields, ['description'])` | ❌ functions receive no workflow name |
| MDPR – Post function: Record peer review | `jira:workflowPostFunction` | `recordPeerReview` → `addComment(...)` + `setLabel(key, 'md-peer-review')` | ❌ functions receive no workflow name |

## Why the rules still appear in other workflows

Jira lists **every installed app's rules in every workflow's "Add rule" dialog**.
Forge has no manifest setting to limit a rule to one workflow; the only filter is `projectTypes`.
This app therefore:

- names every rule `MDPR – …`, so admins can see it belongs to MD - Peer Review Workflow, and
- guards the Jira-expression rules with `workflow.name != 'MD - Peer Review Workflow' || …`,
  so they always pass (do nothing) if someone adds them to a different workflow.

The workflow name in `manifest.yml` must match the Jira workflow name **exactly**.
If the workflow is renamed, update the manifest and redeploy.

## Suggested placement

| Transition (example) | Rules |
|---|---|
| In Progress → In Review | Condition, both validators, post function |

## Commands (run in this folder)

```bash
forge lint
forge deploy --non-interactive -e development
forge install --non-interactive --site vinodsirii.atlassian.net --product jira --environment development
forge logs -e development --since 15m
```

See [docs/MIGRATION-PLAN.md](../../docs/MIGRATION-PLAN.md) for the overall process.
