#!/usr/bin/env node
/**
 * Download product CSVs whose licence is too unclear to commit.
 * Checks each file against the sha256 in corpus/SOURCES.md.
 * Not part of npm test. Writes corpus/cache/<sha256>.csv.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const sources = readFileSync(join(root, "corpus", "SOURCES.md"), "utf8");
const heading = sources.indexOf("## Unclear licence");
if (heading < 0) {
  process.stderr.write("fetch-corpus: corpus/SOURCES.md has no unclear-licence section\n");
  process.exit(1);
}
const entries = [];
for (const line of sources.slice(heading).split("\n")) {
  const match = line.match(/^\| (https:\S+) \| ([0-9a-f]{64}) \|$/);
  if (match) entries.push({ url: match[1], sha256: match[2] });
}
if (entries.length === 0) {
  process.stderr.write("fetch-corpus: no unclear-licence rows\n");
  process.exit(1);
}

const cache = join(root, "corpus", "cache");
mkdirSync(cache, { recursive: true });

let failed = 0;
for (const entry of entries) {
  const response = await fetch(entry.url);
  if (!response.ok) {
    process.stderr.write(`fetch-corpus: ${response.status} ${entry.url}\n`);
    failed += 1;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== entry.sha256) {
    process.stderr.write(`fetch-corpus: sha256 mismatch for ${entry.url}\n`);
    process.stderr.write(`  expected ${entry.sha256}\n`);
    process.stderr.write(`  actual   ${sha256}\n`);
    failed += 1;
    continue;
  }
  writeFileSync(join(cache, `${sha256}.csv`), bytes);
  process.stdout.write(`${sha256}  ${entry.url}\n`);
}
if (failed > 0) process.exit(1);
process.stdout.write(`${entries.length} files in corpus/cache\n`);
