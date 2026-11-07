import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const cleanCsv = join(root, "test/fixtures/shopify/product_template.csv");
const brokenCsv = join(root, "test/fixtures/broken-product.csv");
const skipGit =
  process.env.CATALOG_CSV_LINT_SKIP_INSTALL === "1"
    ? "CATALOG_CSV_LINT_SKIP_INSTALL=1 (this test installs dev dependencies from the npm registry)"
    : false;

function offlineEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_offline: "true",
    npm_config_update_notifier: "false",
    ...extra,
  };
}

function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
    timeout: options.timeout ?? 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function assertOk(
  result: { status: number | null; stdout: string; stderr: string },
  status: number,
  label: string,
): void {
  assert.equal(result.status, status, `${label}\n${result.stdout}\n${result.stderr}`);
}

interface Packed {
  tarball: string;
  files: string[];
}

function packTarball(): Packed {
  const stage = mkdtempSync(join(tmpdir(), "catalog-csv-lint-stage-"));
  const dest = mkdtempSync(join(tmpdir(), "catalog-csv-lint-pack-"));
  for (const name of ["package.json", "package-lock.json", "tsconfig.json", "README.md", "LICENSE"]) {
    cpSync(join(root, name), join(stage, name));
  }
  cpSync(join(root, "src"), join(stage, "src"), { recursive: true });
  cpSync(join(root, "scripts"), join(stage, "scripts"), { recursive: true });
  const copied = spawnSync("cp", ["-a", join(root, "node_modules"), join(stage, "node_modules")], {
    encoding: "utf8",
  });
  assert.equal(copied.status, 0, copied.stderr);
  mkdirSync(join(stage, "dist"), { recursive: true });
  writeFileSync(join(stage, "dist", "not-shipped.js.map"), "not a published source map");
  const packed = run("npm", ["pack", "--json", "--pack-destination", dest], {
    cwd: stage,
    env: offlineEnv(),
  });
  assertOk(packed, 0, "npm pack");
  const meta = JSON.parse(packed.stdout) as Array<{ filename: string; files: Array<{ path: string }> }>;
  const files = meta[0]!.files.map((file) => file.path).sort();
  for (const file of files) {
    assert.match(file, /^(LICENSE|README\.md|package\.json|dist\/[^/]+\.(?:js|d\.ts))$/);
    assert.doesNotMatch(file, /\.map$/);
  }
  assert.equal(files.includes("package.json"), true);
  assert.equal(files.includes("README.md"), true);
  assert.equal(files.includes("LICENSE"), true);
  assert.equal(files.includes("dist/cli.js"), true);
  assert.equal(files.includes("dist/index.js"), true);
  assert.equal(files.includes("dist/index.d.ts"), true);
  assert.equal(files.some((file) => file.startsWith("test/") || file.startsWith("corpus/") || file.startsWith("src/")), false);
  return { tarball: join(dest, meta[0]!.filename), files };
}

const packed = packTarball();

function assertDocumentedExits(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const help = run(command, [...args, "--help"], { env });
  assertOk(help, 0, `${command} --help`);
  assert.match(help.stdout, /Usage: catalog-csv-lint/);
  const clean = run(command, [...args, cleanCsv], { env });
  assertOk(clean, 0, `${command} clean`);
  assert.match(clean.stdout, /0 errors, 0 warnings, 16 data rows, 3 products/);
  const broken = run(command, [...args, brokenCsv], { env });
  assertOk(broken, 1, `${command} broken`);
  assert.match(broken.stdout, /6 errors, 8 warnings, 3 data rows, 2 products/);
}

describe("tarball install", () => {
  it("installs globally from npm pack into a temporary prefix", () => {
    const prefix = mkdtempSync(join(tmpdir(), "catalog-csv-lint-prefix-"));
    const installed = run(
      "npm",
      ["install", "-g", packed.tarball, "--prefix", prefix, "--offline", "--no-fund", "--no-audit"],
      { cwd: prefix, env: offlineEnv() },
    );
    assertOk(installed, 0, "npm install -g tarball");
    const bin = join(prefix, "bin", "catalog-csv-lint");
    assert.equal(existsSync(bin), true);
    assertDocumentedExits(bin, [], offlineEnv());
  });

  it("runs the same files through npx of the tarball", () => {
    const cwd = mkdtempSync(join(tmpdir(), "catalog-csv-lint-npx-"));
    const env = offlineEnv();
    const base = ["--offline", "--yes", "--package", packed.tarball, "--", "catalog-csv-lint"];
    assertDocumentedExits("npx", base, { ...env, npm_config_cache: join(cwd, "npm-cache") });
  });
});

describe("git install", () => {
  it(
    "builds from prepare when installed globally from a local git clone",
    { timeout: 180_000, skip: skipGit },
    () => {
      // git+file:// stands in for `npm install -g --install-links github:ericcheng0904-pixel/product-csv-lint`.
      const origin = mkdtempSync(join(tmpdir(), "catalog-csv-lint-origin-"));
      const prefix = mkdtempSync(join(tmpdir(), "catalog-csv-lint-git-prefix-"));
      for (const name of ["package.json", "package-lock.json", "tsconfig.json", "README.md", "LICENSE"]) {
        cpSync(join(root, name), join(origin, name));
      }
      cpSync(join(root, "src"), join(origin, "src"), { recursive: true });
      mkdirSync(join(origin, "scripts"));
      cpSync(join(root, "scripts/prepare.mjs"), join(origin, "scripts/prepare.mjs"));
      const gitEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: "catalog-csv-lint",
        GIT_AUTHOR_EMAIL: "dev@example.com",
        GIT_COMMITTER_NAME: "catalog-csv-lint",
        GIT_COMMITTER_EMAIL: "dev@example.com",
      };
      const git = (args: string[]): void => {
        const result = run("git", args, { cwd: origin, env: gitEnv });
        assertOk(result, 0, `git ${args.join(" ")}`);
      };
      git(["init", "-b", "main"]);
      git(["add", "."]);
      git(["-c", "commit.gpgsign=false", "commit", "-m", "install fixture"]);
      assert.equal(existsSync(join(origin, "dist", "cli.js")), false);
      const installed = run(
        "npm",
        [
          "install",
          "-g",
          "--install-links",
          "--no-fund",
          "--no-audit",
          "--prefix",
          prefix,
          `git+file://${origin}`,
        ],
        { cwd: prefix, timeout: 150_000 },
      );
      assertOk(installed, 0, "npm install -g git+file");
      const built = join(prefix, "lib", "node_modules", "catalog-csv-lint", "dist", "cli.js");
      assert.equal(existsSync(built), true);
      assertDocumentedExits(join(prefix, "bin", "catalog-csv-lint"), [], process.env);
    },
  );
});
