# forge-apple-1

Jira workflow rules for the **Forge Apple 1** workflow. All logic comes from the shared library
[`@vinod/forge-common`](../../packages/forge-common). This app only wires Jira events to it.

| Rule (as shown in Jira) | Module | Implementation |
|---|---|---|
| FA1 – Condition: Only assignee can transition | `jira:workflowCondition` | Jira expression: `issue.assignee != null && issue.assignee.accountId == user.accountId` |
| FA1 – Validator: Summary length ≥ 10 | `jira:workflowValidator` | `validateSummary` → `validateSummaryLength(summary, 10)` |
| FA1 – Post function: Add audit comment | `jira:workflowPostFunction` | `auditComment` → `addComment(key, 'Forge Apple 1 transition executed')` |

## Commands (run in this folder)

```bash
npm install ../../packages/forge-common/dist/vinod-forge-common-<version>.tgz   # after ../../scripts/pack-common.sh
forge lint
forge deploy --non-interactive -e development
forge install --non-interactive --site vinodsirii.atlassian.net --product jira --environment development
forge logs -e development --since 15m
forge tunnel
```

See the [root README](../../README.md) for the test plan, and [docs/](../../docs) for architecture and the code walkthrough.
