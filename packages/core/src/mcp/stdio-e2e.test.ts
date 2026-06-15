import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");

function parseToolText(result: unknown): unknown {
  const payload = result as { content?: Array<{ type: string; text?: string }> };
  const text = payload.content?.find((c) => c.type === "text")?.text;
  assert.ok(text, "expected text tool result");
  return JSON.parse(text);
}

describe("MCP stdio e2e", () => {
  it("write, read, forget, and audit over stdio transport", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-stdio-"));
    const storePath = join(dir, "handoff.json");
    const ns = "project:stdio-e2e";

    const transport = new StdioClientTransport({
      command: "node",
      args: [
        cliPath,
        "--store",
        "json",
        "--path",
        storePath,
        "--caller-ns",
        ns,
        "serve",
      ],
    });

    const client = new Client({ name: "amh-test", version: "0.0.1" });
    await client.connect(transport);

    try {
      const writeResult = await client.callTool({
        name: "amh_write",
        arguments: {
          agent_id: "codex",
          namespace: ns,
          memory_type: "fact",
          content: "stdio e2e handoff",
          source_type: "agent",
          source_ref: "",
          source_tier: "llm_derived",
        },
      });
      const written = parseToolText(writeResult) as { memory_id: string };
      assert.ok(written.memory_id);

      const readResult = await client.callTool({
        name: "amh_read",
        arguments: {
          memory_id: written.memory_id,
        },
      });
      const record = parseToolText(readResult) as { content: { value: string } };
      assert.equal(record.content.value, "stdio e2e handoff");

      const forgetResult = await client.callTool({
        name: "amh_forget",
        arguments: {
          memory_id: written.memory_id,
          revoked_by: "codex",
          reason: "e2e cleanup",
        },
      });
      const revoked = parseToolText(forgetResult) as { status: string };
      assert.equal(revoked.status, "revoked");

      const hiddenResult = await client.callTool({
        name: "amh_read",
        arguments: {
          memory_id: written.memory_id,
        },
      });
      const hiddenText = (hiddenResult as { content?: Array<{ text?: string }> }).content?.[0]?.text;
      assert.equal(hiddenText, "Not found");

      const auditResult = await client.callTool({
        name: "amh_audit",
        arguments: {
          memory_id: written.memory_id,
        },
      });
      const audit = parseToolText(auditResult) as Array<{ operation: string }>;
      assert.ok(audit.some((e) => e.operation === "revoke"));
    } finally {
      await client.close();
      await rm(dir, { recursive: true });
    }
  });
});