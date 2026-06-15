# Codex AMH Handoff Guide

Codex should use the **local AMH CLI** (`amh`) instead of memhall HTTP API. No bearer token required.

## Prerequisites

```bash
# From repo (dev)
cd packages/core && npm run build && npm link

# Or after npm publish
npm install -g @chibakuma/agent-memory-hall

# Verify
amh --help
amh status
```

## Sandbox-safe store (Codex `workspace-write`)

`~/.amh/` may be outside the Codex sandbox. Use a workspace-local JSON store:

```bash
# Write handoff (namespace must match --caller-ns when isolation is on)
amh --store json --path ./.amh/handoff.json \
  --caller-ns project:<repo> \
  write --agent codex --ns project:<repo> --type fact "<concrete handoff content>"

# Read last handoff
amh --store json --path ./.amh/handoff.json \
  --caller-ns project:<repo> \
  read --agent codex --ns project:<repo> --limit 5
```

Add `.amh/` to `.gitignore` in each repo where Codex dogfoods AMH.

## Default store (non-sandbox / Maki machine)

SQLite default: `~/.amh/memory.db`

```bash
amh --caller-ns project:<repo> \
  write --agent codex --ns project:<repo> --type fact "<content>"

amh --caller-ns project:<repo> \
  read --agent codex --ns project:<repo> --limit 5
```

Optional config `~/.amh/config.json`:

```json
{
  "caller_namespace": "project:agent-memory-hall",
  "store": "sqlite",
  "store_path": "~/.amh/memory.db"
}
```

## Namespace conventions

| Namespace | Use |
|-----------|-----|
| `project:<repo>` | Project handoff / session state |
| `agent:codex` | Codex-specific prefs (caller-ns must match) |
| `shared` | Cross-project rules (use only when appropriate) |

**Rule:** `--caller-ns` must equal `--ns` when `namespace_isolation` is enabled (default).

## Briefing template snippet

Paste at the end of Codex briefings:

```markdown
## Session Handoff (AMH — required)

Do **not** call memhall HTTP API. Use local `amh` CLI only.

**Write (end of session):**
\`\`\`bash
amh --store json --path ./.amh/handoff.json --caller-ns project:<repo> \
  write --agent codex --ns project:<repo> --type fact "<what you did + next steps>"
\`\`\`

**Read (start of session):**
\`\`\`bash
amh --store json --path ./.amh/handoff.json --caller-ns project:<repo> \
  read --agent codex --ns project:<repo> --limit 5
\`\`\`

If `amh` is not in PATH: `npm link` from `packages/core` or `npx @chibakuma/agent-memory-hall`.
```

## Acceptance

Run the acceptance briefing shipped with this package:

```bash
codex exec --sandbox workspace-write --skip-git-repo-check \
  < node_modules/@chibakuma/agent-memory-hall/docs/codex-acceptance-briefing.md
```

Or from the git repo: `docs/codex-acceptance-briefing.md`