import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  annotationsForReport,
  escapeData,
  escapeProperty,
  formatSummary,
  loadReportText,
  workflowCommand,
} from "./gh-annotations.mjs";

const script = fileURLToPath(new URL("./gh-annotations.mjs", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/annotation-report.json", import.meta.url));

const expectedAnnotations = [
  '::error file=products/a%2Cb%3Ac%25%0D%0A.csv,line=4,title=SCL015::Row 4, column URL handle: 100%25 "bad"%0D%0Avalue | still, has: punctuation',
  "::warning file=products/a%2Cb%3Ac%25%0D%0A.csv,title=SCL004::File: header, has: oddities %25%0A",
  "",
].join("\n");

const expectedSummary = [
  "## catalog-csv-lint",
  "",
  "| File | Errors | Warnings | Result |",
  "| --- | ---: | ---: | --- |",
  "| `products/a,b:c% .csv` | 1 | 1 | failed |",
  "",
  "### `products/a,b:c% .csv`",
  "",
  "| Severity | Rule | Line | Message |",
  "| --- | --- | ---: | --- |",
  '| error | SCL015 | 4 | Row 4, column URL handle: 100% "bad" value \\| still, has: punctuation |',
  "| warning | SCL004 |  | File: header, has: oddities % |",
  "",
  "Omitted findings: SCL015 (2).",
  "",
  "1 error, 1 warning, 1 file.",
  "",
].join("\n");

function runScript(args, env, input) {
  const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-annotations-"));
  const summary = join(dir, "summary.md");
  const output = join(dir, "output.txt");
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    input,
    env: {
      ...process.env,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: output,
      ...env,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary: readFileSync(summary, "utf8"),
    output: readFileSync(output, "utf8"),
  };
}

describe("workflow command escaping", () => {
  it("encodes %, CR, and LF in messages, and also : and , in properties", () => {
    assert.equal(escapeData("%"), "%25");
    assert.equal(escapeData("\r"), "%0D");
    assert.equal(escapeData("\n"), "%0A");
    assert.equal(escapeData(":\n,"), ":%0A,");
    assert.equal(escapeData("%0A"), "%250A");
    assert.equal(escapeProperty("%"), "%25");
    assert.equal(escapeProperty("\r"), "%0D");
    assert.equal(escapeProperty("\n"), "%0A");
    assert.equal(escapeProperty(":"), "%3A");
    assert.equal(escapeProperty(","), "%2C");
    assert.equal(escapeProperty(":\n,"), "%3A%0A%2C");
    assert.equal(escapeProperty("%0A"), "%250A");
    assert.equal(escapeProperty("a,b:c%\r\n"), "a%2Cb%3Ac%25%0D%0A");
    assert.equal(
      workflowCommand("error", { file: "a,b:c%\r\n.csv", line: 4, title: "SC,L:1%" }, "100%\r\n, :"),
      "::error file=a%2Cb%3Ac%25%0D%0A.csv,line=4,title=SC%2CL%3A1%25::100%25%0D%0A, :",
    );
  });
});

describe("fixture report", () => {
  it("writes escaped annotations and a Markdown summary table", () => {
    const report = loadReportText(readFileSync(fixture, "utf8"))[0];
    assert.equal(annotationsForReport(report).join("\n") + "\n", expectedAnnotations);
    assert.equal(formatSummary([report]), expectedSummary);

    const result = runScript([fixture]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, expectedAnnotations);
    assert.equal(result.summary, expectedSummary);
    assert.equal(result.output, "errors=1\nwarnings=1\n");
    assert.doesNotMatch(result.stderr, /::(error|warning)/);
  });

  it("reads the same fixture from stdin", () => {
    const result = runScript([], {}, readFileSync(fixture));
    assert.equal(result.status, 1);
    assert.equal(result.stdout, expectedAnnotations);
    assert.equal(result.summary, expectedSummary);
  });

  it("still fails and writes the summary when annotations are off", () => {
    const result = runScript(["--no-annotations", fixture]);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.summary, expectedSummary);
  });
});

describe("report exit status", () => {
  it("exits 0 for warnings inside the limit and 1 when the limit is exceeded", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-annotations-"));
    const warning = {
      schemaVersion: 1,
      file: "products/gift.csv",
      bytes: 20,
      dataRows: 1,
      products: 1,
      errorCount: 0,
      warningCount: 1,
      maxWarnings: null,
      ok: true,
      truncated: null,
      findings: [
        {
          ruleId: "SCL045",
          severity: "warning",
          row: 2,
          column: "Gift card",
          message: "Row 2, column Gift card: Gift card is true.",
          citation: "https://help.shopify.com/en/manual/products/import-export/using-csv",
        },
      ],
    };
    const allowed = join(dir, "allowed.json");
    const capped = join(dir, "capped.json");
    writeFileSync(allowed, JSON.stringify(warning));
    writeFileSync(capped, JSON.stringify({ ...warning, maxWarnings: 0, ok: false }));

    const passed = runScript([allowed]);
    assert.equal(passed.status, 0);
    assert.match(passed.stdout, /^::warning file=products\/gift\.csv,line=2,title=SCL045::/);
    assert.match(passed.summary, /\| `products\/gift\.csv` \| 0 \| 1 \| passed \|/);

    const failed = runScript([capped]);
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /^::warning /);
    assert.match(failed.summary, /\| `products\/gift\.csv` \| 0 \| 1 \| failed \|/);
    assert.match(failed.stderr, /over the --max-warnings limit of 0/);
  });

  it("annotates a tool error and rejects invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-annotations-"));
    const tool = join(dir, "tool.json");
    const broken = join(dir, "broken.json");
    writeFileSync(
      tool,
      JSON.stringify({
        schemaVersion: 1,
        file: "missing.csv",
        error: "catalog-csv-lint: ENOENT: missing, file: 100%\n",
      }),
    );
    writeFileSync(broken, "{");

    const toolResult = runScript([tool]);
    assert.equal(toolResult.status, 1);
    assert.equal(
      toolResult.stdout,
      "::error file=missing.csv::catalog-csv-lint: ENOENT: missing, file: 100%25%0A\n",
    );
    assert.match(toolResult.summary, /catalog-csv-lint: ENOENT: missing, file: 100%/);

    const brokenResult = runScript([broken]);
    assert.equal(brokenResult.status, 1);
    assert.match(brokenResult.stdout, /^::error::catalog-csv-lint: invalid JSON report \(/);
  });

  it("says when a glob matched nothing", () => {
    const result = runScript(["--pattern", "**/*.csv"]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.summary, "## catalog-csv-lint\n\nNo CSV files matched `**/*.csv`.\n");
    assert.equal(result.output, "errors=0\nwarnings=0\n");
  });
});
