import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createWriteStream, mkdtempSync, readFileSync } from "node:fs";
import { mkdtemp, open, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { csv } from "./helpers.ts";
import { FILE_SIZE_DECIMAL, FILE_SIZE_LIMIT, formatText, lintCsv, lintFile } from "../dist/index.js";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

describe("limits", () => {
  it("binds a different header case, warns once, and adds no other finding", () => {
    const report = lintCsv("title,URL handle\nHat,hat\n");
    assert.equal(report.errorCount, 0);
    assert.deepEqual(report.findings.map((finding) => finding.ruleId), ["SCL005"]);
    assert.equal(report.findings[0]?.severity, "warning");
    assert.equal(report.ok, true);
  });

  it("warns only on trailing whitespace at the end of the header line", () => {
    const leading = lintCsv("Title, URL handle\nHat,hat\n");
    assert.equal(leading.findings.some((finding) => finding.ruleId === "SCL007"), false);
    assert.equal(leading.errorCount, 0);
    const trailing = lintCsv(csv([["Title", "URL handle "], ["Hat", "hat"]]));
    assert.equal(trailing.findings.some((finding) => finding.ruleId === "SCL007"), true);
  });

  it("ignores an empty extra cell and warns on a non-empty one", () => {
    const empty = lintCsv("Title,URL handle\nHat,hat,\n");
    assert.equal(empty.findings.some((finding) => finding.ruleId === "SCL013"), false);
    const extra = lintCsv("Title,URL handle\nHat,hat,spare\n");
    assert.equal(extra.findings.some((finding) => finding.ruleId === "SCL013" && finding.severity === "warning"), true);
    assert.equal(extra.errorCount, 0);
  });

  it("accepts .99 and trimmed prices, and warns on a thousands comma", () => {
    const fine = lintCsv(csv([
      ["Title", "URL handle", "Price", "Compare-at price"],
      ["Hat", "hat", ".99", " 1.50"],
    ]));
    assert.equal(fine.findings.some((finding) => finding.ruleId === "SCL025"), false);
    const comma = lintCsv(csv([["Title", "URL handle", "Price"], ["Hat", "hat", "1,299.00"]]));
    const hit = comma.findings.find((finding) => finding.ruleId === "SCL025");
    assert.equal(hit?.severity, "warning");
    assert.equal(comma.errorCount, 0);
    const symbol = lintCsv(csv([["Title", "URL handle", "Price"], ["Hat", "hat", "$9.99"]]));
    assert.equal(symbol.findings.find((finding) => finding.ruleId === "SCL025")?.severity, "error");
  });

  it("warns on an unlisted inventory tracker and on market Included", () => {
    const tracker = lintCsv(csv([
      ["Title", "URL handle", "Inventory tracker", "Inventory quantity"],
      ["Hat", "hat", "webgistix", "4"],
    ]));
    assert.equal(tracker.findings.find((finding) => finding.ruleId === "SCL027")?.severity, "warning");
    assert.equal(tracker.errorCount, 0);
    const market = lintCsv(csv([["Title", "URL handle", "Included / International"], ["Hat", "hat", "yes"]]));
    assert.equal(market.findings.find((finding) => finding.ruleId === "SCL027")?.severity, "warning");
    assert.equal(market.errorCount, 0);
  });

  it("counts distinct image URLs across product and variant columns", () => {
    const rows: string[][] = [[
      "Title",
      "URL handle",
      "Option1 name",
      "Option1 value",
      "Price",
      "Product image URL",
      "Variant image URL",
    ]];
    for (let index = 0; index < 130; index += 1) {
      const url = `https://cdn.example.com/p${index}.jpg`;
      rows.push([
        index === 0 ? "Hat" : "",
        "hat",
        index === 0 ? "Size" : "",
        `V${index}`,
        "10",
        url,
        url,
      ]);
    }
    const report = lintCsv(csv(rows));
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL034"), false);
  });

  it("does not throw on a malformed percent in an image URL", () => {
    for (const url of [
      "https://cdn.example.com/100%_cotton.jpg",
      "https://x.com/50%-off.jpg",
    ]) {
      const report = lintCsv(`Title,URL handle,Product image URL\nHat,hat,${url}\n`);
      assert.equal(report.findings.some((finding) => finding.ruleId === "SCL012"), false);
    }
  });

  it("does not treat a CJK tag as accented", () => {
    const report = lintCsv(csv([["Title", "URL handle", "Tags"], ["Hat", "hat", "帽子"]]));
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL032"), false);
    const accented = lintCsv(csv([["Title", "URL handle", "Tags"], ["Hat", "hat", "café"]]));
    assert.equal(accented.findings.some((finding) => finding.ruleId === "SCL032"), true);
  });

  it("flags a partial packed header only when a shipped row has a value", () => {
    const blank = lintCsv(csv([
      ["Title", "URL handle", "Requires shipping", "Packed product length"],
      ["Hat", "hat", "true", ""],
    ]));
    assert.equal(blank.findings.some((finding) => finding.ruleId === "SCL043"), false);
    const digital = lintCsv(csv([
      ["Title", "URL handle", "Requires shipping", "Packed product length"],
      ["Hat", "hat", "false", "10"],
    ]));
    assert.equal(digital.findings.some((finding) => finding.ruleId === "SCL043"), false);
    const physical = lintCsv(csv([
      ["Title", "URL handle", "Requires shipping", "Packed product length"],
      ["Hat", "hat", "true", "10"],
    ]));
    assert.equal(physical.findings.find((finding) => finding.ruleId === "SCL043")?.severity, "error");
  });

  it("escapes a bare carriage return in a finding message", () => {
    const report = lintCsv('Title,URL handle,Price\nHat,hat,"x\ry"\n');
    const hit = report.findings.find((finding) => finding.ruleId === "SCL025");
    assert.ok(hit);
    assert.equal(hit.message.includes("\r"), false);
    assert.match(hit.message, /\\r/);
    assert.doesNotMatch(hit.message, /\\\\r/);
  });

  it("reports an unclosed quote at the line where it opened", () => {
    const report = lintCsv('Title,URL handle\nHat,hat\n"open\n');
    assert.equal(report.findings[0]?.ruleId, "SCL012");
    assert.equal(report.findings[0]?.row, 3);
    assert.match(report.findings[0]?.message ?? "", /^Line 3: quote opened here is never closed$/);
  });

  it("keeps the first 100 findings per rule and records the rest", () => {
    const headers = ["Title", "URL handle"];
    const values = ["Hat", "hat"];
    for (let index = 0; index < 150; index += 1) {
      headers.push(`Notes ${index}`);
      values.push("x");
    }
    const report = lintCsv(csv([headers, values]));
    const shown = report.findings.filter((finding) => finding.ruleId === "SCL004");
    assert.equal(shown.length, 100);
    assert.equal(report.truncated?.SCL004, 50);
    assert.equal(report.warningCount, 150);
    assert.match(JSON.stringify(report), /"truncated"/);
  });

  it("warns inside the 15 MB band and errors only above 15 MiB", () => {
    assert.equal(FILE_SIZE_DECIMAL, 15_000_000);
    assert.equal(FILE_SIZE_LIMIT, 15_728_640);
    const exact = lintCsv("Title,URL handle\nHat,hat\n", { byteLength: FILE_SIZE_DECIMAL });
    assert.equal(exact.findings.some((finding) => finding.ruleId === "SCL011"), false);
    const band = lintCsv("Title,URL handle\nHat,my hat\n", { byteLength: FILE_SIZE_DECIMAL + 1 });
    assert.equal(band.findings.find((finding) => finding.ruleId === "SCL011")?.severity, "warning");
    assert.equal(band.findings.some((finding) => finding.ruleId === "SCL015"), true);
    const top = lintCsv("Title,URL handle\nHat,hat\n", { byteLength: FILE_SIZE_LIMIT });
    assert.equal(top.findings.find((finding) => finding.ruleId === "SCL011")?.severity, "warning");
    assert.equal(top.errorCount, 0);
    const over = lintCsv("Title,URL handle\nHat,my hat\n", { byteLength: FILE_SIZE_LIMIT + 1 });
    assert.deepEqual(over.findings.map((finding) => finding.ruleId), ["SCL011"]);
    assert.equal(over.findings[0]?.severity, "error");
  });

  it("looks up 20000 market columns without a quadratic scan", () => {
    const headers = ["Title", "URL handle", "Price"];
    const values = ["Hat", "hat", "10"];
    for (let index = 0; index < 20_000; index += 1) {
      headers.push(`Price / M${index}`, `Compare-at price / M${index}`);
      values.push("10", "12");
    }
    const started = Date.now();
    const report = lintCsv(csv([headers, values]));
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 5_000, `elapsed ${elapsed}ms`);
    assert.equal(report.errorCount, 0);
  });

  it("stops a pipe once the bytes read pass 15 MiB", async () => {
    const dir = await mkdtemp(join(tmpdir(), "catalog-csv-lint-fifo-"));
    const fifo = join(dir, "in.csv");
    const made = spawnSync("mkfifo", [fifo]);
    assert.equal(made.status, 0);
    const pending = lintFile(fifo);
    const fh = await open(fifo, "w");
    const chunk = Buffer.alloc(1024 * 1024, 0x61);
    try {
      for (let index = 0; index < 20; index += 1) await fh.write(chunk);
    } catch {
      // The reader closes the pipe after the size limit.
    }
    await fh.close().catch(() => undefined);
    const report = await pending;
    assert.equal(report.findings[0]?.ruleId, "SCL011");
    assert.equal(report.findings[0]?.severity, "error");
    assert.ok(report.bytes > FILE_SIZE_LIMIT);
    assert.ok(report.bytes < 18_000_000, `read ${report.bytes}`);
    assert.match(report.findings[0]?.message ?? "", /the input is more than 15728640 bytes \(15 MiB\); reading stopped after \d+ bytes/);
  });

  it("lints a 14.9 MB file under 200 MB RSS", async () => {
    const dir = await mkdtemp(join(tmpdir(), "catalog-csv-lint-mem-"));
    const valid = join(dir, "valid.csv");
    await writeSized(valid, 14_900_000, (index) => {
      const handle = `h${String(index).padStart(7, "0")}`;
      return `Hat,${handle},${"a".repeat(120)},10\n`;
    }, "Title,URL handle,Description,Price\n");
    const script = join(dir, "run.mjs");
    await writeFile(script, `
import { lintFile } from ${JSON.stringify(fileURLToPath(new URL("../dist/lint.js", import.meta.url)))};
const valid = await lintFile(${JSON.stringify(valid)});
process.stdout.write(JSON.stringify({
  rss: process.memoryUsage().rss,
  validErrors: valid.errorCount,
  validRows: valid.dataRows,
}));
`);
    const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 60_000 });
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout) as { rss: number; validErrors: number; validRows: number };
    assert.equal(body.validErrors, 0);
    assert.ok(body.validRows > 1000);
    assert.ok(body.rss < 200 * 1024 * 1024, `rss ${body.rss}`);
    const info = await stat(valid);
    assert.ok(info.size >= 14_900_000);
  });

  // The 14.9 MB form of these floods (about 7.4 million one-cell rows) finishes in about 6 s on a
  // busy laptop. Before rows were built sparsely it took 20 to 44 s, because every row paid for
  // every mapped column. These are scaled down and compare against a narrow header, so a slow
  // machine does not fail them and a cost that grows with the header width does.
  it("lints one-cell rows under the 61-column sample header in time that follows the row count", async () => {
    const dir = await mkdtemp(join(tmpdir(), "catalog-csv-lint-flood-"));
    const sample = readFileSync(new URL("./fixtures/shopify/product_template.csv", import.meta.url), "utf8");
    const wideHeader = `${sample.split(/\r?\n/)[0]}\n`;
    assert.equal(wideHeader.split(",").length, 61);
    const bytes = 2_500_000;
    const wide = join(dir, "wide.csv");
    const narrow = join(dir, "narrow.csv");
    await writeSized(wide, bytes, () => "a\n", wideHeader);
    await writeSized(narrow, bytes, () => "a\n", "Title,URL handle\n");
    const time = async (file: string): Promise<number> => {
      const started = performance.now();
      const report = await lintFile(file);
      const elapsed = performance.now() - started;
      assert.ok(report.dataRows > 1_000_000, `rows ${report.dataRows}`);
      return elapsed;
    };
    const narrowMs: number[] = [];
    const wideMs: number[] = [];
    for (let round = 0; round < 2; round += 1) {
      narrowMs.push(await time(narrow));
      wideMs.push(await time(wide));
    }
    const best = Math.min(...wideMs);
    const control = Math.min(...narrowMs);
    assert.ok(best < 10_000 * (bytes / 14_900_000) * 3, `wide ${Math.round(best)} ms`);
    assert.ok(best < control * 3, `wide ${Math.round(best)} ms, narrow ${Math.round(control)} ms`);
  });

  it("lints 20000 one-cell rows under 40000 market columns without scanning every column per row", () => {
    const headers = ["Title", "URL handle", "Price"];
    for (let index = 0; index < 20_000; index += 1) {
      headers.push(`Price / M${index}`, `Compare-at price / M${index}`);
    }
    const rows = Array.from({ length: 20_000 }, () => "a").join("\n");
    const started = performance.now();
    const report = lintCsv(`${headers.join(",")}\n${rows}\n`);
    const elapsed = performance.now() - started;
    assert.equal(report.dataRows, 20_000);
    assert.ok(elapsed < 5_000, `elapsed ${Math.round(elapsed)} ms`);
  });

  it("looks up a header name in constant time when the column is far to the right", () => {
    const headers = ["SKU", "Title"];
    for (let index = 0; index < 50_000; index += 1) headers.push(`Note ${index}`);
    headers.push("Price");
    const rows = Array.from({ length: 20_000 }, () => "a").join("\n");
    const started = performance.now();
    const report = lintCsv(`${headers.join(",")}\n${rows}\n`);
    const elapsed = performance.now() - started;
    assert.equal(report.dataRows, 20_000);
    assert.equal(report.findings.find((finding) => finding.ruleId === "SCL024")?.column, "Price");
    assert.ok(elapsed < 5_000, `elapsed ${Math.round(elapsed)} ms`);
  });

  it("keeps the first column bound to a field even when its cell is blank", () => {
    const report = lintCsv("Title,URL handle,Price,Variant Price\nHat,hat,,9.99\n");
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL024"), true);
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL006"), true);
  });

  it("skips a row whose cells are all blank and names the column of a finding", () => {
    const report = lintCsv(csv([["Title", "URL handle", "Price"], ["Hat", "hat", "$5"], ["", "", ""], ["Cap", "cap", ""]]));
    assert.equal(report.dataRows, 2);
    assert.equal(report.findings.find((finding) => finding.ruleId === "SCL025")?.column, "Price");
  });

  it("escapes control characters in a header name and in a value, in the message and the text report", () => {
    const nel = String.fromCharCode(0x85);
    const lineSeparator = String.fromCharCode(0x2028);
    const paragraphSeparator = String.fromCharCode(0x2029);
    const del = String.fromCharCode(0x7f);
    const nul = String.fromCharCode(0);
    const any = new RegExp("[\\p{Cc}\\p{Zl}\\p{Zp}]", "u");
    const text = csv([
      ["Title", "URL handle", "Price", "Bad\nHeader", `Wide${nul}${nel}`],
      ["Hat", "hat", `$${lineSeparator}${paragraphSeparator}${nel}${del}`, "x", "y"],
    ]);
    const report = lintCsv(text);
    assert.ok(report.findings.length >= 3);
    for (const finding of report.findings) {
      assert.doesNotMatch(finding.message, any, finding.message);
    }
    const header = report.findings.find((finding) => finding.column === "Bad\nHeader");
    assert.ok(header);
    assert.match(header.message, /^Row 1, column Bad\\nHeader: /);
    const price = report.findings.find((finding) => finding.ruleId === "SCL025");
    assert.ok(price);
    assert.match(price.message, /\\u2028\\u2029\\u0085\\u007f/);
    const printed = formatText(report);
    const withoutLineFeeds = printed.replaceAll("\n", "");
    assert.doesNotMatch(withoutLineFeeds, any);
    assert.ok(printed.includes("  warning SCL004  Bad\\nHeader\n"));
  });

  it("reports the size of a regular file above 15 MiB, and the bytes read for a pipe", async () => {
    const dir = await mkdtemp(join(tmpdir(), "catalog-csv-lint-big-"));
    const big = join(dir, "big.csv");
    const total = FILE_SIZE_LIMIT + 4_000_001;
    await writeSized(big, total, () => "Hat,hat\n", "Title,URL handle\n");
    const size = (await stat(big)).size;
    const report = await lintFile(big);
    assert.equal(report.findings[0]?.ruleId, "SCL011");
    assert.equal(report.bytes, size);
    assert.match(report.findings[0]?.message ?? "", new RegExp(`the file is ${size} bytes`));
  });

  it("reports a directory as an I/O error, not as bad UTF-8", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-dir-"));
    const result = spawnSync(process.execPath, [cli, dir], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /EISDIR|directory/i);
    assert.doesNotMatch(result.stdout, /SCL010/);
    assert.doesNotMatch(result.stderr, /SCL010/);
  });
});

async function writeSized(
  path: string,
  bytes: number,
  row: (index: number) => string,
  header: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(path);
    stream.on("error", reject);
    stream.write(header);
    let size = Buffer.byteLength(header);
    let index = 0;
    function more(): void {
      let ok = true;
      while (size < bytes && ok) {
        const line = row(index);
        index += 1;
        size += Buffer.byteLength(line);
        ok = stream.write(line);
      }
      if (size < bytes) stream.once("drain", more);
      else stream.end(() => resolve());
    }
    more();
  });
}
