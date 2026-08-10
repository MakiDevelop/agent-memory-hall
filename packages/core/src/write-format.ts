/**
 * `amh write` 的 content 格式化。
 *
 * 從 cli.ts 抽出，讓格式本身可被測試（cli.ts 有 top-level dispatch，無法直接 import）。
 *
 * 2026-08-10 v1.5.0 修正三個缺陷（全庫體檢 419 筆發現）：
 *   1. `next: ${raw}` 把整段內容再貼一次 —— 272 筆重複，佔全庫 27% 字元
 *   2. 呼叫端已自帶 `[state …]` 標頭時仍疊一層 auto prefix —— 216 筆雙重 prefix
 *   3. `blocker` 寫死「無」，CLI 無對應參數
 *
 * 2026-08-10 Codex review 後續修正：
 *   4. 標頭偵測原本匹配任意 `[...]`，但 latest 只認得 STATE_TAG_PREFIXES 那幾種，
 *      導致 `[memory note] …` 這類內容不補 `[state auto]` 又不被 latest 認成 state。
 *      改為共用 state-markers.ts（發現 #1）
 *   5. `--next` / `--blocker` / `--status-label` / `--artifact` 未擋換行，
 *      可注入偽造欄位（例如 --next "a\nblocker: 假的"）。改為明確拒絕（發現 #2）
 *   6. body 做了 `.trim()` 會吃掉第一層縮排，破壞 markdown code block / YAML。
 *      改為只用 trim 判空，輸出保留原縮排（發現 #3）
 */

import { hasStateTag } from "./state-markers.js";

function stripTag(line: string): string {
  return line.replace(/^\[[^\]\n]+\]\s*/, "").trim();
}

/**
 * 欄位值必須單行 —— 換行會被 boot/latest 解析成另一個欄位。
 * 靜默替換會讓呼叫端以為寫成功了，所以這裡選擇 fail-loud。
 */
function requireSingleLine(
  value: string | undefined,
  flag: string
): string | undefined {
  if (value === undefined) return undefined;
  if (/[\r\n]/.test(value)) {
    throw new Error(
      `${flag} must be a single line — a line break would be parsed as another field. ` +
        `Move the detail into the content body instead.`
    );
  }
  return value.trim();
}

export function formatWriteContent(
  raw: string,
  kind: string | undefined,
  statusLabel: string | undefined,
  artifact: string | undefined,
  next?: string,
  blocker?: string
): string {
  if (!kind && !statusLabel && !artifact) return raw;
  const k = kind ?? "memory";
  const date = new Date().toISOString().slice(0, 10);

  const safeStatus = requireSingleLine(statusLabel, "--status-label");
  const safeArtifact = requireSingleLine(artifact, "--artifact");
  const safeNext = requireSingleLine(next, "--next");
  const safeBlocker = requireSingleLine(blocker, "--blocker");

  if (k === "state") {
    // CRLF 正規化，避免殘留的 \r 混進欄位行
    const lines = raw.replace(/\r\n?/g, "\n").split("\n");
    const first = (lines[0] ?? raw).trim();

    // 只有 latest/boot 認得的標頭才算「已自帶」，否則仍補 [state auto]
    const headline = hasStateTag(first)
      ? first
      : `[state auto ${date}] ${first}`;

    // 保留第一層縮排：只砍開頭空行與結尾空白，不動行首縮排
    const rawBody = lines.slice(1).join("\n");
    const body = rawBody.replace(/^\n+/, "").replace(/\s+$/, "");

    // next 預設：第一行去標頭；標頭無正文時退到 body 第一個非空行
    let nextValue = safeNext ?? stripTag(first);
    if (!nextValue) {
      nextValue = body.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
    }
    if (!nextValue) {
      throw new Error(
        "--kind state needs a headline or --next: the content carried only a [tag] with no text."
      );
    }

    const out = [
      headline,
      `status: ${safeStatus ?? "open"}`,
      `next: ${nextValue}`,
      `blocker: ${safeBlocker || "無"}`,
      `artifact: ${safeArtifact ?? "⏭️ none"}`,
    ];
    // 完整內文只保留一份，接在欄位區之後（過去是整段塞進 next:）
    if (body) out.push("", body);
    return out.join("\n");
  }

  if (k === "pointer") {
    if (!safeArtifact) {
      throw new Error("--kind pointer requires --artifact <absolute-path>");
    }
    return `[pointer auto ${date}] ${raw}\nartifact: ${safeArtifact}`;
  }

  return raw;
}
