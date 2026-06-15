import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, ConfigLoadError } from "./config.js";

describe("loadConfig", () => {
  it("throws ConfigLoadError on invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-config-"));
    const path = join(dir, "config.json");
    await writeFile(path, "{not json", "utf-8");

    await assert.rejects(() => loadConfig(path), ConfigLoadError);

    await rm(dir, { recursive: true });
  });

  it("throws ConfigLoadError on schema violation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-config-"));
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify({ store: "invalid-backend" }), "utf-8");

    await assert.rejects(() => loadConfig(path), ConfigLoadError);

    await rm(dir, { recursive: true });
  });

  it("returns empty config when file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "amh-config-"));
    const path = join(dir, "missing.json");
    const config = await loadConfig(path);
    assert.deepEqual(config, {});
    await rm(dir, { recursive: true });
  });
});