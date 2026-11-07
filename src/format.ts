import { CHECKED_ON } from "./citations.js";
import type { FixChange } from "./fix.js";
import type { Report } from "./lint.js";
import type { Rule } from "./rules.js";
import { escapeControls } from "./text.js";

export function formatText(report: Report): string {
  const lines: string[] = [escapeControls(report.file), ""];
  if (report.findings.length === 0) {
    lines.push("No problems found.");
    lines.push("");
  } else {
    let current: string | null = null;
    for (const finding of report.findings) {
      const key = finding.row === null ? "File" : `Row ${finding.row}`;
      if (key !== current) {
        if (current !== null) lines.push("");
        lines.push(key);
        current = key;
      }
      const column = finding.column ? `  ${escapeControls(finding.column)}` : "";
      lines.push(`  ${finding.severity} ${finding.ruleId}${column}`);
      lines.push(`    ${escapeControls(finding.message)}`);
    }
    lines.push("");
  }
  lines.push(summaryLine(report));
  if (report.truncated) {
    const more = Object.entries(report.truncated).map(([id, count]) => `and ${count} more ${id}`);
    lines.push(more.join(", ") + ".");
  }
  return `${lines.join("\n")}\n`;
}

export function formatJson(
  report: Report,
  fixed?: { fixes: readonly FixChange[]; output: string | null },
): string {
  const body: Record<string, unknown> = {
    schemaVersion: report.schemaVersion,
    file: report.file,
    bytes: report.bytes,
    dataRows: report.dataRows,
    products: report.products,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    maxWarnings: report.maxWarnings,
    ok: report.ok,
    truncated: report.truncated,
    findings: report.findings.map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      row: finding.row,
      column: finding.column,
      message: finding.message,
      citation: finding.citation,
    })),
  };
  if (fixed) {
    body.fixes = fixed.fixes.map((fix) => ({
      ruleId: fix.ruleId,
      row: fix.row,
      column: fix.column,
      before: fix.before,
      after: fix.after,
    }));
    body.output = fixed.output;
  }
  return `${JSON.stringify(body, null, 2)}\n`;
}

export function formatFixPreface(fixes: readonly FixChange[]): string {
  if (fixes.length === 0) return "No automatic fixes apply.\n\n";
  return `${fixes.map(formatFixLine).join("\n")}\n\n`;
}

function formatFixLine(fix: FixChange): string {
  if (fix.ruleId === "SCL016") {
    return `SCL016  ${showText(fix.column)}  ${rowList(fix.before)} → ${rowList(fix.after)}`;
  }
  const row = fix.row === 1 ? "header" : String(fix.row);
  return `${row}  ${showText(fix.column)}  ${fix.ruleId}  ${showValue(fix.before)} → ${showValue(fix.after)}`;
}

function showText(value: string | null): string {
  if (value === null) return "null";
  return escapeControls(JSON.stringify(value));
}

function showValue(value: string | number[]): string {
  if (typeof value !== "string") return rowList(value);
  return escapeControls(JSON.stringify(value));
}

function rowList(value: string | number[]): string {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function formatRules(rules: readonly Rule[]): string {
  const lines = [`Citations checked ${CHECKED_ON}.`, ""];
  for (const rule of rules) {
    lines.push(`${rule.id}  ${rule.severity.padEnd(7)} ${rule.basis.padEnd(10)} ${rule.summary}`);
    if (rule.quote) lines.push(`        ${rule.quote}`);
    if (rule.citation) lines.push(`        ${rule.citation}`);
    else lines.push("        No supporting sentence on the help pages.");
  }
  return `${lines.join("\n")}\n`;
}

export function formatRulesJson(rules: readonly Rule[]): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      checkedOn: CHECKED_ON,
      rules: rules.map((rule) => ({
        id: rule.id,
        severity: rule.severity,
        basis: rule.basis,
        summary: rule.summary,
        quote: rule.quote,
        citation: rule.citation,
      })),
    },
    null,
    2,
  )}\n`;
}

export function formatErrorJson(message: string): string {
  return `${JSON.stringify({ schemaVersion: 1, error: message }, null, 2)}\n`;
}

function summaryLine(report: Report): string {
  const parts = [
    count(report.errorCount, "error"),
    count(report.warningCount, "warning"),
  ];
  if (report.maxWarnings !== null && report.warningCount > report.maxWarnings) {
    parts.push(`over the --max-warnings limit of ${report.maxWarnings}`);
  }
  parts.push(count(report.dataRows, "data row"));
  parts.push(count(report.products, "product"));
  return `${parts.join(", ")}.`;
}

function count(value: number, word: string): string {
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}
