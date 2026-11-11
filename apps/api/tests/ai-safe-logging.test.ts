import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

describe("AI Safe Logging Static Guarantee (Step 127)", () => {
  it("ensures no console.log or logger call in AI modules logs sensitive prompt, message, answer, image, or secret payloads", () => {
    const aiDir = path.join(apiRoot, "src/modules/ai");
    const inspAiDir = path.join(apiRoot, "src/modules/inspections/ai");
    const files = [...walkTsFiles(aiDir), ...walkTsFiles(inspAiDir)];

    expect(files.length).toBeGreaterThan(5);

    const forbiddenArgs = /\b(prompt|answer|toolResult|toolOutput|dataUrl|base64|secret|apiKey|password)\b/i;

    const violations: string[] = [];

    for (const file of files) {
      // Allowlist: ai-logger.ts defines the type fields
      if (file.endsWith("ai-logger.ts")) continue;

      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        const isLogCall = /\b(console\.(log|warn|error|info)|logger\.(info|warn|error|debug))\s*\(/.test(line);
        if (isLogCall && forbiddenArgs.test(line)) {
          violations.push(`${path.basename(file)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations, `Forbidden logging variables detected:\n${violations.join("\n")}`).toEqual([]);
  });
});
