# AMH Dogfood Acceptance — Codex Briefing

You are validating that Codex can use **AMH CLI** for session handoff without memhall HTTP.

## Constraints

- **Do NOT** use `curl`, memhall HTTP (`:9100`), or `MH_API_TOKEN`
- Work only inside this repo workspace
- Use `npx @chibakuma/agent-memory-hall` if `amh` is not in PATH

## Task (execute in order)

### Step 1 — Read existing handoff (may be empty)

```bash
npx @chibakuma/agent-memory-hall --store json --path ./.amh/handoff.json \
  --caller-ns project:agent-memory-hall \
  read --agent codex --ns project:agent-memory-hall --limit 5
```

### Step 2 — Write a new handoff

Write a concrete fact about this acceptance run. Include today's date and a unique marker `ACCEPTANCE-RUN-001`.

```bash
npx @chibakuma/agent-memory-hall --store json --path ./.amh/handoff.json \
  --caller-ns project:agent-memory-hall \
  write --agent codex --ns project:agent-memory-hall --type fact \
  "ACCEPTANCE-RUN-001: Codex AMH dogfood verified via npx on $(date -u +%Y-%m-%d). No memhall HTTP used."
```

### Step 3 — Read back and confirm

Re-run the read command from Step 1. Confirm the output contains `ACCEPTANCE-RUN-001`.

### Step 4 — Report

Reply with a short JSON block:

```json
{
  "verdict": "PASS or FAIL",
  "read_before_count": <number>,
  "read_after_contains_marker": true/false,
  "used_memhall_http": false,
  "command_used": "npx @chibakuma/agent-memory-hall"
}
```

If any step fails, set verdict to FAIL and explain which step failed.