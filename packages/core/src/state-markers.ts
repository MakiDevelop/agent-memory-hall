/**
 * 「什麼算 state 標頭」的單一事實來源。
 *
 * 過去這份清單只存在於 operations/latest.ts 的 isStateLike，
 * 而 cli.ts 的 formatter 用另一套（任意 `[...]`）判斷，兩者不一致 ——
 * formatter 認為「已自帶標頭、不用補」的內容，latest 可能不認得，
 * 於是該筆 state 會被 preferStateMarkers 過濾掉（Codex review 2026-08-10 發現 #1）。
 *
 * 兩邊一律從這裡取，避免再漂移。
 */

export const STATE_TAG_PREFIXES = [
  "[state ",
  "[wrap-up ",
  "[wrap-up|",
  "[handoff ",
  "[save ",
  "[checkpoint ",
] as const;

/**
 * 該行是否已自帶「latest / boot 辨識得出」的 state 標頭。
 *
 * 只看標頭，不看 `status:` 之類的欄位內容 —— 那是 isStateLike 的職責。
 */
export function hasStateTag(line: string): boolean {
  const head = line.trimStart().slice(0, 80).toLowerCase();
  return STATE_TAG_PREFIXES.some((prefix) => head.startsWith(prefix));
}
