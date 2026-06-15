import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

export const AMH_VERSION: string = JSON.parse(
  readFileSync(pkgPath, "utf-8")
).version as string;