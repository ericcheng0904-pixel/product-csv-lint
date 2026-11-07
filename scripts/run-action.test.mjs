import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listFiles, matchGlob, warningArgs } from "./run-action.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const runAction = fileURLToPath(new URL("./run-action.mjs", import.meta.url));
const cli = join(root, "dist", "cli.js");

function run(workspace, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-action-out-"));
  const summary = join(dir, "summary.md");
  const output = join(dir, "github-output.txt");
  writeFileSync(summary, "");
  writeFileSync(output, "");
  const result = spawnSync(process.execPath, [runAction], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_WORKSPACE: workspace,
      GITHUB_ACTION_PATH: root,
      GITHUB_STEP_SUMMARY: summary,
      GITHUB_OUTPUT: output,
      CATALOG_CSV_LINT: "",
      INPUT_FILES: options.files ?? "**/*.csv",
      INPUT_MAX_WARNINGS: options.maxWarnings ?? "",
      INPUT_FAIL_ON_WARNINGS: options.failOnWarnings ?? "false",
      INPUT_ANNOTATIONS: options.annotations ?? "true",
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

describe("glob", () => {
  it("matches the self-test paths and skips nested stars correctly", () => {
    const cases = [
      ["**/*.csv", "a.csv", true],
      ["**/*.csv", "a/b.csv", true],
      ["**/*.csv", "a/b.txt", false],
      ["*.csv", "a.csv", true],
      ["*.csv", "dir/a.csv", false],
      ["./products/*.csv", "products/a.csv", true],
      ["products/**/*.csv", "products/a.csv", true],
      ["products/**/*.csv", "products/sub/a.csv", true],
      ["products/**/*.csv", "other/a.csv", false],
      ["test/fixtures/shopify/**/*.csv", "test/fixtures/shopify/product_template.csv", true],
      ["test/fixtures/shopify/**/*.csv", "test/fixtures/shopify/nested/a.csv", true],
      ["test/fixtures/shopify/**/*.csv", "test/fixtures/broken-product.csv", false],
      ["test/fixtures/broken-product.csv", "test/fixtures/broken-product.csv", true],
    ];
    for (const [pattern, relPath, expected] of cases) {
      assert.equal(matchGlob(pattern, relPath), expected, `${pattern} vs ${relPath}`);
    }
  });

  it("lists the shopify sample and the broken fixture", () => {
    const sample = listFiles(root, "test/fixtures/shopify/**/*.csv");
    assert.ok(sample.includes("test/fixtures/shopify/product_template.csv"));
    assert.ok(sample.every((file) => file.endsWith(".csv")));
    assert.ok(sample.every((file) => file.startsWith("test/fixtures/shopify/")));
    assert.deepEqual(listFiles(root, "test/fixtures/broken-product.csv"), ["test/fixtures/broken-product.csv"]);
  });

  it("does not walk node_modules or .git", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-glob-"));
    mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
    mkdirSync(join(dir, ".git"), { recursive: true });
    mkdirSync(join(dir, "products", "sub"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "pkg", "secret.csv"), "Title\n");
    writeFileSync(join(dir, ".git", "objects.csv"), "Title\n");
    writeFileSync(join(dir, "products", "sub", "hat.csv"), "Title\n");
    writeFileSync(join(dir, "root.csv"), "Title\n");
    assert.deepEqual(listFiles(dir, "**/*.csv"), ["products/sub/hat.csv", "root.csv"]);
    assert.deepEqual(listFiles(dir, "missing.csv"), []);
  });
});

describe("warning limit", () => {
  it("maps the action inputs onto --max-warnings", () => {
    assert.deepEqual(warningArgs("", "false"), { error: "", args: [] });
    assert.deepEqual(warningArgs("", "true"), { error: "", args: ["--max-warnings", "0"] });
    assert.deepEqual(warningArgs("4", "true"), { error: "", args: ["--max-warnings", "4"] });
    assert.match(warningArgs("many", "false").error, /non-negative integer/);
  });
});

describe("action runner", () => {
  it("passes a clean tree and fails a tree with an error", () => {
    assert.equal(existsSync(cli), true, "run npm run build before this test");
    const cleanDir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-action-"));
    mkdirSync(join(cleanDir, "products"));
    writeFileSync(join(cleanDir, "products", "hat.csv"), "Title,URL handle\nHat,hat\n");
    const clean = run(cleanDir, { files: "products/**/*.csv" });
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(clean.stdout, "");
    assert.match(clean.summary, /\| `products\/hat\.csv` \| 0 \| 0 \| passed \|/);
    assert.equal(clean.output, "errors=0\nwarnings=0\n");

    const mixedDir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-action-"));
    mkdirSync(join(mixedDir, "products"));
    writeFileSync(join(mixedDir, "products", "hat.csv"), "Title,URL handle\nHat,hat\n");
    writeFileSync(
      join(mixedDir, "products", "coat.csv"),
      "Title,URL handle,Gift card\nHat,my hat,true\n",
    );
    const mixed = run(mixedDir, { files: "products/**/*.csv" });
    assert.equal(mixed.status, 1, mixed.stderr);
    assert.match(mixed.stdout, /::error file=products\/coat\.csv,line=2,title=SCL015::/);
    assert.match(mixed.stdout, /::warning file=products\/coat\.csv,line=2,title=SCL045::/);
    assert.match(mixed.summary, /\| `products\/hat\.csv` \| 0 \| 0 \| passed \|/);
    assert.match(mixed.summary, /\| `products\/coat\.csv` \| \d+ \| \d+ \| failed \|/);
    assert.match(mixed.output, /^errors=[1-9]/);
  });

  it("lets warnings pass unless fail-on-warnings is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-action-"));
    writeFileSync(join(dir, "gift.csv"), "Title,URL handle,Gift card\nHat,hat,true\n");
    const passed = run(dir, { files: "gift.csv" });
    assert.equal(passed.status, 0, passed.stderr);
    assert.match(passed.stdout, /^::warning file=gift\.csv,line=2,title=SCL045::/);
    assert.doesNotMatch(passed.stdout, /::error /);

    const failed = run(dir, { files: "gift.csv", failOnWarnings: "true" });
    assert.equal(failed.status, 1, failed.stderr);
    assert.match(failed.stdout, /^::warning /);
    assert.match(failed.summary, /\| `gift\.csv` \| 0 \| 1 \| failed \|/);
  });

  it("succeeds when nothing matches and rejects a bad max-warnings value", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-action-"));
    const empty = run(dir, { files: "products/**/*.csv" });
    assert.equal(empty.status, 0, empty.stderr);
    assert.equal(empty.stdout, "");
    assert.match(empty.summary, /No CSV files matched `products\/\*\*\/\*\.csv`\./);
    assert.equal(empty.output, "errors=0\nwarnings=0\n");

    const bad = run(dir, { files: "products/**/*.csv", maxWarnings: "many" });
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /^::error::catalog-csv-lint: --max-warnings needs a non-negative integer\n$/);
  });

  it("passes the shopify sample and fails the broken fixture", () => {
    assert.equal(existsSync(cli), true, "run npm run build before this test");
    const sample = run(root, { files: "test/fixtures/shopify/**/*.csv" });
    assert.equal(sample.status, 0, sample.stderr);
    assert.equal(sample.stdout, "");
    assert.match(sample.summary, /\| `test\/fixtures\/shopify\/product_template\.csv` \| 0 \| 0 \| passed \|/);
    assert.equal(sample.output, "errors=0\nwarnings=0\n");

    const broken = run(root, { files: "test/fixtures/broken-product.csv" });
    assert.equal(broken.status, 1, broken.stderr);
    assert.match(broken.stdout, /::error file=test\/fixtures\/broken-product\.csv,/);
    assert.match(broken.stdout, /::warning file=test\/fixtures\/broken-product\.csv,/);
    assert.match(broken.summary, /\| `test\/fixtures\/broken-product\.csv` \| [1-9]\d* \| \d+ \| failed \|/);
    assert.match(broken.output, /^errors=[1-9]/);
  });

  it("can suppress annotations without hiding a failing result", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-action-"));
    writeFileSync(join(dir, "bad.csv"), "Title,URL handle\nHat,my hat\n");
    const result = run(dir, { files: "*.csv", annotations: "false" });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.summary, /\| `bad\.csv` \| \d+ \| \d+ \| failed \|/);
  });
});
