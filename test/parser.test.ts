import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCsvParser, lintCsv, parseCsv } from "../dist/index.js";

describe("csv parser", () => {
  it("reads quotes, commas, escaped quotes, and embedded newlines", () => {
    const parsed = parseCsv('Title,Description\n"Hat, blue","line1\nline2 ""quoted"""\n');
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.records.length, 2);
    assert.deepEqual(parsed.records[1]!.values, ["Hat, blue", 'line1\nline2 "quoted"']);
  });

  it("accepts CRLF, bare CR, a leading BOM, and ignores blank lines", () => {
    const parsed = parseCsv("\uFEFFTitle,URL handle\r\n\r\nHat,hat\rCoat,coat\n");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.records.length, 3);
    assert.deepEqual(parsed.records[0]!.values, ["Title", "URL handle"]);
    assert.deepEqual(parsed.records[1]!.values, ["Hat", "hat"]);
    assert.deepEqual(parsed.records[2]!.values, ["Coat", "coat"]);
    assert.equal(parsed.leadingGap, "");
    assert.equal(parsed.records[0]!.terminator, "\r\n");
    assert.equal(parsed.records[0]!.gapAfter, "\r\n");
    assert.equal(parsed.records[1]!.terminator, "\r");
    assert.equal(parsed.records[1]!.gapAfter, "");
    assert.equal(parsed.records[2]!.terminator, "\n");
    assert.equal(parsed.records[2]!.gapAfter, "");
    const leading = parseCsv("\n\nTitle\nHat");
    assert.equal(leading.ok, true);
    if (!leading.ok) return;
    assert.equal(leading.leadingGap, "\n\n");
    assert.equal(leading.records[0]!.terminator, "\n");
    assert.equal(leading.records[1]!.terminator, "");
  });

  it("keeps CRLF inside a quoted field and splits chunks across the break", () => {
    const parser = createCsvParser();
    parser.push('Title,Description\r');
    parser.push('\n"a\r');
    parser.push('\nb",hat\r\n');
    const parsed = parser.finish();
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.records.length, 2);
    assert.deepEqual(parsed.records[1]!.values, ["a\r\nb", "hat"]);
  });

  it("reports an unclosed quote and a stray quote", () => {
    const unclosed = parseCsv('Title\n"Hat\n');
    assert.equal(unclosed.ok, false);
    if (unclosed.ok) return;
    assert.match(unclosed.message, /never closed/i);
    assert.equal(unclosed.line, 2);
    assert.equal(unclosed.row, 2);

    const stray = parseCsv('Title\n"Hat"extra\n');
    assert.equal(stray.ok, false);
    if (stray.ok) return;
    assert.match(stray.message, /stray quote/i);
  });

  it("does not treat curly quotes in the sample title as CSV quotes", () => {
    const parsed = parseCsv("Title,URL handle\nPhysical Product “The Band” T-Shirt,band-shirt\n");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.records[1]!.values[0], "Physical Product “The Band” T-Shirt");
    const report = lintCsv("Title,URL handle\nPhysical Product “The Band” T-Shirt,band-shirt\n");
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL012"), false);
  });
});
