# Corpus

Lint of the product CSVs committed in `corpus/files/`. Sources, licences, and sha256 values are in [corpus/SOURCES.md](../corpus/SOURCES.md).

Every finding below was reviewed by hand against the Shopify help page its rule cites. A false positive is a finding on a file that is valid under that page. Those were fixed in the rules, and the review judged every finding that is left to be a true positive.

That judgement is recorded once per rule in `scripts/run-corpus.mjs`, not once per finding, so "false positives: 0" is the result of the review and not a measurement. The script fails when a rule that fires has no recorded verdict or is marked as a false positive. It cannot see a new false positive from a rule it already marks as a true positive, so after a rule changes, re-read that rule's findings in the tables below.

The first pass, before those fixes, false-positived on two rules: SCL004 four times (`Standard Product Type`, `Standardized Product Type`, and `Custom Product Type` on the 2022-01-26 sample and on a public copy of that sample) and SCL038 three times (decimal gram values `226.796185`, `283.4952313`, and `396.8933238` in the 2026-02-01 sample). The product CSV page says older column names stay compatible, and it does not say the importer rejects a decimal gram value. The sample file contains both. A later pass reads the column table's "you should" wording as a warning, so those three decimal values are true-positive warnings. `Variant Barcodes`, the header on the current sample, is accepted.

## False positives by rule

| Rule | False positives before | False positives after |
| --- | --- | --- |
| SCL001 | 0 | 0 |
| SCL002 | 0 | 0 |
| SCL003 | 0 | 0 |
| SCL004 | 4 | 0 |
| SCL005 | 0 | 0 |
| SCL006 | 0 | 0 |
| SCL007 | 0 | 0 |
| SCL008 | 0 | 0 |
| SCL009 | 0 | 0 |
| SCL010 | 0 | 0 |
| SCL011 | 0 | 0 |
| SCL012 | 0 | 0 |
| SCL013 | 0 | 0 |
| SCL014 | 0 | 0 |
| SCL015 | 0 | 0 |
| SCL016 | 0 | 0 |
| SCL017 | 0 | 0 |
| SCL018 | 0 | 0 |
| SCL019 | 0 | 0 |
| SCL020 | 0 | 0 |
| SCL021 | 0 | 0 |
| SCL022 | 0 | 0 |
| SCL023 | 0 | 0 |
| SCL024 | 0 | 0 |
| SCL025 | 0 | 0 |
| SCL026 | 0 | 0 |
| SCL027 | 0 | 0 |
| SCL028 | 0 | 0 |
| SCL029 | 0 | 0 |
| SCL030 | 0 | 0 |
| SCL031 | 0 | 0 |
| SCL032 | 0 | 0 |
| SCL033 | 0 | 0 |
| SCL034 | 0 | 0 |
| SCL035 | 0 | 0 |
| SCL036 | 0 | 0 |
| SCL037 | 0 | 0 |
| SCL038 | 3 | 0 |
| SCL039 | 0 | 0 |
| SCL040 | 0 | 0 |
| SCL041 | 0 | 0 |
| SCL042 | 0 | 0 |
| SCL043 | 0 | 0 |
| SCL044 | 0 | 0 |
| SCL045 | 0 | 0 |
| SCL046 | 0 | 0 |
| SCL047 | 0 | 0 |
| SCL048 | 0 | 0 |
| SCL049 | 0 | 0 |
| SCL050 | 0 | 0 |

After the fixes, no finding was judged a false positive.

Files whose repository does not state a licence are not in this report. Their URLs and sha256 values are in `corpus/SOURCES.md`. `node scripts/fetch-corpus.mjs` downloads them and is not part of `npm test`.

## Warnings on files Shopify published

The 7 files Shopify published (the help-center templates, `shopify-transporter-products.csv`, and `shopify-b2b-products-import.csv`) give 0 errors. They still draw warnings, listed here so a reader can judge them. A warning is not a claim that the importer rejects the file.

| File | Warnings by rule |
| --- | --- |
| `help-product-template-20210819.csv` | SCL040 x1 |
| `help-product-template-20220126.csv` | SCL040 x1 |
| `help-product-template-20230601.csv` | SCL040 x1 |
| `help-product-template-20260216.csv` | none |
| `help-product-template-csv-20260201.csv` | SCL026 x3, SCL038 x3 |
| `shopify-b2b-products-import.csv` | SCL032 x5 |
| `shopify-transporter-products.csv` | SCL004 x11, SCL024 x1, SCL026 x2 |

SCL040 stays a warning on Shopify's own 2021, 2022, and 2023 templates. They leave the inventory quantity blank under an inventory tracker, the current column table says the default is 0, and the older troubleshooting page says a blank quantity is an error. Both pages are quoted in `docs/RULES.md`.

## Files

### aamirtechs-products.csv

`corpus/files/aamirtechs-products.csv`. 2 errors, 9 warnings, 8 data rows, 6 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL004 | warning | 1 |
| SCL017 | error | 1 |
| SCL018 | warning | 1 |
| SCL022 | error | 1 |
| SCL023 | warning | 6 |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |
| 1 | Variant Weight | SCL004 | warning | true positive |
| 2 | Option1 Value | SCL023 | warning | true positive |
| 4 | Option1 Value | SCL023 | warning | true positive |
| 5 | Option1 Value | SCL023 | warning | true positive |
| 6 | Option1 Value | SCL022 | error | true positive |
| 6 | Title | SCL018 | warning | true positive |
| 7 | Option1 Value | SCL023 | warning | true positive |
| 7 | Title | SCL017 | error | true positive |
| 8 | Option1 Value | SCL023 | warning | true positive |
| 9 | Option1 Value | SCL023 | warning | true positive |

### apollos-products-cleaned.csv

`corpus/files/apollos-products-cleaned.csv`. 5 errors, 5 warnings, 25 data rows, 17 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL015 | error | 1 |
| SCL016 | error | 1 |
| SCL017 | error | 2 |
| SCL023 | warning | 2 |
| SCL024 | warning | 1 |
| SCL025 | warning | 1 |
| SCL026 | warning | 1 |
| SCL029 | error | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 7 | SEO Title | SCL029 | error | true positive |
| 8 | Variant Price | SCL024 | warning | true positive |
| 10 | Variant Compare At Price | SCL026 | warning | true positive |
| 12 | Variant Price | SCL025 | warning | true positive |
| 13 | Handle | SCL015 | error | true positive |
| 17 | Option1 Value | SCL023 | warning | true positive |
| 18 | Title | SCL017 | error | true positive |
| 19 | Option1 Value | SCL023 | warning | true positive |
| 19 | Title | SCL017 | error | true positive |
| 20 | Handle | SCL016 | error | true positive |

### apollos-products-messy.csv

`corpus/files/apollos-products-messy.csv`. 6 errors, 6 warnings, 25 data rows, 17 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL015 | error | 1 |
| SCL016 | error | 1 |
| SCL017 | error | 2 |
| SCL023 | warning | 2 |
| SCL024 | warning | 1 |
| SCL025 | error | 1 |
| SCL025 | warning | 2 |
| SCL026 | warning | 1 |
| SCL029 | error | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 7 | SEO Title | SCL029 | error | true positive |
| 7 | Variant Price | SCL025 | error | true positive |
| 8 | Variant Price | SCL024 | warning | true positive |
| 10 | Variant Compare At Price | SCL026 | warning | true positive |
| 11 | Variant Price | SCL025 | warning | true positive |
| 12 | Variant Price | SCL025 | warning | true positive |
| 13 | Handle | SCL015 | error | true positive |
| 17 | Option1 Value | SCL023 | warning | true positive |
| 18 | Title | SCL017 | error | true positive |
| 19 | Option1 Value | SCL023 | warning | true positive |
| 19 | Title | SCL017 | error | true positive |
| 20 | Handle | SCL016 | error | true positive |

### astrodevit-sample-products.csv

`corpus/files/astrodevit-sample-products.csv`. 0 errors, 2 warnings, 2 data rows, 2 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL013 | warning | 2 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 2 |  | SCL013 | warning | true positive |
| 3 |  | SCL013 | warning | true positive |

### carbondigital-product-template.csv

`corpus/files/carbondigital-product-template.csv`. 0 errors, 1 warning, 5 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL040 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 4 | Variant Inventory Qty | SCL040 | warning | true positive |

### dehio-product-template.csv

`corpus/files/dehio-product-template.csv`. 1 error, 1 warning, 0 data rows, 0 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL001 | error | 1 |
| SCL004 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Handle;Title;Body (HTML);Vendor;Type;Tags;Published;Option1 Name;Option1 Value;Option2 Name;Option2 Value;Option3 Name;Option3 Value;Variant SKU;Variant Grams;Variant Inventory Tracker;Variant Inventory Qty;Variant Inventory Policy;Variant Fulfillment Service;Variant Price;Variant Compare At Price;Variant Requires Shipping;Variant Taxable;Variant Barcode;Image Src;Image Position;Image Alt Text;Gift Card;SEO Title;SEO Description;Google Shopping / Google Product Category;Google Shopping / Gender;Google Shopping / Age Group;Google Shopping / MPN;Google Shopping / AdWords Grouping;Google Shopping / AdWords Labels;Google Shopping / Condition;Google Shopping / Custom Product;Google Shopping / Custom Label 0;Google Shopping / Custom Label 1;Google Shopping / Custom Label 2;Google Shopping / Custom Label 3;Google Shopping / Custom Label 4;Variant Image;Variant Weight Unit;Variant Tax Code;Cost per item;Status;Collection | SCL004 | warning | true positive |
| 1 | Title | SCL001 | error | true positive |

### desiria-products-after.csv

`corpus/files/desiria-products-after.csv`. 0 errors, 0 warnings, 1 data row, 1 product.

No findings.

### desiria-products-before.csv

`corpus/files/desiria-products-before.csv`. 0 errors, 0 warnings, 1 data row, 1 product.

No findings.

### dkautomation-matrixify-import.csv

`corpus/files/dkautomation-matrixify-import.csv`. 0 errors, 0 warnings, 19 data rows, 15 products.

No findings.

### heiguang-product-template.csv

`corpus/files/heiguang-product-template.csv`. 0 errors, 0 warnings, 16 data rows, 3 products.

No findings.

### heiguang-shopify-import.csv

`corpus/files/heiguang-shopify-import.csv`. 0 errors, 9 warnings, 109 data rows, 109 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL032 | warning | 9 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 8 | Tags | SCL032 | warning | true positive |
| 18 | Tags | SCL032 | warning | true positive |
| 30 | Tags | SCL032 | warning | true positive |
| 42 | Tags | SCL032 | warning | true positive |
| 52 | Tags | SCL032 | warning | true positive |
| 64 | Tags | SCL032 | warning | true positive |
| 75 | Tags | SCL032 | warning | true positive |
| 85 | Tags | SCL032 | warning | true positive |
| 106 | Tags | SCL032 | warning | true positive |

### heiguang-woocommerce-shopify-import.csv

`corpus/files/heiguang-woocommerce-shopify-import.csv`. 0 errors, 0 warnings, 28 data rows, 17 products.

No findings.

### help-product-template-20210819.csv

`corpus/files/help-product-template-20210819.csv`. 0 errors, 1 warning, 5 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL040 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 4 | Variant Inventory Qty | SCL040 | warning | true positive |

### help-product-template-20220126.csv

`corpus/files/help-product-template-20220126.csv`. 0 errors, 1 warning, 5 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL040 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 4 | Variant Inventory Qty | SCL040 | warning | true positive |

### help-product-template-20230601.csv

`corpus/files/help-product-template-20230601.csv`. 0 errors, 1 warning, 5 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL040 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 4 | Variant Inventory Qty | SCL040 | warning | true positive |

### help-product-template-20260216.csv

`corpus/files/help-product-template-20260216.csv`. 0 errors, 0 warnings, 16 data rows, 3 products.

No findings.

### help-product-template-csv-20260201.csv

`corpus/files/help-product-template-csv-20260201.csv`. 0 errors, 6 warnings, 17 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL026 | warning | 3 |
| SCL038 | warning | 3 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 14 | Variant Compare At Price | SCL026 | warning | true positive |
| 14 | Variant Grams | SCL038 | warning | true positive |
| 15 | Variant Compare At Price | SCL026 | warning | true positive |
| 15 | Variant Grams | SCL038 | warning | true positive |
| 16 | Variant Compare At Price | SCL026 | warning | true positive |
| 16 | Variant Grams | SCL038 | warning | true positive |

### ianbertoni-shopify-products.csv

`corpus/files/ianbertoni-shopify-products.csv`. 0 errors, 1 warning, 60 data rows, 60 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL036 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 59 | Image alt text | SCL036 | warning | true positive |

### icekree-safe-copy.csv

`corpus/files/icekree-safe-copy.csv`. 0 errors, 0 warnings, 1 data row, 1 product.

No findings.

### jaweria-import-ready.csv

`corpus/files/jaweria-import-ready.csv`. 0 errors, 3 warnings, 17 data rows, 11 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL032 | warning | 3 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 5 | Tags | SCL032 | warning | true positive |
| 7 | Tags | SCL032 | warning | true positive |
| 16 | Tags | SCL032 | warning | true positive |

### joomni-export-sample.csv

`corpus/files/joomni-export-sample.csv`. 0 errors, 0 warnings, 4 data rows, 2 products.

No findings.

### mbilal-sample-export.csv

`corpus/files/mbilal-sample-export.csv`. 0 errors, 11 warnings, 10 data rows, 5 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL026 | warning | 10 |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |
| 2 | Variant Compare At Price | SCL026 | warning | true positive |
| 3 | Variant Compare At Price | SCL026 | warning | true positive |
| 4 | Variant Compare At Price | SCL026 | warning | true positive |
| 5 | Variant Compare At Price | SCL026 | warning | true positive |
| 6 | Variant Compare At Price | SCL026 | warning | true positive |
| 7 | Variant Compare At Price | SCL026 | warning | true positive |
| 8 | Variant Compare At Price | SCL026 | warning | true positive |
| 9 | Variant Compare At Price | SCL026 | warning | true positive |
| 10 | Variant Compare At Price | SCL026 | warning | true positive |
| 11 | Variant Compare At Price | SCL026 | warning | true positive |

### natsuki-invalid-products.csv

`corpus/files/natsuki-invalid-products.csv`. 5 errors, 4 warnings, 2 data rows, 1 product.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL017 | error | 1 |
| SCL018 | warning | 2 |
| SCL019 | warning | 1 |
| SCL025 | error | 1 |
| SCL025 | warning | 1 |
| SCL027 | error | 1 |
| SCL028 | error | 1 |
| SCL029 | error | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 2 | Image Src | SCL028 | error | true positive |
| 2 | SEO Title | SCL029 | error | true positive |
| 2 | Status | SCL027 | error | true positive |
| 2 | Title | SCL017 | error | true positive |
| 2 | Variant Price | SCL025 | error | true positive |
| 3 | Body (HTML) | SCL018 | warning | true positive |
| 3 | Option1 Name | SCL019 | warning | true positive |
| 3 | Variant Price | SCL025 | warning | true positive |
| 3 | Vendor | SCL018 | warning | true positive |

### natsuki-valid-products.csv

`corpus/files/natsuki-valid-products.csv`. 0 errors, 0 warnings, 2 data rows, 2 products.

No findings.

### nsollazzo-product-template.csv

`corpus/files/nsollazzo-product-template.csv`. 0 errors, 1 warning, 5 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL040 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 4 | Inventory quantity | SCL040 | warning | true positive |

### reelsmith-products.csv

`corpus/files/reelsmith-products.csv`. 0 errors, 0 warnings, 9 data rows, 2 products.

No findings.

### schemamap-products-bad-price.csv

`corpus/files/schemamap-products-bad-price.csv`. 2 errors, 2 warnings, 3 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL025 | error | 2 |
| SCL025 | warning | 1 |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |
| 2 | Variant Price | SCL025 | error | true positive |
| 3 | Variant Price | SCL025 | warning | true positive |
| 4 | Variant Price | SCL025 | error | true positive |

### schemamap-products-complete.csv

`corpus/files/schemamap-products-complete.csv`. 0 errors, 1 warning, 3 data rows, 3 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |

### schemamap-products-minimal.csv

`corpus/files/schemamap-products-minimal.csv`. 0 errors, 1 warning, 1 data row, 1 product.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |

### schemamap-sample-data.csv

`corpus/files/schemamap-sample-data.csv`. 12 errors, 1 warning, 6 data rows, 6 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL003 | warning | 1 |
| SCL027 | error | 4 |
| SCL028 | error | 4 |
| SCL044 | error | 4 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | URL handle | SCL003 | warning | true positive |
| 4 | Status | SCL044 | error | true positive |
| 4 | Variant Image | SCL028 | error | true positive |
| 4 | Variant Weight Unit | SCL027 | error | true positive |
| 5 | Status | SCL044 | error | true positive |
| 5 | Variant Image | SCL028 | error | true positive |
| 5 | Variant Weight Unit | SCL027 | error | true positive |
| 6 | Status | SCL044 | error | true positive |
| 6 | Variant Image | SCL028 | error | true positive |
| 6 | Variant Weight Unit | SCL027 | error | true positive |
| 7 | Status | SCL044 | error | true positive |
| 7 | Variant Image | SCL028 | error | true positive |
| 7 | Variant Weight Unit | SCL027 | error | true positive |

### shopify-b2b-products-import.csv

`corpus/files/shopify-b2b-products-import.csv`. 0 errors, 5 warnings, 10 data rows, 10 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL032 | warning | 5 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 7 | Tags | SCL032 | warning | true positive |
| 8 | Tags | SCL032 | warning | true positive |
| 9 | Tags | SCL032 | warning | true positive |
| 10 | Tags | SCL032 | warning | true positive |
| 11 | Tags | SCL032 | warning | true positive |

### shopify-transporter-products.csv

`corpus/files/shopify-transporter-products.csv`. 0 errors, 14 warnings, 7 data rows, 1 product.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL004 | warning | 11 |
| SCL024 | warning | 1 |
| SCL026 | warning | 2 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Image Attachment | SCL004 | warning | true positive |
| 1 | Metafield Key | SCL004 | warning | true positive |
| 1 | Metafield Namespace | SCL004 | warning | true positive |
| 1 | Metafield Value | SCL004 | warning | true positive |
| 1 | Metafield Value Type | SCL004 | warning | true positive |
| 1 | Metafields Global Description Tag | SCL004 | warning | true positive |
| 1 | Metafields Global Title Tag | SCL004 | warning | true positive |
| 1 | Published At | SCL004 | warning | true positive |
| 1 | Published Scope | SCL004 | warning | true positive |
| 1 | Template Suffix | SCL004 | warning | true positive |
| 1 | Variant Weight | SCL004 | warning | true positive |
| 2 | Variant Price | SCL024 | warning | true positive |
| 7 | Variant Compare At Price | SCL026 | warning | true positive |
| 8 | Variant Compare At Price | SCL026 | warning | true positive |

### stockproof-products.csv

`corpus/files/stockproof-products.csv`. 0 errors, 1 warning, 37 data rows, 37 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |

### zhigerisen-products.csv

`corpus/files/zhigerisen-products.csv`. 0 errors, 2 warnings, 9 data rows, 9 products.

| Rule | Severity | Count |
| --- | --- | --- |
| SCL032 | warning | 1 |
| SCL047 | warning | 1 |

| Row | Column | Rule | Severity | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Option1 name | SCL047 | warning | true positive |
| 9 | Tags | SCL032 | warning | true positive |

## Why each finding is a true positive

### SCL001

The product CSV page says each column is separated by a comma and that Title is required. A semicolon-separated file has no Title column.

### SCL003

The product CSV page says a new product with no variants can omit URL handle, and an update cannot. The file omits the column, and the checker cannot tell those two imports apart.

### SCL004

The using-csv page says you can't add any other columns. The common-import-issues page says incorrect headers open a mapping dialog, so this is a warning. The flagged header is not a documented column, not Variant Barcodes, and not an older name of a documented column.

### SCL013

The row has a non-empty cell past the header. No help page says an extra cell is rejected, so this is a warning. An empty extra cell is not flagged.

### SCL015

The product CSV page says a URL handle can contain letters, dashes, and numbers, and that it cannot contain spaces.

### SCL016

Rows for one URL handle are not contiguous. Split handle groups are not imported as variants of the earlier product.

### SCL017

The common-import-issues page says a line with a handle and no product title is ignored.

### SCL018

The product CSV page says to put Title, Description, Vendor, and Tags on the first row and skip them later. A later row changes one of those values, and the page does not say which value the importer keeps.

### SCL019

An option name on a later row does not match the first row of the product. The sample product CSV keeps one option name, on the first row.

### SCL022

Two variant rows use the same option values. The common-import-issues page reports "Validation failed: options are not unique".

### SCL023

An option value is present and that option never has a name. No help page says the importer rejects that, so this is a warning.

### SCL024

Price is blank on a variant row. The current column table says the default is 0.00. The older troubleshooting page lists "Validation failed: price can't be blank". The two pages conflict, so this is a warning.

### SCL025

The product CSV page says to include only the monetary value, without a currency symbol. A currency symbol or letters are an error. A thousands comma or another shape is a warning. .99 and surrounding spaces are accepted.

### SCL026

Compare-at price is not higher than price. The sale-pricing page says it has to be higher to display a sale, and that 0.00 is not the same as an empty compare-at price. This is a warning, not an import rejection. The 2026-02-01 sample's jeans rows are in this set: price 95, compare-at price 64.95.

### SCL027

A documented choice field has a value outside the published set (status, weight unit, published, and the other lists on the product CSV page).

### SCL028

An image URL is not an absolute http:// or https:// URL. The common-import-issues page says the image URL needs http:// in front of it.

### SCL029

The SEO title is longer than 70 characters. The product CSV column table says a valid SEO title includes up to 70 characters.

### SCL032

A tag contains a symbol or an accented Latin character. The product CSV page says to avoid accented characters and symbols. Letters in other scripts are not flagged. The import is not documented to reject the tag, so this stays a warning.

### SCL036

Image alt text is longer than the documented optimal length of 125 characters and within the 512-character maximum. This is a warning.

### SCL038

Weight includes a decimal. The column table says you should specify only the numerical value, without the unit of measurement or decimals. The 2026-02-01 sample contains 226.796185, 283.4952313, and 396.8933238. The page does not say the importer rejects a decimal, so this is a warning.

### SCL040

Inventory quantity is blank while an inventory tracker is set. The current column table says the default is 0. The older troubleshooting page says inventory quantity can't be blank. The two pages conflict, so this is a warning. Shopify's 2021-08-19, 2022-01-26, and 2023-06-01 samples do this on the medium t-shirt row.

### SCL044

The Status column is present and blank on the product's first row. The product CSV page says that when the column is present it needs a value.

### SCL047

Variant columns such as SKU or price are present without both Option1 name and Option1 value. This matters when you overwrite or update: a new default variant is created and existing variants are deleted. It is a warning.
