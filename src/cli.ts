#!/usr/bin/env node
import { existsSync, realpathSync, statSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decodeUtf8 } from "./csv.js";
import { fixCsv } from "./fix.js";
import { formatErrorJson, formatFixPreface, formatJson, formatRules, formatRulesJson, formatText } from "./format.js";
import { FILE_SIZE_LIMIT, lintCsv, lintFile } from "./lint.js";
import { RULES } from "./rules.js";

interface Args {
  file: string | null;
  json: boolean;
  rules: boolean;
  maxWarnings: number | null;
  fix: string | null;
  force: boolean;
}

function usage(): string {
  return `Usage: catalog-csv-lint FILE.csv [--json] [--rules] [--max-warnings N] [--fix OUT.csv] [--force]

Check a Shopify product CSV for documented import problems and likely mishandling.
The checker does not talk to a store. Exit 0 when the file is clean. Exit 1 when
any error is found, when the warning count is greater than --max-warnings, or
when the command line or the file cannot be read. Warnings alone exit 0.
A path of "-" is not stdin.

  --json              Print the report as JSON (schemaVersion 1)
  --rules             Print the rule table and exit
  --max-warnings N    Fail when more than N warnings are found
  --fix OUT.csv       Write a corrected copy and then check that file
  --force             Replace an existing --fix output file
`;
}

function parseArgs(argv: string[]): Args & { error?: string; help?: boolean } {
  let file: string | null = null;
  // Found before the rest is parsed, so a usage error still prints JSON when --json comes later.
  const json = argv.includes("--json");
  let rules = false;
  let maxWarnings: number | null = null;
  let fix: string | null = null;
  let force = false;
  const base = (): Args => ({ file, json, rules, maxWarnings, fix, force });
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--json") continue;
    if (arg === "--rules") {
      rules = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { ...base(), help: true };
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg === "--fix") {
      const value = argv[index + 1];
      if (value === undefined || value === "" || value.startsWith("-")) {
        return { ...base(), error: "catalog-csv-lint: --fix needs an output path\n" };
      }
      if (fix !== null) return { ...base(), error: "catalog-csv-lint: --fix can only be given once\n" };
      fix = value;
      index += 1;
      continue;
    }
    if (arg === "--max-warnings") {
      const value = argv[index + 1];
      if (value === undefined || !/^\d+$/.test(value)) {
        return {
          ...base(),
          error: "catalog-csv-lint: --max-warnings needs a non-negative integer\n",
        };
      }
      maxWarnings = Number(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      return {
        ...base(),
        error: `catalog-csv-lint: unknown option ${arg}\n${usage()}`,
      };
    }
    if (file !== null) {
      return { ...base(), error: "catalog-csv-lint: only one CSV file is accepted\n" };
    }
    file = arg;
  }
  if (force && fix === null) {
    return { ...base(), error: "catalog-csv-lint: --force requires --fix\n" };
  }
  return base();
}

function writeAndExit(stream: NodeJS.WriteStream, text: string, code: number): void {
  stream.write(text, () => {
    process.exit(code);
  });
}

function fail(json: boolean, message: string): void {
  const text = message.endsWith("\n") ? message : `${message}\n`;
  const stdout = json ? formatErrorJson(text.trim()) : "";
  let pending = 0;
  const done = (): void => {
    pending -= 1;
    if (pending === 0) process.exit(1);
  };
  if (stdout !== "") {
    pending += 1;
    process.stdout.write(stdout, done);
  }
  pending += 1;
  process.stderr.write(text, done);
}

function samePath(input: string, output: string): boolean {
  const left = resolve(input);
  const right = resolve(output);
  if (left === right) return true;
  try {
    if (!existsSync(left) || !existsSync(right)) return false;
    if (realpathSync(left) === realpathSync(right)) return true;
    const a = statSync(left, { bigint: true });
    const b = statSync(right, { bigint: true });
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}

async function writeFixed(output: string, text: string, force: boolean): Promise<void> {
  await writeFile(output, text, { flag: force ? "w" : "wx" });
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    writeAndExit(process.stdout, usage(), 0);
    return;
  }
  if (parsed.error) {
    fail(parsed.json, parsed.error);
    return;
  }
  if (parsed.rules) {
    writeAndExit(process.stdout, parsed.json ? formatRulesJson(RULES) : formatRules(RULES), 0);
    return;
  }
  if (parsed.file === null) {
    fail(parsed.json, usage());
    return;
  }
  if (parsed.fix === null) {
    try {
      const report = await lintFile(parsed.file, { maxWarnings: parsed.maxWarnings });
      writeAndExit(process.stdout, parsed.json ? formatJson(report) : formatText(report), report.ok ? 0 : 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fail(parsed.json, `catalog-csv-lint: ${message}\n`);
    }
    return;
  }

  const output = parsed.fix;
  if (samePath(parsed.file, output)) {
    fail(parsed.json, "catalog-csv-lint: --fix output is the input file\n");
    return;
  }
  if (!parsed.force && existsSync(output)) {
    fail(parsed.json, `catalog-csv-lint: output file already exists: ${output}\n`);
    return;
  }

  try {
    const info = await stat(parsed.file);
    if (info.isFile() && info.size > FILE_SIZE_LIMIT) {
      fail(parsed.json, "catalog-csv-lint: SCL011: the file is larger than 15 MiB\n");
      return;
    }
    const bytes = await readFile(parsed.file);
    if (bytes.byteLength > FILE_SIZE_LIMIT) {
      fail(parsed.json, "catalog-csv-lint: SCL011: the file is larger than 15 MiB\n");
      return;
    }
    const text = decodeUtf8(bytes);
    if (text === null) {
      fail(parsed.json, "catalog-csv-lint: SCL010: the file is not valid UTF-8\n");
      return;
    }
    // TextDecoder drops a leading BOM. The fixer and the checker need it to keep the BOM and count the bytes.
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const source = hasBom ? `\uFEFF${text}` : text;
    const fixed = fixCsv(source);
    if (!fixed.ok) {
      const detail = fixed.ruleId === "SCL012" ? fixed.message : "the file has no header row";
      fail(parsed.json, `catalog-csv-lint: ${fixed.ruleId}: ${detail}\n`);
      return;
    }
    const wrote = fixed.text !== null;
    if (wrote) {
      try {
        await writeFixed(output, fixed.text!, parsed.force);
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
        if (code === "EEXIST") {
          fail(parsed.json, `catalog-csv-lint: output file already exists: ${output}\n`);
          return;
        }
        throw error;
      }
    }
    const subject = wrote ? fixed.text! : source;
    const report = lintCsv(subject, {
      file: wrote ? output : parsed.file,
      maxWarnings: parsed.maxWarnings,
    });
    const preface = formatFixPreface(fixed.fixes);
    const rendered = parsed.json
      ? formatJson(report, { fixes: fixed.fixes, output: wrote ? output : null })
      : `${preface}${formatText(report)}`;
    writeAndExit(process.stdout, rendered, report.ok ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(parsed.json, `catalog-csv-lint: ${message}\n`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`catalog-csv-lint: ${message}\n`);
  process.exit(1);
});
