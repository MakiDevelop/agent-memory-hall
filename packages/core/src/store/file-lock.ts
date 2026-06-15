import { open, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

const MAX_RETRIES = 50;
const RETRY_MS = 20;

function lockPath(filePath: string): string {
  return `${filePath}.lock`;
}

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const lock = lockPath(filePath);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const handle = await open(lock, "wx");
      await handle.close();
      try {
        return await fn();
      } finally {
        try {
          await unlink(lock);
        } catch {
          /* lock already removed */
        }
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }

  throw new Error(`Timed out acquiring file lock for ${filePath}`);
}