import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../store/sqlite.js";
import { writeMemory } from "./write.js";
import { bootSession } from "./boot.js";

describe("bootSession", () => {
  const dbPath = join(tmpdir(), `amh-boot-${Date.now()}.db`);
  const artDir = join(tmpdir(), `amh-boot-art-${Date.now()}`);
  const artPath = join(artDir, "README.md");

  it("returns latest + artifact exists + blockers", async () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    mkdirSync(artDir, { recursive: true });
    writeFileSync(artPath, "# handoff\n");

    const store = new SqliteStore(dbPath);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: false,
    };

    await writeMemory(
      {
        agent_id: "claude",
        namespace: "project:boot-demo",
        memory_type: "lesson",
        content: [
          "[state boot-demo 2026-07-24] mid work",
          "status: blocked",
          "next: finish tests",
          "blocker: need Maki sign-off",
          `artifact: ${artPath}`,
        ].join("\n"),
        source_type: "agent",
        source_ref: "",
        source_tier: "llm_derived",
      },
      store,
      gate
    );

    const boot = await bootSession(
      { namespace: "project:boot-demo", limit: 3 },
      store,
      { namespaceIsolation: false },
      "sqlite"
    );

    assert.equal(boot.mode, "boot");
    assert.ok(boot.primary);
    assert.ok(boot.open_blockers.some((b) => b.includes("Maki")));
    assert.ok(boot.artifacts.some((a) => a.path === artPath && a.exists));
    assert.ok(boot.next_actions.length >= 1);

    unlinkSync(dbPath);
  });
});
