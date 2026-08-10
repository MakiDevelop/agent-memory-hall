import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatWriteContent } from "./write-format.js";
import { isStateLike } from "./operations/latest.js";

const TODAY = new Date().toISOString().slice(0, 10);

describe("formatWriteContent", () => {
  it("returns raw untouched when no kind/status/artifact given", () => {
    const raw = "plain memory\nwith two lines";
    assert.equal(formatWriteContent(raw, undefined, undefined, undefined), raw);
  });

  describe("kind=state", () => {
    it("does NOT duplicate the whole body into next: (2026-08-10 regression)", () => {
      const raw = [
        "NAPL 月度交付驗證完成，10 份 CSV 已上傳",
        "細節第二行",
        "細節第三行",
      ].join("\n");
      const out = formatWriteContent(raw, "state", "done", "/tmp/handoff");

      const nextLine = out.split("\n").find((l) => l.startsWith("next:"))!;
      // next: 必須是單行，不得含後續內文
      assert.equal(nextLine.includes("細節第二行"), false);
      assert.equal(nextLine, "next: NAPL 月度交付驗證完成，10 份 CSV 已上傳");

      // 完整內文只出現一次
      assert.equal(out.split("細節第三行").length - 1, 1);
    });

    it("keeps the trailing body exactly once", () => {
      const raw = "headline\nbody-a\nbody-b";
      const out = formatWriteContent(raw, "state", "open", undefined);
      assert.equal(out.split("body-a").length - 1, 1);
      assert.equal(out.split("body-b").length - 1, 1);
      assert.ok(out.endsWith("body-a\nbody-b"));
    });

    it("does not stack a second prefix when caller already supplied one", () => {
      const raw = "[state cmoney-iam 2026-08-10] 權限已收斂";
      const out = formatWriteContent(raw, "state", "done", undefined);
      assert.equal(out.split("\n")[0], raw);
      assert.equal(out.includes("[state auto"), false);
    });

    it("adds an auto prefix when the caller supplied none", () => {
      const out = formatWriteContent("裸標題", "state", "open", undefined);
      assert.equal(out.split("\n")[0], `[state auto ${TODAY}] 裸標題`);
    });

    it("strips the caller tag from the default next: value", () => {
      const raw = "[state foo 2026-08-10] 下一步是跑 smoke test";
      const out = formatWriteContent(raw, "state", "open", undefined);
      assert.equal(
        out.split("\n").find((l) => l.startsWith("next:")),
        "next: 下一步是跑 smoke test"
      );
    });

    it("honours an explicit --next", () => {
      const out = formatWriteContent(
        "結論一句話\n很多內文",
        "state",
        "blocked",
        undefined,
        "等 Maki 確認 TTL 策略"
      );
      assert.equal(
        out.split("\n").find((l) => l.startsWith("next:")),
        "next: 等 Maki 確認 TTL 策略"
      );
    });

    it("honours an explicit --blocker and defaults to 無", () => {
      const withBlocker = formatWriteContent(
        "x",
        "state",
        "blocked",
        undefined,
        undefined,
        "等 Drive 1.9G 上傳"
      );
      assert.ok(withBlocker.includes("blocker: 等 Drive 1.9G 上傳"));

      const noBlocker = formatWriteContent("x", "state", "open", undefined);
      assert.ok(noBlocker.includes("blocker: 無"));
    });

    it("emits the field block in the order boot/latest parse", () => {
      const out = formatWriteContent("x", "state", "done", "/abs/p.md");
      const lines = out.split("\n");
      assert.equal(lines[1], "status: done");
      assert.ok(lines[2]!.startsWith("next: "));
      assert.ok(lines[3]!.startsWith("blocker: "));
      assert.equal(lines[4], "artifact: /abs/p.md");
    });

    it("defaults artifact to the skip marker", () => {
      const out = formatWriteContent("x", "state", "open", undefined);
      assert.ok(out.includes("artifact: ⏭️ none"));
    });
  });

  // Codex review 2026-08-10 findings
  describe("kind=state — marker alignment with latest.isStateLike (finding #1)", () => {
    it("still adds [state auto] when the caller tag is NOT latest-recognised", () => {
      // [memory …] 不在 STATE_TAG_PREFIXES 內；不補 prefix 會讓 latest 漏掉這筆
      const out = formatWriteContent("[memory note] 標題", "state", "open", undefined);
      assert.ok(out.startsWith(`[state auto ${TODAY}] [memory note] 標題`));
      assert.equal(isStateLike(out), true);
    });

    it("keeps every latest-recognised tag untouched", () => {
      for (const tag of ["[state ", "[wrap-up ", "[handoff ", "[save ", "[checkpoint "]) {
        const raw = `${tag}slug 2026-08-10] 標題`;
        const out = formatWriteContent(raw, "state", "open", undefined);
        assert.equal(out.split("\n")[0], raw, `tag ${tag} should not be re-prefixed`);
        assert.equal(isStateLike(out), true);
      }
    });

    it("produces state-like output for a bare headline", () => {
      const out = formatWriteContent("裸標題", "state", "open", undefined);
      assert.equal(isStateLike(out), true);
    });
  });

  describe("kind=state — single-line field enforcement (finding #2)", () => {
    it("rejects a --next containing a line break instead of injecting a field", () => {
      assert.throws(
        () =>
          formatWriteContent("x", "state", "open", undefined, "做 A\nblocker: 假的阻塞"),
        /--next must be a single line/
      );
    });

    it("rejects a multi-line --blocker", () => {
      assert.throws(
        () =>
          formatWriteContent("x", "state", "open", undefined, undefined, "a\nstatus: done"),
        /--blocker must be a single line/
      );
    });

    it("rejects multi-line --status-label and --artifact", () => {
      assert.throws(
        () => formatWriteContent("x", "state", "open\nnext: hijack", undefined),
        /--status-label must be a single line/
      );
      assert.throws(
        () => formatWriteContent("x", "state", "open", "/p\nblocker: hijack"),
        /--artifact must be a single line/
      );
    });

    it("emits exactly one of each field for well-formed input", () => {
      const out = formatWriteContent("標題\n內文", "state", "done", "/p", "下一步", "阻塞");
      for (const field of ["status:", "next:", "blocker:", "artifact:"]) {
        const hits = out.split("\n").filter((l) => l.startsWith(field));
        assert.equal(hits.length, 1, `${field} should appear once`);
      }
    });
  });

  describe("kind=state — body fidelity (finding #3)", () => {
    it("preserves first-level indentation in the body", () => {
      const raw = "標題\n    indented code\n    still indented";
      const out = formatWriteContent(raw, "state", "open", undefined);
      assert.ok(out.includes("\n    indented code\n    still indented"));
    });

    it("keeps a fenced code block intact", () => {
      const raw = ["標題", "```python", "def f():", "    return 1", "```"].join("\n");
      const out = formatWriteContent(raw, "state", "open", undefined);
      assert.ok(out.endsWith("```python\ndef f():\n    return 1\n```"));
    });

    it("normalises CRLF so no \\r leaks into the field block", () => {
      const out = formatWriteContent("標題\r\n內文", "state", "done", "/p");
      assert.equal(out.includes("\r"), false);
      assert.equal(out.split("\n")[1], "status: done");
    });
  });

  describe("kind=state — degenerate content", () => {
    it("falls back to the first body line when the headline is tag-only", () => {
      const out = formatWriteContent("[state foo 2026-08-10]\n真正的內文", "state", "open", undefined);
      assert.equal(
        out.split("\n").find((l) => l.startsWith("next:")),
        "next: 真正的內文"
      );
    });

    it("throws when there is a tag and nothing else", () => {
      assert.throws(
        () => formatWriteContent("[state foo 2026-08-10]", "state", "open", undefined),
        /needs a headline or --next/
      );
    });
  });

  describe("kind=memory", () => {
    it("returns raw unchanged even when status/artifact are supplied", () => {
      const raw = "just a memory\n    with indentation";
      assert.equal(formatWriteContent(raw, "memory", "open", "/p"), raw);
    });
  });

  describe("kind=pointer", () => {
    it("requires an artifact", () => {
      assert.throws(
        () => formatWriteContent("handoff ready", "pointer", undefined, undefined),
        /--kind pointer requires --artifact/
      );
    });

    it("formats pointer content unchanged from v1.4.0", () => {
      const out = formatWriteContent(
        "handoff ready",
        "pointer",
        undefined,
        "/abs/README.md"
      );
      assert.equal(
        out,
        `[pointer auto ${TODAY}] handoff ready\nartifact: /abs/README.md`
      );
    });
  });
});
