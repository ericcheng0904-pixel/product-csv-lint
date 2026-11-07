import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { lintCsv } from "../dist/index.js";

function read(name: string): string {
  return readFileSync(new URL(`./fixtures/regressions/${name}`, import.meta.url), "utf8");
}

describe("corpus regressions", () => {
  it("warns, and does not error, on the decimal gram values in the sample product CSV", () => {
    const report = lintCsv(read("decimal-grams.csv"), { file: "decimal-grams.csv" });
    assert.equal(report.errorCount, 0);
    assert.deepEqual(
      report.findings.map((finding) => finding.ruleId),
      ["SCL038", "SCL038"],
    );
    assert.equal(report.findings.every((finding) => finding.severity === "warning"), true);
  });

  it("accepts Standard Product Type and Custom Product Type from the 2022 sample", () => {
    const report = lintCsv(read("standard-product-type.csv"), { file: "standard-product-type.csv" });
    assert.deepEqual(
      report.findings.map((finding) => `${finding.ruleId} ${finding.message}`),
      [],
    );
  });

  it("accepts Standardized Product Type as the same product-category column", () => {
    const report = lintCsv(read("standardized-product-type.csv"), {
      file: "standardized-product-type.csv",
    });
    assert.deepEqual(
      report.findings.map((finding) => `${finding.ruleId} ${finding.message}`),
      [],
    );
  });
});
