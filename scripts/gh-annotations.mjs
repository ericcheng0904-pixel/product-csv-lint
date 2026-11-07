#!/usr/bin/env node
/**
 * Turn catalog-csv-lint --json reports into GitHub workflow annotations
 * and a Markdown job summary.
 *
 * Annotations follow the workflow command syntax. The message escapes
 * %, CR, and LF. Property values also escape ":" and ",". "%" is encoded
 * first so the escapes themselves are not encoded again.
 * https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
 * https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
 *
 * Usage:
 *   node scripts/gh-annotations.mjs [--no-annotations] [--pattern GLOB] REPORT.json ...
 *   catalog-csv-lint --json FILE.csv | node scripts/gh-annotations.mjs
 *
 * Workflow commands are written to stdout. The Markdown summary is appended
 * to $GITHUB_STEP_SUMMARY. Totals are appended to $GITHUB_OUTPUT when that
 * file is set. Exit 1 when any report has errors or is over its warning limit.
 */
import { appendFileSync, readFileSync, realpathSync, writeSync } from "node:fs";
import { pathToFileURL } from "node:url";

function toCommandValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return String(value);
}

export function escapeData(value) {
  return toCommandValue(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export function escapeProperty(value) {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

export function workflowCommand(command, properties, message) {
  const parts = [];
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=${escapeProperty(value)}`);
  }
  const prefix = parts.length === 0 ? `::${command}` : `::${command} ${parts.join(",")}`;
  return `${prefix}::${escapeData(message ?? "")}`;
}

export function normalizeReport(value, fallbackFile = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      schemaVersion: 1,
      file: fallbackFile,
      error: "catalog-csv-lint: unrecognized JSON report",
    };
  }
  if (typeof value.error === "string") {
    return {
      schemaVersion: 1,
      file: typeof value.file === "string" ? value.file : fallbackFile,
      error: value.error,
    };
  }
  if (!Array.isArray(value.findings)) {
    return {
      schemaVersion: 1,
      file: typeof value.file === "string" ? value.file : fallbackFile,
      error: "catalog-csv-lint: unrecognized JSON report",
    };
  }
  return value;
}

export function reportFailed(report) {
  const normalized = normalizeReport(report);
  if (typeof normalized.error === "string") return true;
  if (typeof normalized.ok === "boolean") return !normalized.ok;
  const errors = Number(normalized.errorCount) || 0;
  const warnings = Number(normalized.warningCount) || 0;
  if (errors > 0) return true;
  if (
    normalized.maxWarnings !== null &&
    normalized.maxWarnings !== undefined &&
    warnings > Number(normalized.maxWarnings)
  ) {
    return true;
  }
  return false;
}

export function annotationsForReport(report) {
  const normalized = normalizeReport(report);
  if (typeof normalized.error === "string") {
    const properties = {};
    if (normalized.file) properties.file = normalized.file;
    return [workflowCommand("error", properties, normalized.error)];
  }
  const lines = [];
  for (const finding of normalized.findings) {
    if (!finding || typeof finding !== "object") continue;
    const severity = String(finding.severity ?? "").toLowerCase();
    const command = severity === "warning" ? "warning" : "error";
    const properties = {};
    if (normalized.file) properties.file = normalized.file;
    if (Number.isInteger(finding.row) && finding.row >= 1) properties.line = finding.row;
    if (finding.ruleId) properties.title = String(finding.ruleId);
    lines.push(workflowCommand(command, properties, finding.message ?? ""));
  }
  if (lines.length === 0 && reportFailed(normalized)) {
    const properties = {};
    if (normalized.file) properties.file = normalized.file;
    lines.push(workflowCommand("error", properties, "catalog-csv-lint: the report is not ok"));
  }
  return lines;
}

function counts(report) {
  if (typeof report.error === "string") return { errors: 1, warnings: 0 };
  return {
    errors: Number(report.errorCount) || 0,
    warnings: Number(report.warningCount) || 0,
  };
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function flattenInline(value) {
  return String(value ?? "")
    .replace(/\r\n/g, " ")
    .replace(/[\r\n]/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function fileCell(file) {
  const text = flattenInline(file || "(unknown file)").replace(/`/g, "'");
  return `\`${text}\``;
}

function omittedText(truncated) {
  if (!truncated || typeof truncated !== "object" || Array.isArray(truncated)) return "";
  const parts = Object.entries(truncated).map(([id, count]) => `${id} (${count})`);
  if (parts.length === 0) return "";
  return `Omitted findings: ${parts.join(", ")}.`;
}

export function formatSummary(reports, options = {}) {
  const items = reports.map((report) => normalizeReport(report));
  const lines = ["## catalog-csv-lint", ""];
  if (items.length === 0) {
    const pattern = options.pattern ? ` \`${flattenInline(options.pattern).replace(/`/g, "'")}\`` : "";
    lines.push(`No CSV files matched${pattern}.`);
    return `${lines.join("\n")}\n`;
  }

  lines.push("| File | Errors | Warnings | Result |");
  lines.push("| --- | ---: | ---: | --- |");
  let errors = 0;
  let warnings = 0;
  for (const report of items) {
    const count = counts(report);
    errors += count.errors;
    warnings += count.warnings;
    const result = reportFailed(report) ? "failed" : "passed";
    lines.push(`| ${fileCell(report.file)} | ${count.errors} | ${count.warnings} | ${result} |`);
  }
  lines.push("");

  for (const report of items) {
    if (typeof report.error === "string") {
      lines.push(`### ${fileCell(report.file)}`);
      lines.push("");
      lines.push(flattenInline(report.error));
      lines.push("");
      continue;
    }
    const findings = Array.isArray(report.findings)
      ? report.findings.filter((finding) => finding && typeof finding === "object")
      : [];
    if (findings.length === 0) continue;
    lines.push(`### ${fileCell(report.file)}`);
    lines.push("");
    lines.push("| Severity | Rule | Line | Message |");
    lines.push("| --- | --- | ---: | --- |");
    for (const finding of findings) {
      const line = Number.isInteger(finding.row) && finding.row >= 1 ? String(finding.row) : "";
      const severity = String(finding.severity ?? "").toLowerCase() === "warning" ? "warning" : "error";
      lines.push(
        `| ${severity} | ${flattenInline(finding.ruleId ?? "")} | ${line} | ${flattenInline(finding.message ?? "")} |`,
      );
    }
    lines.push("");
    const omitted = omittedText(report.truncated);
    if (omitted) {
      lines.push(omitted);
      lines.push("");
    }
  }

  lines.push(`${plural(errors, "error")}, ${plural(warnings, "warning")}, ${plural(items.length, "file")}.`);
  return `${lines.join("\n")}\n`;
}

export function reportStatusLine(report) {
  const normalized = normalizeReport(report);
  const file = normalized.file || "report";
  if (typeof normalized.error === "string") {
    return `${file}: ${normalized.error.replace(/\s+/g, " ").trim()}`;
  }
  const count = counts(normalized);
  let line = `${file}: ${plural(count.errors, "error")}, ${plural(count.warnings, "warning")}`;
  if (
    normalized.maxWarnings !== null &&
    normalized.maxWarnings !== undefined &&
    count.warnings > Number(normalized.maxWarnings)
  ) {
    line += `, over the --max-warnings limit of ${normalized.maxWarnings}`;
  }
  return line;
}

export function totals(reports) {
  let errors = 0;
  let warnings = 0;
  for (const report of reports.map((item) => normalizeReport(item))) {
    const count = counts(report);
    errors += count.errors;
    warnings += count.warnings;
  }
  return { errors, warnings };
}

export function writeGitHubOutput(env, result) {
  const file = env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, `errors=${result.errors}\nwarnings=${result.warnings}\n`);
}

export function loadReportText(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const detail = String(error instanceof Error ? error.message : error)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    return [normalizeReport({ schemaVersion: 1, error: `catalog-csv-lint: invalid JSON report (${detail})` })];
  }
  if (Array.isArray(value)) return value.map((item) => normalizeReport(item));
  return [normalizeReport(value)];
}

function loadReportFile(file) {
  try {
    return loadReportText(readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [normalizeReport({ schemaVersion: 1, error: `catalog-csv-lint: ${message}` })];
  }
}

export function parseCliArgs(argv) {
  const files = [];
  let annotations = true;
  let pattern;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-annotations") {
      annotations = false;
      continue;
    }
    if (arg === "--annotations") {
      annotations = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true, files, annotations, pattern };
    }
    if (arg === "--pattern") {
      const value = argv[index + 1];
      if (value === undefined) return { error: "catalog-csv-lint: --pattern needs a glob" };
      pattern = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) return { error: `catalog-csv-lint: unknown option ${arg}` };
    files.push(arg);
  }
  return { files, annotations, pattern };
}

function usage() {
  return `Usage: node scripts/gh-annotations.mjs [--no-annotations] [--pattern GLOB] REPORT.json ...

Read catalog-csv-lint --json reports from the given files, or from stdin.
Write GitHub workflow annotations to stdout and append a Markdown table to
$GITHUB_STEP_SUMMARY. Exit 1 when any report has errors or is over its
warning limit.
`;
}

function writeOut(text) {
  writeSync(1, text);
}

function writeErr(text) {
  writeSync(2, text);
}

function loadReports(parsed) {
  if (parsed.files.length > 0) return parsed.files.flatMap((file) => loadReportFile(file));
  if (parsed.pattern !== undefined) return [];
  if (process.stdin.isTTY) {
    throw new Error("catalog-csv-lint: pass a JSON report, or pipe --json output");
  }
  return loadReportText(readFileSync(0, "utf8"));
}

function execute() {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.help) {
    writeOut(usage());
    return 0;
  }
  if (parsed.error) {
    writeErr(`${parsed.error}\n`);
    writeErr(usage());
    return 1;
  }
  const reports = loadReports(parsed);
  const markdown = formatSummary(reports, {
    pattern: reports.length === 0 ? parsed.pattern : undefined,
  });
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) appendFileSync(summaryFile, markdown);
  else {
    writeErr("GITHUB_STEP_SUMMARY is unset.\n");
    writeErr(markdown);
  }
  if (parsed.annotations) {
    const lines = reports.flatMap((report) => annotationsForReport(report));
    if (lines.length > 0) writeOut(`${lines.join("\n")}\n`);
  }
  for (const report of reports) writeErr(`${reportStatusLine(report)}\n`);
  writeGitHubOutput(process.env, totals(reports));
  return reports.some((report) => reportFailed(report)) ? 1 : 0;
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
    process.exitCode = execute();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeErr(`${message.endsWith("\n") ? message : `${message}\n`}`);
    process.exitCode = 1;
  }
}
