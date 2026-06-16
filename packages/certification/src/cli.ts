#!/usr/bin/env node

import { createStore } from "@chibakuma/agent-memory-hall";
import { runCertification } from "./certifier.js";
import type { LayerId } from "./layers.js";

const args = process.argv.slice(2);
const storeType = (getFlag(args, "--store") ?? "sqlite") as "sqlite" | "json";
const storePath = getFlag(args, "--path");
const layerArg = getFlag(args, "--layers");
const targetLayers = layerArg
  ? layerArg.split(",").map(l => l.trim().toUpperCase() as LayerId)
  : undefined;

const store = createStore({ storeType, storePath: storePath ?? undefined });

console.log("ACA Certification Suite");
console.log("=======================\n");
console.log(`Store: ${storeType}${storePath ? ` (${storePath})` : " (default)"}`);
if (targetLayers) console.log(`Layers: ${targetLayers.join(", ")}`);
console.log("");

runCertification(store, targetLayers).then(result => {
  for (const layer of result.layers) {
    const icon = layer.passed ? "✅" : "❌";
    console.log(`${icon} ${layer.layerId}: ${layer.layerName} (${(layer.passRate * 100).toFixed(0)}%)`);
    for (const test of layer.tests) {
      const testIcon = test.passed ? "  ✓" : "  ✗";
      console.log(`${testIcon} ${test.name}${test.message ? ` — ${test.message}` : ""}`);
    }
    console.log("");
  }

  console.log("─".repeat(40));
  console.log(`Result: ${result.conformanceLevel}`);
  console.log(`Tests: ${result.summary.passed}/${result.summary.totalTests} passed (${(result.summary.passRate * 100).toFixed(0)}%)`);
  console.log(`Certified at: ${result.certifiedAt}`);

  process.exit(result.summary.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error("Certification failed:", err);
  process.exit(1);
});

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : undefined;
}
