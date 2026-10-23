# __APP_NAME__

Jira workflow rules for the **__WORKFLOW_NAME__** workflow, migrated from Jira Data Center.
All logic comes from the shared library [`@vinod/forge-common`](../../packages/forge-common).
This app only wires Jira events to it.

| Rule (as shown in Jira) | Module | Replaces DC rule | Implementation |
|---|---|---|---|
| __PREFIX__ – Condition: … | `jira:workflowCondition` | _from inventory_ | Jira expression: `…` |
| __PREFIX__ – Validator: … | `jira:workflowValidator` | _from inventory_ | `handler` → library function |
| __PREFIX__ – Post function: … | `jira:workflowPostFunction` | _from inventory_ | `handler` → library function |

## Commands (run in this folder)

```bash
forge lint
forge deploy --non-interactive -e development
forge install --non-interactive --site <site>.atlassian.net --product jira --environment development
forge logs -e development --since 15m
```

See [docs/MIGRATION-PLAN.md](../../docs/MIGRATION-PLAN.md) for the full process.
