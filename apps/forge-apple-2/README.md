# forge-apple-2

Jira workflow rules for the **Forge Apple 2** workflow. All logic comes from the shared library
[`@vinod/forge-common`](../../packages/forge-common). This app only wires Jira events to it.

| Rule (as shown in Jira) | Module | Implementation |
|---|---|---|
| FA2 – Issue must have a label | `jira:workflowCondition` | Jira expression: `issue.labels.length > 0` |
| FA2 – Description and priority required | `jira:workflowValidator` | `validateRequired` → `validateRequiredFields(fields, ['description', 'priority'])` |
| FA2 – Add audit comment + label | `jira:workflowPostFunction` | `auditCommentAndLabel` → `addComment(...)` + `setLabel(key, 'forge-apple-2-processed')` |

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
