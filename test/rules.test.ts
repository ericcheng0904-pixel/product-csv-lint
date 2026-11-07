import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { barcodes, csv, images, tags, variants } from "./helpers.ts";
import { FILE_SIZE_LIMIT, RULES, lintCsv, lintFile, ruleById } from "../dist/index.js";

interface Case {
  id: string;
  pass: string | Uint8Array;
  fail: string | Uint8Array;
  passOptions?: { byteLength?: number };
  failOptions?: { byteLength?: number };
}

const cases: Case[] = [
  {
    id: "SCL001",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["URL handle"], ["hat"]]),
  },
  {
    id: "SCL002",
    pass: csv([
      ["Title", "URL handle", "Product image URL"],
      ["Hat", "hat", "https://cdn.example.com/a.jpg"],
      ["", "hat", "https://cdn.example.com/b.jpg"],
    ]),
    fail: csv([
      ["Title", "Product image URL"],
      ["Hat", "https://cdn.example.com/a.jpg"],
      ["", "https://cdn.example.com/b.jpg"],
    ]),
  },
  {
    id: "SCL003",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title"], ["Hat"]]),
  },
  {
    id: "SCL004",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title", "URL handle", "Notes"], ["Hat", "hat", "hello"]]),
  },
  {
    id: "SCL005",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["title", "URL handle"], ["Hat", "hat"]]),
  },
  {
    id: "SCL006",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title", "Title", "URL handle"], ["Hat", "Cap", "hat"]]),
  },
  {
    id: "SCL007",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title", "URL handle "], ["Hat", "hat"]]),
  },
  {
    id: "SCL008",
    pass: csv([["Title", "URL handle", "Barcodes"], ["Hat", "hat", "123"]]),
    fail: csv([["Title", "URL handle", "Barcode", "Barcodes"], ["Hat", "hat", "123", "456"]]),
  },
  {
    id: "SCL009",
    pass: csv([["Title", "URL handle", "Option1 name", "Option1 value"], ["Hat", "hat", "Size", "Small"]]),
    fail: csv([["Title", "URL handle", "Option4 name"], ["Hat", "hat", "Extra"]]),
  },
  {
    id: "SCL010",
    pass: new TextEncoder().encode("Title,URL handle\nHat,hat\n"),
    fail: Uint8Array.of(0xff, 0xfe, 0x41),
  },
  {
    id: "SCL011",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    failOptions: { byteLength: FILE_SIZE_LIMIT + 1 },
  },
  {
    id: "SCL012",
    pass: csv([["Title", "URL handle"], ["Hat, blue", "hat-1"]]),
    fail: 'Title,URL handle\n"Hat,hat\n',
  },
  {
    id: "SCL013",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title", "URL handle"], ["Hat", "hat", "extra"]]),
  },
  {
    id: "SCL014",
    pass: "Title,URL handle\n",
    fail: "",
  },
  {
    id: "SCL015",
    pass: csv([["Title", "URL handle"], ["Hat", "café-hat"]]),
    fail: csv([["Title", "URL handle"], ["Hat", "my hat"]]),
  },
  {
    id: "SCL016",
    pass: csv([
      ["Title", "URL handle"],
      ["Hat", "hat"],
      ["", "hat"],
      ["Coat", "coat"],
    ]),
    fail: csv([
      ["Title", "URL handle"],
      ["Hat", "hat"],
      ["Coat", "coat"],
      ["Hat again", "hat"],
    ]),
  },
  {
    id: "SCL017",
    pass: csv([["Title", "URL handle"], ["Hat", "hat"]]),
    fail: csv([["Title", "URL handle"], ["", "orphan-hat"]]),
  },
  {
    id: "SCL018",
    pass: csv([
      ["Title", "URL handle", "Vendor"],
      ["Hat", "hat", "Acme"],
      ["", "hat", ""],
    ]),
    fail: csv([
      ["Title", "URL handle", "Vendor"],
      ["Hat", "hat", "Acme"],
      ["", "hat", "Other"],
    ]),
  },
  {
    id: "SCL019",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "10"],
      ["", "hat", "Size", "Medium", "10"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "10"],
      ["", "hat", "Color", "Medium", "10"],
    ]),
  },
  {
    id: "SCL020",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "10"],
      ["", "hat", "", "Medium", "10"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "", "Small", "10"],
      ["", "hat", "Size", "Medium", "10"],
    ]),
  },
  {
    id: "SCL021",
    pass: variants(2048),
    fail: variants(2049),
  },
  {
    id: "SCL022",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "10"],
      ["", "hat", "", "Medium", "10"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "10"],
      ["", "hat", "", "Small", "10"],
    ]),
  },
  {
    id: "SCL023",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "10"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "", "Small", "10"],
    ]),
  },
  {
    id: "SCL024",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price", "Product image URL"],
      ["Hat", "hat", "Size", "Small", "10", "https://cdn.example.com/a.jpg"],
      ["", "hat", "", "", "", "https://cdn.example.com/b.jpg"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", ""],
    ]),
  },
  {
    id: "SCL025",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price", "Cost per item"],
      ["Hat", "hat", "Size", "Small", "80", "4.00"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price"],
      ["Hat", "hat", "Size", "Small", "$9.99"],
    ]),
  },
  {
    id: "SCL026",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price", "Compare-at price"],
      ["Hat", "hat", "Size", "Small", "9.00", "12.00"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "Price", "Compare-at price"],
      ["Hat", "hat", "Size", "Small", "10.00", "5"],
    ]),
  },
  {
    id: "SCL027",
    pass: csv([
      ["Title", "URL handle", "Status", "Published on online store", "Continue selling when out of stock"],
      ["Hat", "hat", "Active", "TRUE", "DENY"],
    ]),
    fail: csv([["Title", "URL handle", "Status"], ["Hat", "hat", "live"]]),
  },
  {
    id: "SCL028",
    pass: csv([
      ["Title", "URL handle", "Product image URL", "Variant image URL"],
      ["Hat", "hat", "https://cdn.example.com/hat.jpg", "http://cdn.example.com/v.jpg"],
    ]),
    fail: csv([["Title", "URL handle", "Product image URL"], ["Hat", "hat", "images/hat.jpg"]]),
  },
  {
    id: "SCL029",
    pass: csv([["Title", "URL handle", "SEO title"], ["Hat", "hat", "a".repeat(70)]]),
    fail: csv([["Title", "URL handle", "SEO title"], ["Hat", "hat", "a".repeat(71)]]),
  },
  {
    id: "SCL030",
    pass: csv([["Title", "URL handle", "SEO description"], ["Hat", "hat", "a".repeat(320)]]),
    fail: csv([["Title", "URL handle", "SEO description"], ["Hat", "hat", "a".repeat(321)]]),
  },
  {
    id: "SCL031",
    pass: tags(250),
    fail: tags(251),
  },
  {
    id: "SCL032",
    pass: csv([["Title", "URL handle", "Tags"], ["Hat", "hat", "Fall-2023, casual"]]),
    fail: csv([["Title", "URL handle", "Tags"], ["Hat", "hat", "café"]]),
  },
  {
    id: "SCL033",
    pass: barcodes(20),
    fail: barcodes(21),
  },
  {
    id: "SCL034",
    pass: images(250),
    fail: images(251),
  },
  {
    id: "SCL035",
    pass: csv([["Title", "URL handle", "Image alt text"], ["Hat", "hat", "A red hat"]]),
    fail: csv([["Title", "URL handle", "Image alt text"], ["Hat", "hat", "a".repeat(513)]]),
  },
  {
    id: "SCL036",
    pass: csv([["Title", "URL handle", "Image alt text"], ["Hat", "hat", "a".repeat(125)]]),
    fail: csv([["Title", "URL handle", "Image alt text"], ["Hat", "hat", "a".repeat(126)]]),
  },
  {
    id: "SCL037",
    pass: csv([["Title", "URL handle", "Product image URL"], ["Hat", "hat", "https://cdn.example.com/photo.jpg"]]),
    fail: csv([["Title", "URL handle", "Product image URL"], ["Hat", "hat", "https://cdn.example.com/photo_thumb.jpg"]]),
  },
  {
    id: "SCL038",
    pass: csv([["Title", "URL handle", "Weight value (grams)"], ["Hat", "hat", "5125"]]),
    fail: csv([["Title", "URL handle", "Weight value (grams)"], ["Hat", "hat", "5 kg"]]),
  },
  {
    id: "SCL039",
    pass: csv([["Title", "URL handle", "Inventory quantity"], ["Hat", "hat", "4"]]),
    fail: csv([["Title", "URL handle", "Inventory quantity"], ["Hat", "hat", "ten"]]),
  },
  {
    id: "SCL040",
    pass: csv([
      ["Title", "URL handle", "Inventory tracker", "Inventory quantity"],
      ["Hat", "hat", "shopify", "4"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Inventory tracker", "Inventory quantity"],
      ["Hat", "hat", "shopify", ""],
    ]),
  },
  {
    id: "SCL041",
    pass: csv([["Title", "URL handle", "Fulfillment service", "SKU"], ["Hat", "hat", "manual", "HAT"]]),
    fail: csv([["Title", "URL handle", "Fulfillment service", "SKU"], ["Hat", "hat", "Joan's Fulfillment", "HAT"]]),
  },
  {
    id: "SCL042",
    pass: csv([
      ["Title", "URL handle", "Fulfillment service", "SKU"],
      ["Hat", "hat", "music-man-fulfillment", "HAT"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Fulfillment service", "SKU"],
      ["Hat", "hat", "music-man-fulfillment", ""],
    ]),
  },
  {
    id: "SCL043",
    pass: csv([[
      "Title",
      "URL handle",
      "Requires shipping",
      "Packed product length",
      "Packed product width",
      "Packed product height",
      "Packed product dimension unit",
    ], ["Hat", "hat", "true", "10", "5", "2", "cm"]]),
    fail: csv([[
      "Title",
      "URL handle",
      "Requires shipping",
      "Packed product length",
      "Packed product width",
      "Packed product height",
      "Packed product dimension unit",
    ], ["Hat", "hat", "true", "10", "", "", ""]]),
  },
  {
    id: "SCL044",
    pass: csv([["Title", "URL handle", "Status"], ["Hat", "hat", "draft"]]),
    fail: csv([["Title", "URL handle", "Status"], ["Hat", "hat", ""]]),
  },
  {
    id: "SCL045",
    pass: csv([["Title", "URL handle", "Gift card"], ["Hat", "hat", "false"]]),
    fail: csv([["Title", "URL handle", "Gift card"], ["Hat", "hat", "true"]]),
  },
  {
    id: "SCL046",
    pass: csv([["Title", "URL handle", "Collection"], ["Hat", "hat", "Summer"]]),
    fail: csv([["Title", "URL handle", "Collection"], ["Hat", "hat", "a".repeat(256)]]),
  },
  {
    id: "SCL047",
    pass: csv([
      ["Title", "URL handle", "Option1 name", "Option1 value", "SKU"],
      ["Hat", "hat", "Size", "Small", "ABC"],
    ]),
    fail: csv([["Title", "URL handle", "SKU"], ["Hat", "hat", "ABC"]]),
  },
  {
    id: "SCL048",
    pass: csv([["Title", "URL handle", "Image position"], ["Hat", "hat", "1"]]),
    fail: csv([["Title", "URL handle", "Image position"], ["Hat", "hat", "0"]]),
  },
  {
    id: "SCL049",
    pass: csv([
      ["Title", "URL handle", "Price / International", "Compare-at price / International"],
      ["Hat", "hat", "8.00", "9.99"],
    ]),
    fail: csv([
      ["Title", "URL handle", "Price / International", "Compare-at price / International"],
      ["Hat", "hat", "", "9.99"],
    ]),
  },
  {
    id: "SCL050",
    pass: csv([
      ["Title", "URL handle", "Option1 Linked To"],
      ["Hat", "hat", "product.metafields.shopify.color-pattern"],
    ]),
    fail: csv([["Title", "URL handle", "Option1 Linked To"], ["Hat", "hat", "color"]]),
  },
];

describe("rules", () => {
  it("has one passing and one failing fixture per rule", () => {
    assert.deepEqual(cases.map((item) => item.id), RULES.map((rule) => rule.id));
  });

  for (const item of cases) {
    it(`${item.id} passes a good fixture`, () => {
      const report = lintCsv(item.pass, { file: `${item.id}-pass.csv`, ...item.passOptions });
      const hits = report.findings.filter((finding) => finding.ruleId === item.id);
      assert.deepEqual(hits, []);
    });

    it(`${item.id} flags a bad fixture`, () => {
      const report = lintCsv(item.fail, { file: `${item.id}-fail.csv`, ...item.failOptions });
      const hits = report.findings.filter((finding) => finding.ruleId === item.id);
      assert.ok(hits.length >= 1, report.findings.map((finding) => finding.ruleId).join(","));
      assert.equal(hits[0]!.severity, ruleById(item.id).severity);
      assert.match(hits[0]!.message, /^(File|Row \d+)(, column .+)?: |^Line \d+: /);
      assert.equal(hits[0]!.citation, ruleById(item.id).citation);
    });
  }

  it("warns when compare-at price equals price", () => {
    const report = lintCsv(csv([
      ["Title", "URL handle", "Price", "Compare-at price"],
      ["Hat", "hat", "10.00", "10.00"],
    ]));
    assert.equal(report.errorCount, 0);
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL026"), true);
    assert.equal(report.ok, true);
    const capped = lintCsv(csv([
      ["Title", "URL handle", "Price", "Compare-at price"],
      ["Hat", "hat", "10.00", "10.00"],
    ]), { maxWarnings: 0 });
    assert.equal(capped.ok, false);
  });

  it("accepts an underscore-free legacy header row", () => {
    const report = lintCsv([
      "Handle,Title,Body (HTML),Vendor,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare-at Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Alt Text",
      "example-hat,Example Hat,A warm hat,Acme,Hat,wool,TRUE,Size,Small,,,,,HAT-S,200,shopify,5,deny,manual,19.99,24.99,TRUE,TRUE,123456,https://cdn.example.com/hat.jpg,A hat",
      "",
    ].join("\n"));
    assert.deepEqual(report.findings, [], report.findings.map((finding) => `${finding.ruleId} ${finding.message}`).join("\n"));
  });

  it("does not flag partial packed columns when the row does not require shipping", () => {
    const report = lintCsv(csv([[
      "Title",
      "URL handle",
      "Requires shipping",
      "Packed product length",
      "Packed product width",
      "Packed product height",
      "Packed product dimension unit",
    ], ["Hat", "hat", "false", "10", "", "", ""]]));
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL043"), false);
  });

  it("counts an escaped semicolon as part of one barcode", () => {
    const report = lintCsv(csv([
      ["Title", "URL handle", "Barcodes"],
      ["Hat", "hat", "a\\;b;c"],
    ]));
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL033"), false);
  });

  it("warns on an underscore in a handle and accepts letters, dashes, and numbers", () => {
    const bad = lintCsv(csv([["Title", "URL handle"], ["Hat", "black_sunglasses"]]));
    const hit = bad.findings.find((finding) => finding.ruleId === "SCL015");
    assert.equal(hit?.severity, "warning");
    assert.equal(bad.errorCount, 0);
    const good = lintCsv(csv([["Title", "URL handle"], ["Hat", "black-sunglasses-2"]]));
    assert.equal(good.findings.some((finding) => finding.ruleId === "SCL015"), false);
  });
});

describe("whitespace and guidance rules", () => {
  it("ignores spaces around choice values: 'TRUE ', ' active', and 'kg '", () => {
    const report = lintCsv(csv([
      [
        "Title",
        "URL handle",
        "Status",
        "Published on online store",
        "Weight unit for display",
        "Continue selling when out of stock",
        "Charge tax",
        "Requires shipping",
        "Gift card",
      ],
      ["Hat", "hat", " active", "TRUE ", "kg ", " DENY ", "  false", "FALSE  ", " false "],
    ]));
    assert.deepEqual(
      report.findings.filter((finding) => finding.ruleId === "SCL027"),
      [],
    );
    assert.equal(report.errorCount, 0);
    const wrongCase = lintCsv(csv([["Title", "URL handle", "Status"], ["Hat", "hat", " Draft "]]));
    assert.equal(wrongCase.findings.some((finding) => finding.ruleId === "SCL027"), false);
  });

  it("still flags a padded value that is not in the list, and shows it as written", () => {
    const report = lintCsv(csv([["Title", "URL handle", "Status"], ["Hat", "hat", "live "]]));
    const hit = report.findings.find((finding) => finding.ruleId === "SCL027");
    assert.equal(hit?.severity, "error");
    assert.match(hit?.message ?? "", /"live "/);
  });

  it("treats a value of only spaces as blank", () => {
    const status = lintCsv(csv([["Title", "URL handle", "Status"], ["Hat", "hat", "   "]]));
    assert.equal(status.findings.some((finding) => finding.ruleId === "SCL027"), false);
    assert.equal(status.findings.some((finding) => finding.ruleId === "SCL044"), true);
    const unit = lintCsv(csv([["Title", "URL handle", "Weight unit for display"], ["Hat", "hat", " "]]));
    assert.equal(unit.findings.some((finding) => finding.ruleId === "SCL027"), false);
  });

  it("ignores spaces around a fulfillment service and an image position", () => {
    const report = lintCsv(csv([
      ["Title", "URL handle", "Fulfillment service", "SKU", "Image position", "Product image URL"],
      ["Hat", "hat", "manual ", "HAT", " 1 ", "https://cdn.example.com/a.jpg"],
      ["", "hat", " music-man-fulfillment", "HAT-2", "2 ", "https://cdn.example.com/b.jpg"],
    ]));
    assert.deepEqual(
      report.findings.filter((finding) => ["SCL041", "SCL042", "SCL048"].includes(finding.ruleId)),
      [],
    );
    const blank = lintCsv(csv([
      ["Title", "URL handle", "Fulfillment service", "SKU"],
      ["Hat", "hat", "   ", ""],
    ]));
    assert.equal(blank.findings.some((finding) => finding.ruleId === "SCL042"), false);
  });

  it("matches Gift card and Requires shipping after trimming", () => {
    const gift = lintCsv(csv([["Title", "URL handle", "Gift card"], ["Hat", "hat", " TRUE "]]));
    assert.equal(gift.findings.some((finding) => finding.ruleId === "SCL045"), true);
    const digital = lintCsv(csv([
      ["Title", "URL handle", "Requires shipping", "Packed product length"],
      ["Hat", "hat", " FALSE ", "10"],
    ]));
    assert.equal(digital.findings.some((finding) => finding.ruleId === "SCL043"), false);
  });

  it("reports a custom fulfillment handle shape as a warning and a blank SKU as an error", () => {
    for (const value of ["Joan's Fulfillment", "my_service", "MusicMan"]) {
      const report = lintCsv(csv([
        ["Title", "URL handle", "Fulfillment service", "SKU"],
        ["Hat", "hat", value, "HAT"],
      ]));
      const hit = report.findings.find((finding) => finding.ruleId === "SCL041");
      assert.equal(hit?.severity, "warning", value);
      assert.equal(report.errorCount, 0, value);
      assert.equal(report.ok, true, value);
    }
    const noSku = lintCsv(csv([
      ["Title", "URL handle", "Fulfillment service", "SKU"],
      ["Hat", "hat", "music-man-fulfillment", ""],
    ]));
    assert.equal(noSku.findings.find((finding) => finding.ruleId === "SCL042")?.severity, "error");
  });

  it("reports an unusual image position as a warning, not an error", () => {
    for (const value of ["0", "1.0", "first", "-1"]) {
      const report = lintCsv(csv([["Title", "URL handle", "Image position"], ["Hat", "hat", value]]));
      assert.equal(report.findings.find((finding) => finding.ruleId === "SCL048")?.severity, "warning", value);
      assert.equal(report.errorCount, 0, value);
    }
  });

  it("warns on a header that differs in case and still binds it", () => {
    const report = lintCsv("title,URL handle,price\nHat,hat,$5\n");
    const hits = report.findings.filter((finding) => finding.ruleId === "SCL005");
    assert.deepEqual(hits.map((finding) => finding.column), ["price", "title"]);
    assert.equal(hits.every((finding) => finding.severity === "warning"), true);
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL025"), true);
    assert.equal(report.findings.some((finding) => finding.ruleId === "SCL004"), false);
    const exact = lintCsv("Title,URL handle,Option1 Linked To,Variant Barcodes\nHat,hat,,\n");
    assert.equal(exact.findings.some((finding) => finding.ruleId === "SCL005"), false);
  });

  it("does not flag letters or combining marks in other scripts as symbols or accents", () => {
    const hindi = lintCsv(csv([["Title", "URL handle", "Tags"], ["Hat", "hat", "\u091f\u094b\u092a\u0940"]]));
    assert.equal(hindi.findings.some((finding) => finding.ruleId === "SCL032"), false);
    for (const tag of ["caf\u00e9", "cafe\u0301", "hat!"]) {
      const report = lintCsv(csv([["Title", "URL handle", "Tags"], ["Hat", "hat", tag]]));
      assert.equal(report.findings.some((finding) => finding.ruleId === "SCL032"), true, tag);
    }
  });
});

describe("shopify sample", () => {
  it("reports no errors on the current official sample product CSV", async () => {
    const sample = new URL("./fixtures/shopify/product_template.csv", import.meta.url);
    const source = readFileSync(new URL("./fixtures/shopify/SOURCE.txt", import.meta.url), "utf8");
    const bytes = readFileSync(sample);
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(bytes).digest("hex");
    assert.match(source, new RegExp(hash));
    assert.match(source, /product-knowledge\/production\/csv\/product_template\.csv/);
    assert.match(source, /2026-10-27 UTC/);
    const report = await lintFile(fileURLToPath(sample));
    assert.equal(report.errorCount, 0, report.findings.map((finding) => finding.message).join("\n"));
    assert.deepEqual(
      report.findings.map((finding) => `${finding.ruleId} ${finding.message}`),
      [],
    );
    assert.equal(report.products, 3);
    assert.equal(report.dataRows, 16);
    assert.equal(report.ok, true);
  });
});

describe("rule catalog", () => {
  it("allows an error only for a rule that rests on a page sentence", () => {
    for (const rule of RULES) {
      if (rule.severity !== "error") continue;
      assert.equal(rule.basis, "page", rule.id);
      assert.notEqual(rule.citation, "", rule.id);
      assert.notEqual(rule.quote, "", rule.id);
    }
  });

  it("documents every rule id, citation, and the check date", () => {
    const text = readFileSync(new URL("../docs/RULES.md", import.meta.url), "utf8");
    assert.match(text, /2026-10-27 UTC/);
    for (const rule of RULES) {
      assert.ok(text.includes(rule.id), rule.id);
      if (rule.citation) assert.ok(text.includes(rule.citation), `${rule.id} citation`);
      if (rule.quote) assert.ok(text.includes(rule.quote), `${rule.id} quote`);
      assert.ok(text.includes(rule.summary), `${rule.id} summary`);
    }
  });
});
