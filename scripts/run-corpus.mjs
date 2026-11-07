#!/usr/bin/env node
/**
 * Lint every CSV committed under corpus/files and write docs/CORPUS.md.
 * Exit 0 when every finding has a true-positive verdict.
 * Exit 1 when a finding is unclassified or marked false-positive.
 *
 * The verdict is a hand review recorded once per rule in VERDICTS below. The
 * script does not measure false positives: it cannot see a new false positive
 * from a rule that already has a true-positive verdict. When a rule changes,
 * re-read its findings in docs/CORPUS.md.
 * This script does not download files and is not part of npm test.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lintFile } from "../dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const filesDir = join(root, "corpus", "files");

/**
 * False positives on the first lint of corpus/files, before the rule fixes.
 * Every other rule was 0.
 */
const FALSE_POSITIVES_BEFORE = {
  SCL004: 4,
  SCL038: 3,
};

/** Files Shopify itself published: the help-center templates and two Shopify repositories. */
const SHOPIFY_AUTHORED = new Set([
  "help-product-template-20210819.csv",
  "help-product-template-20220126.csv",
  "help-product-template-20230601.csv",
  "help-product-template-20260216.csv",
  "help-product-template-csv-20260201.csv",
  "shopify-transporter-products.csv",
  "shopify-b2b-products-import.csv",
]);

const VERDICTS = {
  SCL001: {
    verdict: "true positive",
    why: "The product CSV page says each column is separated by a comma and that Title is required. A semicolon-separated file has no Title column.",
  },
  SCL003: {
    verdict: "true positive",
    why: "The product CSV page says a new product with no variants can omit URL handle, and an update cannot. The file omits the column, and the checker cannot tell those two imports apart.",
  },
  SCL004: {
    verdict: "true positive",
    why: "The using-csv page says you can't add any other columns. The common-import-issues page says incorrect headers open a mapping dialog, so this is a warning. The flagged header is not a documented column, not Variant Barcodes, and not an older name of a documented column.",
  },
  SCL013: {
    verdict: "true positive",
    why: "The row has a non-empty cell past the header. No help page says an extra cell is rejected, so this is a warning. An empty extra cell is not flagged.",
  },
  SCL015: {
    verdict: "true positive",
    why: "The product CSV page says a URL handle can contain letters, dashes, and numbers, and that it cannot contain spaces.",
  },
  SCL016: {
    verdict: "true positive",
    why: "Rows for one URL handle are not contiguous. Split handle groups are not imported as variants of the earlier product.",
  },
  SCL017: {
    verdict: "true positive",
    why: "The common-import-issues page says a line with a handle and no product title is ignored.",
  },
  SCL018: {
    verdict: "true positive",
    why: "The product CSV page says to put Title, Description, Vendor, and Tags on the first row and skip them later. A later row changes one of those values, and the page does not say which value the importer keeps.",
  },
  SCL019: {
    verdict: "true positive",
    why: "An option name on a later row does not match the first row of the product. The sample product CSV keeps one option name, on the first row.",
  },
  SCL022: {
    verdict: "true positive",
    why: "Two variant rows use the same option values. The common-import-issues page reports \"Validation failed: options are not unique\".",
  },
  SCL023: {
    verdict: "true positive",
    why: "An option value is present and that option never has a name. No help page says the importer rejects that, so this is a warning.",
  },
  SCL024: {
    verdict: "true positive",
    why: "Price is blank on a variant row. The current column table says the default is 0.00. The older troubleshooting page lists \"Validation failed: price can't be blank\". The two pages conflict, so this is a warning.",
  },
  SCL025: {
    verdict: "true positive",
    why: "The product CSV page says to include only the monetary value, without a currency symbol. A currency symbol or letters are an error. A thousands comma or another shape is a warning. .99 and surrounding spaces are accepted.",
  },
  SCL026: {
    verdict: "true positive",
    why: "Compare-at price is not higher than price. The sale-pricing page says it has to be higher to display a sale, and that 0.00 is not the same as an empty compare-at price. This is a warning, not an import rejection. The 2026-02-01 sample's jeans rows are in this set: price 95, compare-at price 64.95.",
  },
  SCL027: {
    verdict: "true positive",
    why: "A documented choice field has a value outside the published set (status, weight unit, published, and the other lists on the product CSV page).",
  },
  SCL028: {
    verdict: "true positive",
    why: "An image URL is not an absolute http:// or https:// URL. The common-import-issues page says the image URL needs http:// in front of it.",
  },
  SCL029: {
    verdict: "true positive",
    why: "The SEO title is longer than 70 characters. The product CSV column table says a valid SEO title includes up to 70 characters.",
  },
  SCL032: {
    verdict: "true positive",
    why: "A tag contains a symbol or an accented Latin character. The product CSV page says to avoid accented characters and symbols. Letters in other scripts are not flagged. The import is not documented to reject the tag, so this stays a warning.",
  },
  SCL038: {
    verdict: "true positive",
    why: "Weight includes a decimal. The column table says you should specify only the numerical value, without the unit of measurement or decimals. The 2026-02-01 sample contains 226.796185, 283.4952313, and 396.8933238. The page does not say the importer rejects a decimal, so this is a warning.",
  },
  SCL036: {
    verdict: "true positive",
    why: "Image alt text is longer than the documented optimal length of 125 characters and within the 512-character maximum. This is a warning.",
  },
  SCL040: {
    verdict: "true positive",
    why: "Inventory quantity is blank while an inventory tracker is set. The current column table says the default is 0. The older troubleshooting page says inventory quantity can't be blank. The two pages conflict, so this is a warning. Shopify's 2021-08-19, 2022-01-26, and 2023-06-01 samples do this on the medium t-shirt row.",
  },
  SCL044: {
    verdict: "true positive",
    why: "The Status column is present and blank on the product's first row. The product CSV page says that when the column is present it needs a value.",
  },
  SCL047: {
    verdict: "true positive",
    why: "Variant columns such as SKU or price are present without both Option1 name and Option1 value. This matters when you overwrite or update: a new default variant is created and existing variants are deleted. It is a warning.",
  },
};

function cell(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function ruleRows() {
  const lines = ["| Rule | False positives before | False positives after |", "| --- | --- | --- |"];
  for (let index = 1; index <= 50; index += 1) {
    const id = `SCL${String(index).padStart(3, "0")}`;
    const before = FALSE_POSITIVES_BEFORE[id] ?? 0;
    lines.push(`| ${id} | ${before} | 0 |`);
  }
  return lines.join("\n");
}

const names = readdirSync(filesDir)
  .filter((name) => name.endsWith(".csv"))
  .sort();

if (names.length < 25) {
  process.stderr.write(`run-corpus: expected at least 25 CSV files, found ${names.length}\n`);
  process.exit(1);
}

const reports = [];
for (const name of names) {
  const relative = `corpus/files/${name}`;
  const report = await lintFile(join(filesDir, name), { file: relative });
  reports.push({ name, relative, report });
}

const missing = new Map();
let falsePositives = 0;
for (const { relative, report } of reports) {
  for (const finding of report.findings) {
    const verdict = VERDICTS[finding.ruleId];
    if (!verdict) {
      const list = missing.get(finding.ruleId) ?? [];
      list.push(relative);
      missing.set(finding.ruleId, list);
      continue;
    }
    if (verdict.verdict !== "true positive") falsePositives += 1;
  }
}

const used = new Set();
for (const { report } of reports) {
  for (const finding of report.findings) used.add(finding.ruleId);
}

const parts = [];
parts.push("# Corpus");
parts.push("");
parts.push("Lint of the product CSVs committed in `corpus/files/`. Sources, licences, and sha256 values are in [corpus/SOURCES.md](../corpus/SOURCES.md).");
parts.push("");
parts.push("Every finding below was reviewed by hand against the Shopify help page its rule cites. A false positive is a finding on a file that is valid under that page. Those were fixed in the rules, and the review judged every finding that is left to be a true positive.");
parts.push("");
parts.push("That judgement is recorded once per rule in `scripts/run-corpus.mjs`, not once per finding, so \"false positives: 0\" is the result of the review and not a measurement. The script fails when a rule that fires has no recorded verdict or is marked as a false positive. It cannot see a new false positive from a rule it already marks as a true positive, so after a rule changes, re-read that rule's findings in the tables below.");
parts.push("");
parts.push("The first pass, before those fixes, false-positived on two rules: SCL004 four times (`Standard Product Type`, `Standardized Product Type`, and `Custom Product Type` on the 2022-01-26 sample and on a public copy of that sample) and SCL038 three times (decimal gram values `226.796185`, `283.4952313`, and `396.8933238` in the 2026-02-01 sample). The product CSV page says older column names stay compatible, and it does not say the importer rejects a decimal gram value. The sample file contains both. A later pass reads the column table's \"you should\" wording as a warning, so those three decimal values are true-positive warnings. `Variant Barcodes`, the header on the current sample, is accepted.");
parts.push("");
parts.push("## False positives by rule");
parts.push("");
parts.push(ruleRows());
parts.push("");
parts.push("After the fixes, no finding was judged a false positive.");
parts.push("");
parts.push("Files whose repository does not state a licence are not in this report. Their URLs and sha256 values are in `corpus/SOURCES.md`. `node scripts/fetch-corpus.mjs` downloads them and is not part of `npm test`.");
parts.push("");
const authored = reports.filter(({ name }) => SHOPIFY_AUTHORED.has(name));
const authoredErrors = authored.reduce((sum, item) => sum + item.report.errorCount, 0);
parts.push("## Warnings on files Shopify published");
parts.push("");
parts.push(
  `The ${authored.length} files Shopify published (the help-center templates, \`shopify-transporter-products.csv\`, and \`shopify-b2b-products-import.csv\`) give ${authoredErrors} error${authoredErrors === 1 ? "" : "s"}. They still draw warnings, listed here so a reader can judge them. A warning is not a claim that the importer rejects the file.`,
);
parts.push("");
parts.push("| File | Warnings by rule |");
parts.push("| --- | --- |");
for (const { name, report } of authored) {
  const byRule = new Map();
  for (const finding of report.findings) {
    if (finding.severity !== "warning") continue;
    byRule.set(finding.ruleId, (byRule.get(finding.ruleId) ?? 0) + 1);
  }
  const text = byRule.size === 0 ? "none" : [...byRule.entries()].sort().map(([id, n]) => `${id} x${n}`).join(", ");
  parts.push(`| \`${name}\` | ${text} |`);
}
parts.push("");
parts.push("SCL040 stays a warning on Shopify's own 2021, 2022, and 2023 templates. They leave the inventory quantity blank under an inventory tracker, the current column table says the default is 0, and the older troubleshooting page says a blank quantity is an error. Both pages are quoted in `docs/RULES.md`.");
parts.push("");
parts.push("## Files");
parts.push("");

for (const { name, relative, report } of reports) {
  parts.push(`### ${name}`);
  parts.push("");
  parts.push(`\`${relative}\`. ${report.errorCount} error${report.errorCount === 1 ? "" : "s"}, ${report.warningCount} warning${report.warningCount === 1 ? "" : "s"}, ${report.dataRows} data row${report.dataRows === 1 ? "" : "s"}, ${report.products} product${report.products === 1 ? "" : "s"}.`);
  parts.push("");
  if (report.findings.length === 0) {
    parts.push("No findings.");
    parts.push("");
    continue;
  }
  const counts = new Map();
  for (const finding of report.findings) {
    const key = `${finding.ruleId} ${finding.severity}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  parts.push("| Rule | Severity | Count |");
  parts.push("| --- | --- | --- |");
  for (const [key, count] of [...counts.entries()].sort()) {
    const [ruleId, severity] = key.split(" ");
    parts.push(`| ${ruleId} | ${severity} | ${count} |`);
  }
  parts.push("");
  parts.push("| Row | Column | Rule | Severity | Verdict |");
  parts.push("| --- | --- | --- | --- | --- |");
  for (const finding of report.findings) {
    const verdict = VERDICTS[finding.ruleId]?.verdict ?? "unclassified";
    parts.push(`| ${cell(finding.row)} | ${cell(finding.column)} | ${finding.ruleId} | ${finding.severity} | ${verdict} |`);
  }
  parts.push("");
}

parts.push("## Why each finding is a true positive");
parts.push("");
for (const ruleId of [...used].sort()) {
  const verdict = VERDICTS[ruleId];
  parts.push(`### ${ruleId}`);
  parts.push("");
  parts.push(verdict.why);
  parts.push("");
}

const markdown = `${parts.join("\n")}`;
writeFileSync(join(root, "docs", "CORPUS.md"), markdown);

const findingCount = reports.reduce((sum, item) => sum + item.report.findings.length, 0);
const errorCount = reports.reduce((sum, item) => sum + item.report.errorCount, 0);
const warningCount = reports.reduce((sum, item) => sum + item.report.warningCount, 0);
process.stdout.write(`${names.length} files\n`);
process.stdout.write(`${findingCount} findings (${errorCount} errors, ${warningCount} warnings)\n`);
process.stdout.write(`false positives: ${falsePositives} (hand review, one verdict per rule)\n`);
process.stdout.write("wrote docs/CORPUS.md\n");

if (missing.size > 0) {
  for (const [ruleId, files] of missing) {
    process.stderr.write(`run-corpus: no verdict for ${ruleId} (${files.join(", ")})\n`);
  }
  process.exit(1);
}
if (falsePositives > 0) process.exit(1);
