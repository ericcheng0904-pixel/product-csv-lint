import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { formatJson, lintCsv } from "../dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("cli", () => {
  it("prints help and exits 0", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage: catalog-csv-lint/);
    assert.equal(result.stderr, "");
  });

  it("exits 0 for a clean file and 1 when an error is present", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-"));
    const clean = join(dir, "clean.csv");
    const broken = join(dir, "broken.csv");
    writeFileSync(clean, "Title,URL handle\nHat,hat\n");
    writeFileSync(broken, "Title,URL handle\nHat,my hat\n");
    assert.equal(run([clean]).status, 0);
    const failed = run([broken]);
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, /SCL015/);
    assert.match(failed.stdout, /1 error/);
  });

  it("exits 0 for warnings unless --max-warnings is exceeded", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-"));
    const file = join(dir, "warn.csv");
    writeFileSync(file, "Title,URL handle,Gift card\nHat,hat,true\n");
    assert.equal(run([file]).status, 0);
    const capped = run([file, "--max-warnings", "0"]);
    assert.equal(capped.status, 1);
    assert.match(capped.stdout, /over the --max-warnings limit of 0/);
  });

  it("prints the rule table and does not lint a file", () => {
    const result = run(["--rules", "missing.csv"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Citations checked 2026-10-27/);
    assert.match(result.stdout, /SCL001/);
    assert.match(result.stdout, /SCL050/);
    assert.match(result.stdout, /SCL005/);
    assert.doesNotMatch(result.stderr, /ENOENT/);
  });

  it("prints rules as JSON and JSON errors on stdout", () => {
    const rules = run(["--rules", "--json"]);
    assert.equal(rules.status, 0);
    const body = JSON.parse(rules.stdout) as { schemaVersion: number; rules: Array<{ id: string }> };
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.rules.some((rule) => rule.id === "SCL001"), true);
    assert.equal(body.rules.some((rule) => rule.id === "SCL005"), true);
    const missing = run(["does-not-exist.csv", "--json"]);
    assert.equal(missing.status, 1);
    const error = JSON.parse(missing.stdout) as { schemaVersion: number; error: string };
    assert.equal(error.schemaVersion, 1);
    assert.match(error.error, /ENOENT|no such file/i);
    assert.match(missing.stderr, /catalog-csv-lint:/);
  });

  it("prints a JSON error for a usage failure wherever --json appears", () => {
    const cases: string[][] = [
      ["--json", "--bogus"],
      ["--bogus", "--json"],
      ["--max-warnings", "x", "f.csv", "--json"],
      ["--json", "--max-warnings", "x", "f.csv"],
      ["a.csv", "b.csv", "--json"],
      ["--max-warnings", "--json"],
      ["--json"],
    ];
    for (const args of cases) {
      const result = run(args);
      assert.equal(result.status, 1, args.join(" "));
      const body = JSON.parse(result.stdout) as { schemaVersion: number; error: string };
      assert.equal(body.schemaVersion, 1, args.join(" "));
      assert.ok(body.error.length > 0, args.join(" "));
      assert.notEqual(result.stderr, "", args.join(" "));
    }
    const plain = run(["--bogus"]);
    assert.equal(plain.stdout, "");
  });

  it("exits 1 for a missing file, a bad flag, and a missing argument", () => {
    const missing = run(["does-not-exist.csv"]);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /catalog-csv-lint:/);
    const flag = run(["--nope"]);
    assert.equal(flag.status, 1);
    assert.match(flag.stderr, /unknown option/);
    const bare = run([]);
    assert.equal(bare.status, 1);
    assert.match(bare.stderr, /Usage:/);
    const max = run(["--max-warnings", "many"]);
    assert.equal(max.status, 1);
    assert.match(max.stderr, /non-negative integer/);
  });

  it("emits the documented JSON schema", () => {
    const source = readFileSync(new URL("./fixtures/schema-sample.csv", import.meta.url), "utf8");
    const report = lintCsv(source, { file: "fixture.csv" });
    const json = formatJson(report);
    const expected = readFileSync(new URL("./fixtures/report.snapshot.json", import.meta.url), "utf8");
    assert.equal(json, expected);
    const parsed = JSON.parse(json) as {
      schemaVersion: number;
      ok: boolean;
      findings: Array<{ ruleId: string; severity: string; row: number; column: string; citation: string }>;
    };
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.ok, false);
    assert.deepEqual(
      parsed.findings.map((finding) => finding.ruleId),
      ["SCL026", "SCL028", "SCL015"],
    );
    for (const finding of parsed.findings) {
      assert.equal(typeof finding.severity, "string");
      assert.equal(typeof finding.row, "number");
      assert.equal(typeof finding.column, "string");
      assert.match(finding.citation, /^https:\/\/help\.shopify\.com\//);
    }

    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-"));
    const file = join(dir, "fixture.csv");
    writeFileSync(file, source);
    const result = run([file, "--json"]);
    assert.equal(result.status, 1);
    const fromCli = JSON.parse(result.stdout) as { schemaVersion: number; file: string; findings: unknown[] };
    assert.equal(fromCli.schemaVersion, 1);
    assert.equal(fromCli.file, file);
    assert.equal(fromCli.findings.length, parsed.findings.length);
  });
});
