import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AmhStore } from "../store/interface.js";
import { readMemory } from "../operations/read.js";
import type { ReadContext } from "../operations/read.js";
import { requireTrustedCaller } from "../governance/caller.js";

export function registerAmhResources(
  server: McpServer,
  store: AmhStore,
  readContext: ReadContext = {}
): void {
  server.resource(
    "amh-memory",
    new ResourceTemplate("amh://{namespace}/{memory_id}", { list: undefined }),
    async (uri, variables) => {
      requireTrustedCaller(readContext.namespaceIsolation, readContext.callerNamespace);

      const namespace = String(variables.namespace ?? "");
      const memoryId = String(variables.memory_id ?? "");
      const record = await readMemory(memoryId, store, readContext);

      if (!record || record.namespace !== namespace) {
        return { contents: [] };
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: record.content.format,
            text: record.content.value,
          },
        ],
      };
    }
  );
}