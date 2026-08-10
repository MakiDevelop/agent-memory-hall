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

  /**
   * 2026-08-10 回歸：supersede 之後，舊筆的 blocker / artifact 不得再出現在接班視窗。
   * 這是 dogfood 時實際踩到的問題（memhall backend 上舊 blocker 爬回 open_blockers）。
   */
  it("drops blockers and artifacts that belong to a superseded record", async () => {
    const p = join(tmpdir(), `amh-boot-supersede-${Date.now()}.db`);
    const dir = join(tmpdir(), `amh-boot-supersede-art-${Date.now()}`);
    const stalePath = join(dir, "STALE.md");
    mkdirSync(dir, { recursive: true });
    writeFileSync(stalePath, "# stale\n");

    const store = new SqliteStore(p);
    const gate = {
      writeGate: true,
      namespaceIsolation: false,
      dedup: true,
      antiOuroboros: false,
    };
    const base = {
      agent_id: "claude",
      namespace: "project:boot-supersede",
      memory_type: "lesson" as const,
      source_type: "agent" as const,
      source_ref: "",
      source_tier: "llm_derived" as const,
    };

    const old = await writeMemory(
      {
        ...base,
        content:
          `[state boot-supersede 2026-08-10] 舊狀態\nstatus: open\n` +
          `next: 舊的下一步\nblocker: 已作廢的阻塞\nartifact: ${stalePath}`,
      },
      store,
      gate
    );
    await writeMemory(
      {
        ...base,
        content:
          "[state boot-supersede 2026-08-10] 新狀態\nstatus: open\n" +
          "next: 新的下一步\nblocker: 無\nartifact: ⏭️ none",
        supersedes: old.memory_id,
      },
      store,
      gate
    );

    const boot = await bootSession(
      { namespace: "project:boot-supersede", limit: 5 },
      store,
      { namespaceIsolation: false },
      "sqlite"
    );

    assert.equal(
      boot.open_blockers.some((b) => b.includes("已作廢的阻塞")),
      false,
      "已 supersede 的 blocker 不應出現在 open_blockers"
    );
    assert.equal(
      boot.artifacts.some((a) => a.path === stalePath),
      false,
      "已 supersede 的 artifact 不應出現在 artifacts"
    );
    assert.equal(
      boot.next_actions.some((n) => n.includes("舊的下一步")),
      false,
      "已 supersede 的 next 不應出現在 next_actions"
    );
    assert.ok(boot.next_actions.some((n) => n.includes("新的下一步")));

    unlinkSync(p);
  });
});
