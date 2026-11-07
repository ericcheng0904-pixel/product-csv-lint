import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, linkSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FILE_SIZE_LIMIT, fixCsv, formatFixPreface, formatJson, lintCsv, matchHeader, parseCsv, type Finding, type FixChange } from "../dist/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function sameInode(left: string, right: string): boolean {
  try {
    const a = statSync(left);
    const b = statSync(right);
    return a.dev === b.dev && a.ino === b.ino;
  } catch {
    return false;
  }
}

function run(args: string[], cwd = root): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function ready(text: string): { fixes: FixChange[]; text: string | null } {
  const result = fixCsv(text);
  assert.equal(result.ok, true, result.ok ? "" : result.message);
  if (!result.ok) throw new Error("unreachable");
  return result;
}

function linesOf(fixes: FixChange[]): string[] {
  return fixes.map((fix) => {
    if (fix.ruleId === "SCL016" && Array.isArray(fix.before) && Array.isArray(fix.after)) {
      return `SCL016  ${JSON.stringify(fix.column)}  ${fix.before.join(", ")} → ${fix.after.join(", ")}`;
    }
    const row = fix.row === 1 ? "header" : String(fix.row);
    return `${row}  ${JSON.stringify(fix.column)}  ${fix.ruleId}  ${JSON.stringify(fix.before)} → ${JSON.stringify(fix.after)}`;
  });
}

describe("fixCsv", () => {
  it("does not import Node file APIs", () => {
    const source = readFileSync(new URL("../src/fix.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /node:fs|node:path|node:buffer|from ["']fs["']|from ["']path["']|\bBuffer\b/);
  });

  it("trims trailing whitespace from every header name", () => {
    const result = ready("Title ,URL handle,Price \nHat,hat,10\n");
    assert.deepEqual(linesOf(result.fixes), [
      'header  "Title "  SCL007  "Title " → "Title"',
      'header  "Price "  SCL007  "Price " → "Price"',
    ]);
    assert.equal(result.text, "Title,URL handle,Price\nHat,hat,10\n");
    const kept = ready("Title,URL handle, Price\nHat,hat,10\n");
    assert.equal(kept.text, null);
    assert.deepEqual(kept.fixes, []);
    const blank = ready("Title,URL handle,   \nHat,hat,\n");
    assert.equal(blank.text, null);
  });

  it("renames a header to the documented spelling when it is the only one for that column", () => {
    const result = ready("title,URL handle,price\nHat,hat,10\n");
    assert.deepEqual(linesOf(result.fixes), [
      'header  "title"  SCL005  "title" → "Title"',
      'header  "price"  SCL005  "price" → "Price"',
    ]);
    assert.equal(result.text, "Title,URL handle,Price\nHat,hat,10\n");
    const category = ready("PRODUCT CATEGORY,Title\nHats,Hat\n");
    assert.equal(category.text, "Product category,Title\nHats,Hat\n");
    const gift = ready("gift card,Title\nfalse,Hat\n");
    assert.equal(gift.text, "Gift card,Title\nfalse,Hat\n");
    const legacy = ready("Handle,Title,Gift Card\nhat,Hat,false\n");
    assert.equal(legacy.text, null);
    const leading = ready(" Price,Title\n10,Hat\n");
    assert.equal(leading.text, null);
    const both = ready(" price ,Title\n10,Hat\n");
    assert.deepEqual(linesOf(both.fixes), [
      'header  " price "  SCL007  " price " → " price"',
      'header  " price "  SCL005  " price" → "Price"',
    ]);
    assert.equal(both.text, "Price,Title\n10,Hat\n");
  });

  it("does not rename a header that collides with another header for the same column", () => {
    const same = ready("title,Title,URL handle\nHat,Cap,hat\n");
    assert.equal(same.text, null);
    assert.equal(same.fixes.some((fix) => fix.ruleId === "SCL005"), false);
    const legacy = ready("price,Variant Price,Title\n$5,6,Hat\n");
    assert.deepEqual(linesOf(legacy.fixes), ['2  "price"  SCL025  "$5" → "5"']);
    assert.equal(legacy.text, "price,Variant Price,Title\n5,6,Hat\n");
    assert.equal(matchHeader("price")?.documented, "Price");
  });

  it("moves split handle rows together and leaves blank handles with the row above", () => {
    const split = ready("Title,URL handle\nHat,hat\nCoat,coat\nHat,hat\nMitt,mitt\n");
    assert.deepEqual(linesOf(split.fixes), [
      'SCL016  "hat"  2, 4 → 2, 3',
      'SCL016  "coat"  3 → 4',
    ]);
    assert.equal(split.text, "Title,URL handle\nHat,hat\nHat,hat\nCoat,coat\nMitt,mitt\n");

    const order = ready("Title,URL handle\nCoat,coat\nHat,hat\nCoat,coat\n");
    assert.equal(order.text, "Title,URL handle\nCoat,coat\nCoat,coat\nHat,hat\n");

    const inside = ready("Title,URL handle\nA1,a\nB,b\nA2,a\nA3,a\n");
    assert.equal(inside.text, "Title,URL handle\nA1,a\nA2,a\nA3,a\nB,b\n");

    const blank = ready("Title,URL handle\nHat,hat\nExtra,\nCoat,coat\nGloves,hat\n");
    assert.equal(blank.text, "Title,URL handle\nHat,hat\nExtra,\nGloves,hat\nCoat,coat\n");
    assert.deepEqual(linesOf(blank.fixes), [
      'SCL016  "hat"  2, 5 → 2, 4',
      'SCL016  "coat"  4 → 5',
    ]);

    const lead = ready("Title,URL handle\n,\nHat,hat\nCoat,coat\nHat,hat\n");
    assert.equal(lead.text, "Title,URL handle\n,\nHat,hat\nHat,hat\nCoat,coat\n");

    const already = ready("Title,URL handle\nHat,hat\n,hat\nCoat,coat\n");
    assert.equal(already.text, null);
  });

  it("removes one currency symbol or uppercase code from price, compare-at, and cost", () => {
    const input = [
      "Title,URL handle,Price,Compare-at price,Cost per item",
      "Hat,hat,$12.00,EUR 30.5,12.50 £",
      "Cap,cap,¥ 12.00,USD12,  €9.5 ",
      "Pin,pin,0.99 CAD,$12.5,12.00USD",
    ].join("\n") + "\n";
    const result = ready(input);
    assert.deepEqual(
      result.fixes.map((fix) => `${fix.row} ${fix.column} ${fix.before} → ${fix.after}`),
      [
        "2 Price $12.00 → 12.00",
        "2 Compare-at price EUR 30.5 → 30.5",
        "2 Cost per item 12.50 £ → 12.50",
        "3 Price ¥ 12.00 → 12.00",
        "3 Compare-at price USD12 → 12",
        "3 Cost per item   €9.5  → 9.5",
        "4 Price 0.99 CAD → 0.99",
        "4 Compare-at price $12.5 → 12.5",
        "4 Cost per item 12.00USD → 12.00",
      ],
    );
    const parsed = parseCsv(result.text ?? "");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.records[1]!.values.slice(2), ["12.00", "30.5", "12.50"]);
    assert.deepEqual(parsed.records[2]!.values.slice(2), ["12.00", "12", "9.5"]);
    assert.deepEqual(parsed.records[3]!.values.slice(2), ["0.99", "12.5", "12.00"]);
  });

  it("leaves comma prices, minus signs, two symbols, and other money shapes", () => {
    const input = [
      "Title,URL handle,Price,Compare-at price,Cost per item",
      "Hat,hat,\"$1,200.00\",-$5,12.00 USD EUR",
      "Cap,cap,1,099.00,$-5,$12 USD",
      "Pin,pin,.99 USD,usd 12,12.345",
      "Mug,pin2,$$5,EUR 12.999,US$12",
      "Tag,tag,10 OFF,5 PCS,NEW 5",
      "Sku,sku,SKU123,12\tUSD,\"$\n12\"",
      "Ws,ws,\t$5,5\u00A0USD,EUR\t9",
    ].join("\n") + "\n";
    const result = ready(input);
    assert.equal(result.text, null);
    assert.deepEqual(result.fixes, []);
  });

  it("removes a gram suffix and does not convert or round", () => {
    const input = [
      "Title,URL handle,Weight value (grams),Weight unit for display,Variant Grams",
      "Hat,hat,5 g,g,",
      "Cap,cap,5g,kg,",
      "Coat,coat,  10 Grams  ,oz,",
      "Pin,pin,3 gram,g,",
      "Mug,mug,1.5 kg,kg,5.0 g",
      "Bag,bag,5 kg,lb,226.796185",
      "Box,box,5 lb,g,5 oz",
      "Tab,tab,5\tg,g,10\tgrams",
    ].join("\n") + "\n";
    const result = ready(input);
    assert.deepEqual(
      result.fixes.map((fix) => `${fix.row} ${fix.column} ${JSON.stringify(fix.before)} → ${JSON.stringify(fix.after)}`),
      [
        '2 Weight value (grams) "5 g" → "5"',
        '3 Weight value (grams) "5g" → "5"',
        '4 Weight value (grams) "  10 Grams  " → "10"',
        '5 Weight value (grams) "3 gram" → "3"',
      ],
    );
    const parsed = parseCsv(result.text ?? "");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(
      parsed.records.slice(1).map((record) => [record.values[2], record.values[3], record.values[4]]),
      [
        ["5", "g", ""],
        ["5", "kg", ""],
        ["10", "oz", ""],
        ["3", "g", ""],
        ["1.5 kg", "kg", "5.0 g"],
        ["5 kg", "lb", "226.796185"],
        ["5 lb", "g", "5 oz"],
        ["5\tg", "g", "10\tgrams"],
      ],
    );
  });

  it("does not rewrite handles, image URLs, status, tags, lengths, or market prices", () => {
    const input = [
      "Title,URL handle,Status,Product image URL,Tags,SEO title,Price,Price / Canada,Weight value (grams)",
      "Hat,my hat,live,images/hat_thumb.jpg,café,This title is definitely longer than seventy characters so the length rule still fires,$12.00,$4.00,5 kg",
    ].join("\n") + "\n";
    const result = ready(input);
    assert.deepEqual(linesOf(result.fixes), ['2  "Price"  SCL025  "$12.00" → "12.00"']);
    const parsed = parseCsv(result.text ?? "");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.records[1]!.values, [
      "Hat",
      "my hat",
      "live",
      "images/hat_thumb.jpg",
      "café",
      "This title is definitely longer than seventy characters so the length rule still fires",
      "12.00",
      "$4.00",
      "5 kg",
    ]);
  });

  it("keeps quoting, line endings, a BOM, and a final newline", () => {
    const embedded = "\uFEFFTitle,Description,Price\r\nHat,\"line1\r\nline2, \"\"q\"\"\",\"$4.50\"";
    assert.equal(
      ready(embedded).text,
      "\uFEFFTitle,Description,Price\r\nHat,\"line1\r\nline2, \"\"q\"\"\",\"4.50\"",
    );
    assert.equal(ready("Title,Price\r\nHat,$4.50\r\n").text, "Title,Price\r\nHat,4.50\r\n");
    assert.equal(ready("Title,Price\rHat,$4\r").text, "Title,Price\rHat,4\r");
    assert.equal(ready("Title,Price\nHat,$4").text, "Title,Price\nHat,4");
    assert.equal(ready("\"Title\",Price\n\"Hat\",$4\n").text, "\"Title\",Price\n\"Hat\",4\n");
    assert.equal(ready("Title,Price\nHat,$4\r\nCap,$5\n").text, "Title,Price\nHat,4\r\nCap,5\n");
    assert.equal(ready("Title,Price\n\nHat,$4\n\n").text, "Title,Price\n\nHat,4\n\n");
    assert.equal(ready("\nTitle,Price\nHat,$4\n").text, "\nTitle,Price\nHat,4\n");
    assert.equal(
      ready("Title,URL handle\nHat,hat\r\nCoat,coat\nHat,hat\r\n").text,
      "Title,URL handle\nHat,hat\r\nHat,hat\r\nCoat,coat\n",
    );
    assert.equal(
      ready("Title,URL handle\nHat,hat\n\nCoat,coat\nHat,hat\n").text,
      "Title,URL handle\nHat,hat\n\nHat,hat\nCoat,coat\n",
    );
    assert.equal(
      ready("Title,URL handle\nHat,hat\nCoat,coat\nHat,hat").text,
      "Title,URL handle\nHat,hat\nHat,hat\nCoat,coat",
    );
    assert.equal(
      ready("Title,URL handle\r\nHat,hat\r\nCoat,coat\r\nHat,hat").text,
      "Title,URL handle\r\nHat,hat\r\nHat,hat\r\nCoat,coat",
    );
    assert.equal(
      ready("Title,URL handle\nHat,hat\n\nCoat,coat\nHat,hat").text,
      "Title,URL handle\nHat,hat\n\nHat,hat\nCoat,coat",
    );
    const parsed = parseCsv(ready(embedded).text ?? "");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.records[1]!.values, ["Hat", 'line1\r\nline2, "q"', "4.50"]);
  });

  it("reorders 200k interleaved rows without throwing", () => {
    const lines = ["Title,URL handle"];
    for (let index = 0; index < 100_000; index += 1) {
      lines.push("A,aa");
      lines.push("B,bb");
    }
    const result = fixCsv(`${lines.join("\n")}\n`);
    assert.equal(result.ok, true);
    if (!result.ok || result.text === null) return;
    assert.equal(result.fixes.length, 2);
    const rows = result.text.split("\n");
    assert.equal(rows[1], "A,aa");
    assert.equal(rows[100_000], "A,aa");
    assert.equal(rows[100_001], "B,bb");
    assert.equal(rows[200_000], "B,bb");
    assert.equal(rows[200_001], "");
  });

  it("escapes controls in the text change list and leaves them raw in JSON", () => {
    const handle = "ha\u009bt";
    const input = `Title,URL handle\nHat,${handle}\nCoat,coat\nHat,${handle}\n`;
    const result = ready(input);
    const preface = formatFixPreface(result.fixes);
    assert.equal(preface.includes("\u009b"), false);
    assert.equal(preface, 'SCL016  "ha\\u009bt"  2, 4 → 2, 3\nSCL016  "coat"  3 → 4\n\n');
    assert.equal(preface.includes("\\\\u009b"), false);
    const header = ready("Title,Price \u2028\nHat,1\n");
    const headerLine = formatFixPreface(header.fixes);
    assert.equal(headerLine.includes("\u2028"), false);
    assert.equal(headerLine, 'header  "Price \\u2028"  SCL007  "Price \\u2028" → "Price"\n\n');
    const tab = formatFixPreface(ready("Title,Price\t\nHat,1\n").fixes);
    assert.equal(tab, 'header  "Price\\t"  SCL007  "Price\\t" → "Price"\n\n');
    const json = formatJson(lintCsv(result.text ?? input, { file: "out.csv" }), {
      fixes: result.fixes,
      output: "out.csv",
    });
    const body = JSON.parse(json) as { fixes: Array<{ column: string }> };
    assert.equal(body.fixes[0]?.column, handle);
  });

  it("blocks a quote error and a missing header without a rewrite", () => {
    const quote = fixCsv("Title,URL handle\n\"Hat,hat\n");
    assert.equal(quote.ok, false);
    if (quote.ok) return;
    assert.equal(quote.ruleId, "SCL012");
    assert.equal(quote.message, "Line 2: quote opened here is never closed");
    const empty = fixCsv("");
    assert.equal(empty.ok, false);
    if (empty.ok) return;
    assert.equal(empty.ruleId, "SCL014");
    const blank = fixCsv("\n");
    assert.equal(blank.ok, false);
    if (blank.ok) return;
    assert.equal(blank.ruleId, "SCL014");
  });
});

describe("fix CLI", () => {
  it("mentions --fix in help", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /--fix OUT\.csv/);
    assert.match(result.stdout, /--force/);
  });

  it("writes the corrected file, then exits with the check of that file", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-fix-"));
    const input = join(dir, "in.csv");
    const output = join(dir, "out.csv");
    writeFileSync(input, "Title,URL handle,Price,Gift card\nHat,hat,$1.00,true\n");
    const fixed = run([input, "--fix", output]);
    assert.equal(fixed.stderr, "");
    assert.equal(fixed.status, 0);
    assert.match(fixed.stdout, /^2 {2}"Price" {2}SCL025 {2}"\$1\.00" → "1\.00"\n\n/);
    assert.match(fixed.stdout, /SCL045/);
    assert.equal(readFileSync(output, "utf8"), "Title,URL handle,Price,Gift card\nHat,hat,1.00,true\n");
    const capped = run([input, "--fix", join(dir, "capped.csv"), "--max-warnings", "0", "--force"]);
    assert.equal(capped.status, 1);
    assert.match(capped.stdout, /over the --max-warnings limit of 0/);
  });

  it("does not write a file when no fix applies", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-fix-"));
    const input = join(dir, "in.csv");
    const output = join(dir, "out.csv");
    writeFileSync(input, "Title,URL handle\nHat,my hat\n");
    const result = run([input, "--fix", output]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^No automatic fixes apply\.\n\n/);
    assert.match(result.stdout, /SCL015/);
    assert.equal(existsSync(output), false);
  });

  it("keeps a UTF-8 BOM in the written copy and counts it in the reported size", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-fix-"));
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const input = join(dir, "bom.csv");
    const output = join(dir, "bom-out.csv");
    writeFileSync(input, Buffer.concat([bom, Buffer.from("title,price\nT,$1\n")]));
    const fixed = run([input, "--fix", output]);
    assert.equal(fixed.status, 0);
    const written = readFileSync(output);
    assert.deepEqual([...written.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(written.subarray(3).toString("utf8"), "Title,Price\nT,1\n");
    const json = run([input, "--fix", join(dir, "bom-out-2.csv"), "--json"]);
    const body = JSON.parse(json.stdout) as { bytes: number };
    assert.equal(body.bytes, statSync(join(dir, "bom-out-2.csv")).size);

    const clean = join(dir, "bom-clean.csv");
    const cleanOut = join(dir, "bom-clean-out.csv");
    writeFileSync(clean, Buffer.concat([bom, Buffer.from("Title,Price\nT,1\n")]));
    const none = run([clean, "--fix", cleanOut, "--json"]);
    assert.equal(existsSync(cleanOut), false);
    const noneBody = JSON.parse(none.stdout) as { bytes: number; output: string | null };
    assert.equal(noneBody.output, null);
    assert.equal(noneBody.bytes, statSync(clean).size);
    const plain = JSON.parse(run([clean, "--json"]).stdout) as { bytes: number };
    assert.equal(noneBody.bytes, plain.bytes);
  });

  it("keeps a file without a final newline when a move changes the last row", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-fix-"));
    const input = join(dir, "in.csv");
    const output = join(dir, "out.csv");
    writeFileSync(input, "URL handle,Title,Price\na,A1,1\nb,B1,1\na,A2,1");
    const result = run([input, "--fix", output]);
    assert.equal(result.status, 0);
    assert.equal(readFileSync(output, "utf8"), "URL handle,Title,Price\na,A1,1\na,A2,1\nb,B1,1");
  });

  it("refuses an existing output, the input path, and each blocking error, and writes nothing", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-fix-"));
    const input = join(dir, "in.csv");
    const output = join(dir, "out.csv");
    const body = "Title,URL handle,Price\nHat,hat,$1\n";
    writeFileSync(input, body);
    writeFileSync(output, "keep\n");
    const exists = run([input, "--fix", output]);
    assert.equal(exists.status, 1);
    assert.match(exists.stderr, /already exists/);
    assert.equal(exists.stdout, "");
    assert.equal(readFileSync(output, "utf8"), "keep\n");

    const forced = run([input, "--fix", output, "--force"]);
    assert.equal(forced.status, 0);
    assert.equal(readFileSync(output, "utf8"), "Title,URL handle,Price\nHat,hat,1\n");

    writeFileSync(input, body);
    const same = run(["in.csv", "--fix", "./in.csv"], dir);
    assert.equal(same.status, 1);
    assert.match(same.stderr, /input file/);
    assert.equal(readFileSync(input, "utf8"), body);
    const forcedSame = run(["in.csv", "--fix", "./in.csv", "--force"], dir);
    assert.equal(forcedSame.status, 1);
    assert.match(forcedSame.stderr, /input file/);
    assert.equal(readFileSync(input, "utf8"), body);

    const link = join(dir, "linked.csv");
    linkSync(input, link);
    assert.equal(statSync(input).ino, statSync(link).ino);
    for (const args of [
      [input, "--fix", link],
      [input, "--fix", link, "--force"],
    ]) {
      const result = run(args);
      assert.equal(result.status, 1, args.join(" "));
      assert.match(result.stderr, /input file/, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.equal(readFileSync(input, "utf8"), body, args.join(" "));
    }

    const alias = join(dir, "in.CSV");
    const folds = sameInode(input, alias);
    if (folds) {
      for (const args of [
        ["In.csv", "--fix", "in.CSV"],
        ["In.csv", "--fix", "in.CSV", "--force"],
      ]) {
        const result = run(args, dir);
        assert.equal(result.status, 1, args.join(" "));
        assert.match(result.stderr, /input file/, args.join(" "));
        assert.equal(readFileSync(input, "utf8"), body, args.join(" "));
      }
    }

    const viaLink = join(dir, "via-link.csv");
    symlinkSync(input, viaLink);
    for (const args of [
      [input, "--fix", viaLink],
      [input, "--fix", viaLink, "--force"],
    ]) {
      const result = run(args);
      assert.equal(result.status, 1, args.join(" "));
      assert.match(result.stderr, /input file/, args.join(" "));
      assert.equal(readFileSync(input, "utf8"), body, args.join(" "));
    }

    const blocks: Array<{ name: string; bytes: Buffer | string; rule: string }> = [
      { name: "utf8.csv", bytes: Buffer.from([0xff, 0xfe, 0x41]), rule: "SCL010" },
      { name: "quote.csv", bytes: "Title,URL handle\n\"Hat,hat\n", rule: "SCL012" },
      { name: "empty.csv", bytes: "", rule: "SCL014" },
      { name: "big.csv", bytes: Buffer.alloc(FILE_SIZE_LIMIT + 1, 0x61), rule: "SCL011" },
    ];
    for (const block of blocks) {
      const source = join(dir, block.name);
      const dest = join(dir, `${block.name}.out.csv`);
      writeFileSync(source, block.bytes);
      const result = run([source, "--fix", dest]);
      assert.equal(result.status, 1, block.rule);
      assert.match(result.stderr, new RegExp(block.rule), block.rule);
      assert.equal(result.stdout, "", block.rule);
      assert.equal(existsSync(dest), false, block.rule);
      const json = run([source, "--fix", dest, "--json"]);
      assert.equal(json.status, 1, block.rule);
      const parsed = JSON.parse(json.stdout) as { schemaVersion: number; error: string };
      assert.equal(parsed.schemaVersion, 1, block.rule);
      assert.match(parsed.error, new RegExp(block.rule), block.rule);
      assert.match(json.stderr, new RegExp(block.rule), block.rule);
      assert.equal(existsSync(dest), false, block.rule);
    }
  });

  it("adds fixes and output to JSON, and leaves JSON without --fix unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-fix-"));
    const input = join(dir, "in.csv");
    const output = join(dir, "out.csv");
    writeFileSync(input, "Title,URL handle\nHat,hat\nCoat,coat\nHat,hat\n");
    const plain = run([input, "--json"]);
    assert.deepEqual(Object.keys(JSON.parse(plain.stdout)), [
      "schemaVersion",
      "file",
      "bytes",
      "dataRows",
      "products",
      "errorCount",
      "warningCount",
      "maxWarnings",
      "ok",
      "truncated",
      "findings",
    ]);
    const source = readFileSync(input, "utf8");
    assert.equal(plain.stdout, formatJson(lintCsv(source, { file: input })));

    const fixed = run([input, "--json", "--fix", output]);
    assert.equal(fixed.status, 0);
    const body = JSON.parse(fixed.stdout) as {
      schemaVersion: number;
      file: string;
      fixes: Array<{ ruleId: string; row: number | null; column: string; before: number[]; after: number[] }>;
      output: string;
      findings: unknown[];
    };
    assert.deepEqual(Object.keys(body), [
      "schemaVersion",
      "file",
      "bytes",
      "dataRows",
      "products",
      "errorCount",
      "warningCount",
      "maxWarnings",
      "ok",
      "truncated",
      "findings",
      "fixes",
      "output",
    ]);
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.file, output);
    assert.equal(body.output, output);
    assert.equal(body.fixes[0]?.ruleId, "SCL016");
    assert.equal(body.fixes[0]?.row, null);
    assert.equal(body.fixes[0]?.column, "hat");
    assert.deepEqual(body.fixes[0]?.before, [2, 4]);
    assert.deepEqual(body.fixes[0]?.after, [2, 3]);
    assert.deepEqual(body.fixes[1]?.before, [3]);
    assert.deepEqual(body.fixes[1]?.after, [4]);

    const none = join(dir, "none.csv");
    writeFileSync(none, "Title,URL handle\nHat,hat\n");
    const skipped = run([none, "--fix", join(dir, "skipped.csv"), "--json"]);
    const skippedBody = JSON.parse(skipped.stdout) as { file: string; fixes: unknown[]; output: null };
    assert.equal(skippedBody.file, none);
    assert.deepEqual(skippedBody.fixes, []);
    assert.equal(skippedBody.output, null);
    assert.equal(existsSync(join(dir, "skipped.csv")), false);
  });
});

function walkCsv(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walkCsv(rel));
    else if (name.endsWith(".csv")) out.push(rel);
  }
  return out;
}

function applyListed(records: string[][], fixes: FixChange[]): string[][] {
  const rows = records.map((row) => row.slice());
  for (const fix of fixes) {
    if (fix.ruleId === "SCL016" || fix.row === null) continue;
    if (typeof fix.before !== "string" || typeof fix.after !== "string") {
      throw new Error(`cell fix has row lists: ${fix.ruleId}`);
    }
    const row = rows[fix.row - 1];
    if (!row) throw new Error(`missing row ${fix.row}`);
    const index = row.findIndex((value, cell) => {
      if (value !== fix.before) return false;
      if (fix.row === 1) return true;
      return rows[0]![cell] === fix.column;
    });
    if (index === -1) throw new Error(`fix did not match a cell ${JSON.stringify(fix)}`);
    row[index] = fix.after;
  }
  return rows;
}

function handleAt(row: string[], index: number): string {
  return index < 0 ? "" : (row[index] ?? "");
}

function normFinding(finding: Finding, headerRewrites: Array<[string, string]>): string {
  let column = finding.column ?? "";
  let message = finding.message;
  for (const [before, after] of headerRewrites) {
    if (before === "") continue;
    column = column.split(before).join(after);
    message = message.split(before).join(after);
  }
  message = message.replace(/\b[Rr]ow \d+\b/g, "row N").replace(/\b[Ll]ine \d+\b/g, "line N");
  return `${finding.ruleId}|${column}|${message}`;
}

const MOVE_RULES = new Set([
  "SCL017",
  "SCL018",
  "SCL019",
  "SCL020",
  "SCL021",
  "SCL022",
  "SCL023",
  "SCL034",
]);

describe("fix round trip", () => {
  const files = [...walkCsv("corpus/files"), ...walkCsv("test/fixtures")].sort();

  it("keeps every other cell, and does not invent findings, for every corpus and fixture file", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalog-csv-lint-round-"));
    const output = join(dir, "out.csv");
    for (const rel of files) {
      const abs = join(root, rel);
      const original = readFileSync(abs, "utf8");
      const result = fixCsv(original);
      assert.equal(result.ok, true, rel);
      if (!result.ok) continue;
      if (existsSync(output)) unlinkSync(output);
      const cli = run([abs, "--fix", output]);
      assert.equal(cli.stderr, "", rel);
      if (result.text === null) {
        assert.deepEqual(result.fixes, [], rel);
        assert.equal(existsSync(output), false, rel);
        assert.match(cli.stdout, /^No automatic fixes apply\.\n/, rel);
        const report = lintCsv(original, { file: abs });
        assert.equal(cli.status, report.ok ? 0 : 1, rel);
        continue;
      }
      assert.equal(readFileSync(output, "utf8"), result.text, rel);
      const parsedIn = parseCsv(original);
      const parsedOut = parseCsv(result.text);
      assert.equal(parsedIn.ok, true, rel);
      assert.equal(parsedOut.ok, true, rel);
      if (!parsedIn.ok || !parsedOut.ok) continue;
      const expected = applyListed(
        parsedIn.records.map((record) => record.values),
        result.fixes,
      );
      const actual = parsedOut.records.map((record) => record.values);
      assert.equal(actual.length, expected.length, rel);
      assert.equal(result.text.startsWith("\uFEFF"), original.startsWith("\uFEFF"), rel);
      assert.equal(
        result.text.endsWith("\n") || result.text.endsWith("\r"),
        original.endsWith("\n") || original.endsWith("\r"),
        rel,
      );
      const handleIndex = parsedIn.records[0]!.values.findIndex((header) => matchHeader(header)?.field === "handle");
      const moved = result.fixes.some((fix) => fix.ruleId === "SCL016");
      if (!moved) {
        assert.deepEqual(actual, expected, rel);
      } else {
        assert.deepEqual(actual[0], expected[0], rel);
        const expectedData = expected.slice(1);
        const actualData = actual.slice(1);
        assert.deepEqual(
          actualData.map((row) => JSON.stringify(row)).sort(),
          expectedData.map((row) => JSON.stringify(row)).sort(),
          rel,
        );
        const handles = new Set<string>();
        for (const row of expectedData) {
          const handle = handleAt(row, handleIndex);
          if (handle !== "") handles.add(handle);
        }
        for (const handle of handles) {
          assert.deepEqual(
            actualData.filter((row) => handleAt(row, handleIndex) === handle),
            expectedData.filter((row) => handleAt(row, handleIndex) === handle),
            `${rel} ${handle}`,
          );
        }
        let current = "";
        const closed = new Set<string>();
        for (const row of actualData) {
          const handle = handleAt(row, handleIndex);
          if (handle === "" || handle === current) continue;
          assert.equal(closed.has(handle), false, `${rel} ${handle}`);
          if (current !== "") closed.add(current);
          current = handle;
        }
        const pairs = (rows: string[][]): string[] => {
          const found: string[] = [];
          for (let index = 1; index < rows.length; index += 1) {
            if (handleAt(rows[index]!, handleIndex) !== "") continue;
            found.push(`${JSON.stringify(rows[index - 1])}\0${JSON.stringify(rows[index])}`);
          }
          return found.sort();
        };
        assert.deepEqual(pairs(actualData), pairs(expectedData), rel);
        const leading = (rows: string[][]): number => {
          let count = 0;
          for (const row of rows) {
            if (handleAt(row, handleIndex) !== "") break;
            count += 1;
          }
          return count;
        };
        assert.equal(leading(actualData), leading(expectedData), rel);
        for (const fix of result.fixes) {
          if (fix.ruleId !== "SCL016" || !Array.isArray(fix.before) || !Array.isArray(fix.after)) continue;
          assert.equal(fix.row, null, rel);
          assert.equal(fix.before.length, fix.after.length, rel);
          for (let index = 0; index < fix.before.length; index += 1) {
            const before = fix.before[index]!;
            const after = fix.after[index]!;
            assert.ok(index === 0 || before > fix.before[index - 1]!, rel);
            assert.equal(expected[before - 1]?.[handleIndex], fix.column, rel);
            assert.equal(actual[after - 1]?.[handleIndex], fix.column, rel);
          }
        }
      }

      const headerRewrites = result.fixes.flatMap((fix) =>
        fix.row === 1 && typeof fix.before === "string" && typeof fix.after === "string"
          ? [[fix.before, fix.after] as [string, string]]
          : [],
      );
      const inputReport = lintCsv(original, { file: abs });
      const outputReport = lintCsv(result.text, { file: output });
      assert.equal(cli.status, outputReport.ok ? 0 : 1, rel);
      const seen = new Set(inputReport.findings.map((finding) => normFinding(finding, headerRewrites)));
      const priceRows = new Set<number>();
      for (const fix of result.fixes) {
        if (fix.ruleId !== "SCL025" || fix.row === null) continue;
        const field = matchHeader(fix.column ?? "")?.field;
        if (field !== "price" && field !== "compareAt") continue;
        const needle = JSON.stringify(expected[fix.row - 1]);
        actual.forEach((row, index) => {
          if (JSON.stringify(row) === needle) priceRows.add(index + 1);
        });
      }
      const movedHandles = new Set(
        result.fixes.flatMap((fix) => (fix.ruleId === "SCL016" && fix.column !== null ? [fix.column] : [])),
      );
      const unexpected = outputReport.findings.filter((finding) => {
        if (seen.has(normFinding(finding, []))) return false;
        if (finding.ruleId === "SCL026") return !priceRows.has(finding.row ?? -1);
        if (!MOVE_RULES.has(finding.ruleId)) return true;
        if (movedHandles.size === 0 || finding.row === null) return true;
        return !movedHandles.has(handleAt(actual[finding.row - 1] ?? [], handleIndex));
      });
      assert.deepEqual(
        unexpected.map((finding) => `${finding.ruleId} ${finding.column ?? ""} ${finding.message}`),
        [],
        rel,
      );
    }
  });

  it("matches the JSON reports stored from main when --fix is absent", () => {
    for (const rel of files) {
      const result = run([rel, "--json"]);
      const stored = readFileSync(join(root, "test/baselines/main-json", `${rel.replaceAll("/", "__")}.json`), "utf8");
      assert.equal(result.stdout, stored, rel);
      assert.equal(result.status === 0 || result.status === 1, true, rel);
    }
  });
});
