#!/usr/bin/env node
/**
 * Lint every CSV matched by INPUT_FILES and pass the JSON reports to
 * scripts/gh-annotations.mjs. Used by the composite action.
 *
 * INPUT_MAX_WARNINGS, when set, is forwarded as --max-warnings (per file).
 * INPUT_FAIL_ON_WARNINGS=true with an empty cap is --max-warnings 0.
 * INPUT_ANNOTATIONS=false skips workflow commands. The summary is still written.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const SKIP_DIRS = new Set(["node_modules", ".git"]);

export function globToRegExp(pattern) {
  const normalized = String(pattern).replace(/\\/g, "/").replace(/^\.\//, "");
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*") {
      if (normalized[index + 1] === "*") {
        const slashAfter = normalized[index + 2] === "/";
        if (slashAfter) {
          index += 2;
          source += "(?:.*/)?";
        } else {
          index += 1;
          source += ".*";
        }
        continue;
      }
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    if (/[\\^$+?.()|{}\[\]]/.test(char)) source += `\\${char}`;
    else source += char;
  }
  source += "$";
  return new RegExp(source);
}

export function matchGlob(pattern, relPath) {
  return globToRegExp(pattern).test(String(relPath).replace(/\\/g, "/"));
}

function matchDirect(root, pattern) {
  if (/[*?]/.test(pattern)) return null;
  const full = resolve(root, pattern);
  let info;
  try {
    info = statSync(full);
  } catch {
    return [];
  }
  if (!info.isFile()) return [];
  const rel = relative(root, full);
  if (rel === "" || rel.startsWith(`..${sep}`) || rel === "..") return [];
  return [rel.split(sep).join("/")];
}

function walk(root, dir, regex, matches) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(root, full, regex, matches);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = relative(root, full).split(sep).join("/");
    if (regex.test(rel)) matches.push(rel);
  }
}

export function listFiles(root, pattern) {
  const resolvedRoot = resolve(root);
  const direct = matchDirect(resolvedRoot, pattern);
  if (direct) return direct;
  const regex = globToRegExp(pattern);
  const matches = [];
  walk(resolvedRoot, resolvedRoot, regex, matches);
  matches.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  return matches;
}

export function warningArgs(maxWarnings, failOnWarnings) {
  const max = String(maxWarnings ?? "").trim();
  const fail = String(failOnWarnings ?? "").trim().toLowerCase() === "true";
  if (max !== "") {
    if (!/^\d+$/.test(max)) {
      return { error: "catalog-csv-lint: --max-warnings needs a non-negative integer", args: [] };
    }
    return { error: "", args: ["--max-warnings", max] };
  }
  if (fail) return { error: "", args: ["--max-warnings", "0"] };
  return { error: "", args: [] };
}

function resolveCli() {
  const override = process.env.CATALOG_CSV_LINT;
  if (override) {
    if (override.endsWith(".js")) return [process.execPath, override];
    return [override];
  }
  const candidates = [];
  if (process.env.GITHUB_ACTION_PATH) {
    candidates.push(join(process.env.GITHUB_ACTION_PATH, "dist", "cli.js"));
  }
  candidates.push(join(repoRoot, "dist", "cli.js"));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return [process.execPath, candidate];
  }
  return ["catalog-csv-lint"];
}

function jsonBlock(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function cliOutput(file, result) {
  if (result.error) return jsonBlock({ schemaVersion: 1, file, error: `catalog-csv-lint: ${result.error.message}` });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const detail = (stderr || stdout || `exited ${result.status ?? "unknown"}`).trim() || "produced no JSON report";
    const error = detail.startsWith("catalog-csv-lint:") ? detail : `catalog-csv-lint: ${detail}`;
    return jsonBlock({ schemaVersion: 1, file, error });
  }
  if (typeof parsed.error === "string" && typeof parsed.file !== "string") {
    parsed.file = file;
    return jsonBlock(parsed);
  }
  return stdout.endsWith("\n") ? stdout : `${stdout}\n`;
}

function spawnAnnotations(args) {
  const script = join(scriptDir, "gh-annotations.mjs");
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.stdout) writeSync(1, result.stdout);
  if (result.stderr) writeSync(2, result.stderr);
  if (result.error) {
    writeSync(2, `${result.error.message}\n`);
    return 1;
  }
  return result.status === 0 ? 0 : 1;
}

export function run() {
  const pattern = (process.env.INPUT_FILES ?? "").trim() || "**/*.csv";
  const annotations = (process.env.INPUT_ANNOTATIONS ?? "true").trim().toLowerCase() !== "false";
  const limit = warningArgs(process.env.INPUT_MAX_WARNINGS ?? "", process.env.INPUT_FAIL_ON_WARNINGS ?? "");
  const args = ["--pattern", pattern];
  if (!annotations) args.push("--no-annotations");

  if (limit.error) {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-"));
    const reportPath = join(dir, "error.json");
    writeFileSync(reportPath, jsonBlock({ schemaVersion: 1, error: limit.error }));
    args.push(reportPath);
    return spawnAnnotations(args);
  }

  const root = resolve(process.env.GITHUB_WORKSPACE || process.cwd());
  const files = listFiles(root, pattern);
  if (files.length === 0) return spawnAnnotations(args);

  const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-"));
  const cli = resolveCli();
  files.forEach((file, index) => {
    const reportPath = join(dir, `${String(index).padStart(4, "0")}.json`);
    const result = spawnSync(cli[0], [...cli.slice(1), "--json", file, ...limit.args], {
      cwd: root,
      encoding: "utf8",
      env: process.env,
    });
    writeFileSync(reportPath, cliOutput(file, result));
    args.push(reportPath);
  });
  return spawnAnnotations(args);
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    process.exitCode = run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeSync(2, `${message}\n`);
    process.exitCode = 1;
  }
}
