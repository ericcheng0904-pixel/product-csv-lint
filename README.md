# catalog-csv-lint

A command-line checker for documented import problems and likely mishandling in a Shopify product CSV, before you upload the file.

This repository is `product-csv-lint`; the command is `catalog-csv-lint`.

It reads the file on your machine. It does not talk to a store, so it cannot know which handles already exist, which blanks will erase data on overwrite, or whether an image URL actually loads. The full list of checks, the pages they come from, and the limits that are deliberately not checked are in [docs/RULES.md](https://github.com/ericcheng0904-pixel/product-csv-lint/blob/main/docs/RULES.md).

catalog-csv-lint is not affiliated with Shopify.

This version was written with AI assistance.

To see what changed between two product CSVs, use the free [Shopify CSV change preview](https://catalog-signoff.pages.dev/tools/shopify-csv-diff.html). For a catalog comparison report, see [Catalog Signoff](https://catalog-signoff.pages.dev/).

## Install

Node.js 20 or later. Install from GitHub:

```bash
npm install -g --install-links github:ericcheng0904-pixel/product-csv-lint
```

`prepare` compiles this repository into `dist/`. On npm 10, a global install from git links a temporary clone and then deletes it, so the command above passes `--install-links`, which keeps the built files. The compile step installs the dev dependencies. The package is not on npm.

## Usage

```bash
catalog-csv-lint FILE.csv [--json] [--rules] [--max-warnings N] [--fix OUT.csv] [--force]
```

Exit 0 when the file is clean. Exit 1 when any error is found, when `--max-warnings` is exceeded, or when the command line or the file cannot be read. Warnings alone exit 0. `--rules` prints the rule table and exits 0 without reading a CSV. `--rules --json` prints that table as JSON. `--help` prints usage and exits 0. A path of `-` is not stdin. `--fix` writes a corrected copy and then checks that copy. `--force` replaces an output file that already exists. Both are described under Fixing a file.

With `--json`, a usage or I/O failure prints `{ "schemaVersion": 1, "error": "..." }` on stdout and the same text on stderr. `--json` is honoured wherever it appears on the command line, including after the bad argument.

A file above 15 MiB (15,728,640 bytes) is an error and is not read past that point. A regular file reports its size. A pipe has no size, so it reports the bytes read when reading stopped, and the message says so. From 15,000,001 through 15,728,640 bytes the size check is a warning and the file is still checked. The help pages say 15 MB and do not say decimal or binary. See [docs/RULES.md](https://github.com/ericcheng0904-pixel/product-csv-lint/blob/main/docs/RULES.md).

### Example

`test/fixtures/broken-product.csv` is a synthetic file (not store data):

```text
test/fixtures/broken-product.csv

Row 3
  warning SCL045  Gift card
    Row 3, column Gift card: Gift card is true. A gift card cannot be created by importing a product CSV. It has to be created in the admin.
  warning SCL019  Option1 name
    Row 3, column Option1 name: Option1 name is "Color" here and "Size" on the first row of this product. The sample product CSV keeps one option name, on the first row.
  error SCL022  Option1 value
    Row 3, column Option1 value: option values "Small" are already used on row 2. The importer reports "Validation failed: options are not unique".
  error SCL025  Price
    Row 3, column Price: "$12.00" includes a currency symbol or letters. Only include the monetary value, without a currency symbol.
  warning SCL037  Product image URL
    Row 3, column Product image URL: the image file name ends with _thumb. The product image file name must not include _thumb, _small, or _medium.
  error SCL029  SEO title
    Row 3, column SEO title: SEO title is 91 characters. The documented limit is 70.
  error SCL027  Status
    Row 3, column Status: "live" is not one of: active, draft, or archived. Values are matched without case sensitivity because the sample CSV uses TRUE, FALSE, DENY, CONTINUE, and Active, while the column table shows those words in lowercase. Surrounding spaces are ignored.
  warning SCL018  Tags
    Row 3, column Tags: Tags is "café" here and "wool" on the first row. Later rows are documented to skip this column, and the help page does not say which value the importer keeps.
  warning SCL032  Tags
    Row 3, column Tags: tag "café" contains an accented character. Tags should use letters, numbers, and hyphens, and should avoid accented characters and symbols.
  warning SCL018  Vendor
    Row 3, column Vendor: Vendor is "Other" here and "Acme" on the first row. Later rows are documented to skip this column, and the help page does not say which value the importer keeps.
  warning SCL038  Weight value (grams)
    Row 3, column Weight value (grams): "5 kg" is not only a number of grams. You should specify only the numerical value, without the unit of measurement or decimals.

Row 4
  warning SCL026  Compare-at price
    Row 4, column Compare-at price: compare-at price 8.00 is not higher than price 8.00. The compare-at price has to be higher than the price to display a sale.
  error SCL028  Product image URL
    Row 4, column Product image URL: "images/coat.jpg" is not an absolute http:// or https:// URL. The importer requires http:// in front of an image URL, and product images are documented as publicly reachable https:// URLs.
  error SCL015  URL handle
    Row 4, column URL handle: "my coat" contains a space. A valid URL handle can contain letters, dashes, and numbers, but it can't contain spaces.

6 errors, 8 warnings, 3 data rows, 2 products.
```

That command exits 1.

Shopify's current sample product CSV (`test/fixtures/shopify/product_template.csv`, source, redirect, and sha256 in `test/fixtures/shopify/SOURCE.txt`) prints:

```text
test/fixtures/shopify/product_template.csv

No problems found.

0 errors, 0 warnings, 16 data rows, 3 products.
```

That command exits 0.

## Fixing a file

`catalog-csv-lint FILE.csv --fix OUT.csv` writes a copy with the fixes below applied, prints every change, then checks the copy. The exit code is the exit code of that check. The copy keeps a UTF-8 BOM when the input had one. Each record keeps the line ending that followed it, so a file that mixes LF and CRLF is not rewritten to one style. Blank lines stay, attached to the record they followed. Blank lines before the first record stay at the front. A file with no line ending after its last row has none in the copy, even when a move puts a different row last. A cell stays quoted when the input quoted it, and is quoted when it contains a comma, a quote, or a line break.

Each change is one line: the input row (`header` for the header row), the column, the rule id, the old value, an arrow, and the new value. A header change shows the header as it was in the input. A cell change shows the header as it is in the copy. A move is one line for each handle whose rows change position, written `SCL016  "a"  2, 4 → 2, 3`: the rule id, the handle, its row numbers in the input, and its row numbers in the copy. Row numbers in the change lines are rows of the input. Row numbers in the report are rows of the copy, so they differ after a move.

The copy changes only these problems, and only when the replacement is certain. The Fix column in [docs/RULES.md](https://github.com/ericcheng0904-pixel/product-csv-lint/blob/main/docs/RULES.md) names the same five rules in one line each. The conditions are on this page.

| Rule | What is written |
| --- | --- |
| SCL007 | Trailing whitespace is removed from every header name. The checker warns only when the last header cell has it. |
| SCL005 | A header is renamed to the documented spelling and case, when it maps to exactly one documented column and no other header maps to that column. |
| SCL016 | Rows that share a URL handle are moved so they sit together. Each handle stays at the position of its first row. The order of rows inside a handle stays. A row with a blank handle stays where it is relative to the row above it. |
| SCL025 | A `$`, `€`, `£`, `¥`, or an uppercase three-letter code that is an active ISO 4217 code is removed from Price, Compare-at price, or Cost per item, when the rest of the cell is a plain number with a dot decimal and at most two decimals (`12`, `12.5`, `12.00`). The mark may sit before or after the number, with optional spaces (the space character only). |
| SCL038 | `g`, `gram`, or `grams` is removed from Weight value (grams), when the cell is a whole number followed by that unit, with an optional space character, in any case. |

Trailing whitespace is removed from every header name, including a header the checker does not warn about. A leading space stays, unless SCL005 replaces that header with the documented spelling.

The using-csv page says to enter the URL handle on the following rows. It does not say what a blank handle means, so a blank handle only travels with the row above it and keeps that order. A titled blank row directly between two rows of one handle stays with the row above it, so those rows are not brought together and SCL016 stays in the report. A handle of only spaces is not blank, and those rows are moved together. Rows that share a handle are grouped even when a later Title differs. That can report SCL018 or SCL022. The Title cell is not changed. Two handle columns use the first one. A different case, or a trailing space, stays a different handle.

A currency mark is removed only for `$`, `€`, `£`, `¥`, or an active ISO 4217 alphabetic code (list one, including funds codes). `10 OFF`, `5 PCS`, `NEW 5`, and `SKU123` stay. `12 usd` stays. Only a space (U+0020) may sit between the mark and the number. A tab, a non-breaking space, or a line break leaves the cell as it is. The same space rule applies to a gram suffix.

A change that needs a choice is left in the file, and the finding stays. A URL handle stays as written, because a changed handle creates a new product when the file overwrites an existing one. Image URLs, Status, text lengths, and tags stay. A later row's Title, Description, Vendor, or Tags stays, because the help page does not say which value the importer keeps. A price that contains a comma, a minus sign, or two symbols, or that has no digit before the dot (`$.99`), stays. A weight in kg, lb, or oz stays, and a decimal gram weight stays: there is no unit conversion and no rounding. A header that maps to the same column as another header stays.

The copy is not a promise that Shopify will import it. Every finding that has no fix stays, and the report at the end lists them. A fix can also reveal a finding that the bad value hid, because a check cannot run on a value it cannot read. Removing the symbol from a price lets the compare-at check run. Moving rows together lets the checks that compare rows of one product run on the whole group (SCL018, SCL022). Read the report for the copy, not only the change list.

When none of those fixes apply, the output file is not written. The command prints `No automatic fixes apply.` and then the report for the input.

The command refuses, exits 1, and writes nothing when the output file already exists, unless `--force` is given. It also refuses when the output path is the input path, and when the input is not valid UTF-8 (SCL010), has a quote error (SCL012), has no header row (SCL014), or is larger than 15 MiB (SCL011, error severity).

```bash
catalog-csv-lint test/fixtures/broken-product.csv --fix broken-product-fixed.csv
```

```text
3  "Price"  SCL025  "$12.00" → "12.00"

broken-product-fixed.csv

Row 3
  warning SCL026  Compare-at price
    Row 3, column Compare-at price: compare-at price 10 is not higher than price 12.00. The compare-at price has to be higher than the price to display a sale.
  warning SCL045  Gift card
    Row 3, column Gift card: Gift card is true. A gift card cannot be created by importing a product CSV. It has to be created in the admin.
  warning SCL019  Option1 name
    Row 3, column Option1 name: Option1 name is "Color" here and "Size" on the first row of this product. The sample product CSV keeps one option name, on the first row.
  error SCL022  Option1 value
    Row 3, column Option1 value: option values "Small" are already used on row 2. The importer reports "Validation failed: options are not unique".
  warning SCL037  Product image URL
    Row 3, column Product image URL: the image file name ends with _thumb. The product image file name must not include _thumb, _small, or _medium.
  error SCL029  SEO title
    Row 3, column SEO title: SEO title is 91 characters. The documented limit is 70.
  error SCL027  Status
    Row 3, column Status: "live" is not one of: active, draft, or archived. Values are matched without case sensitivity because the sample CSV uses TRUE, FALSE, DENY, CONTINUE, and Active, while the column table shows those words in lowercase. Surrounding spaces are ignored.
  warning SCL018  Tags
    Row 3, column Tags: Tags is "café" here and "wool" on the first row. Later rows are documented to skip this column, and the help page does not say which value the importer keeps.
  warning SCL032  Tags
    Row 3, column Tags: tag "café" contains an accented character. Tags should use letters, numbers, and hyphens, and should avoid accented characters and symbols.
  warning SCL018  Vendor
    Row 3, column Vendor: Vendor is "Other" here and "Acme" on the first row. Later rows are documented to skip this column, and the help page does not say which value the importer keeps.
  warning SCL038  Weight value (grams)
    Row 3, column Weight value (grams): "5 kg" is not only a number of grams. You should specify only the numerical value, without the unit of measurement or decimals.

Row 4
  warning SCL026  Compare-at price
    Row 4, column Compare-at price: compare-at price 8.00 is not higher than price 8.00. The compare-at price has to be higher than the price to display a sale.
  error SCL028  Product image URL
    Row 4, column Product image URL: "images/coat.jpg" is not an absolute http:// or https:// URL. The importer requires http:// in front of an image URL, and product images are documented as publicly reachable https:// URLs.
  error SCL015  URL handle
    Row 4, column URL handle: "my coat" contains a space. A valid URL handle can contain letters, dashes, and numbers, but it can't contain spaces.

5 errors, 9 warnings, 3 data rows, 2 products.
```

That command exits 1. Price `$12.00` becomes `12.00`. Before the fix, SCL026 could not compare Compare-at price with Price on row 3, because `$12.00` is not a number, so the first report has no SCL026 for that row. With `12.00` the check runs, and `10` is not higher than `12.00`, so the copy reports a warning. The compare-at cell is unchanged. The check of the original file was 6 errors and 8 warnings. The check of the copy is 5 errors and 9 warnings.

The sample product CSV has none of these problems, so the same option writes nothing:

```bash
catalog-csv-lint test/fixtures/shopify/product_template.csv --fix shopify-product-fixed.csv
```

```text
No automatic fixes apply.

test/fixtures/shopify/product_template.csv

No problems found.

0 errors, 0 warnings, 16 data rows, 3 products.
```

That command exits 0. `shopify-product-fixed.csv` is not created.

## JSON

`--json` prints one object, schema version 1, with keys in this order:

| Key | Meaning |
| --- | --- |
| `schemaVersion` | Always `1`. |
| `file` | Path you passed. With `--fix`, the output path when a file was written, otherwise the input path. |
| `bytes` | File size in bytes. For a pipe or other input that is not a regular file, the number of bytes read, which is all that is known when the input is above 15 MiB. |
| `dataRows` | Product rows after the header. Blank lines are not counted. `0` when the file is rejected before a full read. |
| `products` | Products grouped by URL handle. |
| `errorCount` | Findings with severity `error`. |
| `warningCount` | Findings with severity `warning`. |
| `maxWarnings` | The `--max-warnings` value, or `null`. |
| `ok` | `true` when `errorCount` is 0 and the warning count is within `maxWarnings`. |
| `truncated` | `null`, or an object of rule id to the number of findings omitted after the first 100. Counts above include the omitted findings. |
| `findings` | The first 100 findings per rule, sorted by row (file-level findings first), then column, rule id, and message. |
| `fixes` | Present only with `--fix`, after `findings`. Each change is `ruleId`, `row`, `column`, `before`, and `after`. A header change has row `1`. An SCL016 change has `row` `null`, `column` set to the handle, and `before` and `after` as arrays of row numbers (input rows, then copy rows). Not limited to 100 per rule. |
| `output` | Present only with `--fix`, after `fixes`. The output path when a file was written, otherwise `null`. |

Each finding has `ruleId`, `severity` (`error` or `warning`), `row` (CSV record number, or `null` for the file), `column` (header text, or `null`), `message` (one line; `File:` or `Row N`, or `Line N:` for a quote error), and `citation` (a `help.shopify.com` URL, two URLs, the `cdn.shopify.com` address of the sample CSV for the two rules that rest on it, or an empty string when the check is an inference). Control characters in a cell value or in a header name, including DEL, C1 controls, and U+2028 and U+2029, are escaped once in the message and in the text report. `column` keeps the header text as written.

With `--fix`, `fixes` and `output` follow `findings`. `file`, the counts, and `findings` describe the written file when one was written, and the input when nothing was written. `schemaVersion` stays 1. Without `--fix` those two keys are absent. The object below is a report without `--fix`.

```json
{
  "schemaVersion": 1,
  "file": "fixture.csv",
  "bytes": 130,
  "dataRows": 1,
  "products": 1,
  "errorCount": 2,
  "warningCount": 1,
  "maxWarnings": null,
  "ok": false,
  "truncated": null,
  "findings": [
    {
      "ruleId": "SCL026",
      "severity": "warning",
      "row": 2,
      "column": "Compare-at price",
      "message": "Row 2, column Compare-at price: compare-at price 5 is not higher than price 10.00. The compare-at price has to be higher than the price to display a sale.",
      "citation": "https://help.shopify.com/en/manual/products/details/product-pricing/sale-pricing"
    },
    {
      "ruleId": "SCL028",
      "severity": "error",
      "row": 2,
      "column": "Product image URL",
      "message": "Row 2, column Product image URL: \"images/hat.jpg\" is not an absolute http:// or https:// URL. The importer requires http:// in front of an image URL, and product images are documented as publicly reachable https:// URLs.",
      "citation": "https://help.shopify.com/en/manual/products/import-export/common-import-issues"
    },
    {
      "ruleId": "SCL015",
      "severity": "error",
      "row": 2,
      "column": "URL handle",
      "message": "Row 2, column URL handle: \"my hat\" contains a space. A valid URL handle can contain letters, dashes, and numbers, but it can't contain spaces.",
      "citation": "https://help.shopify.com/en/manual/products/import-export/using-csv"
    }
  ]
}
```

`test/fixtures/report.snapshot.json` is that report for `test/fixtures/schema-sample.csv`.

## Use in GitHub Actions

There is no `v0` release yet. After a `v0` tag exists, a repository that keeps product CSVs can lint them on every push and pull request with:

```yaml
name: Product CSV
on:
  push:
  pull_request:
jobs:
  catalog-csv-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ericcheng0904-pixel/product-csv-lint@v0
        with:
          files: "products/**/*.csv"
```

Until that tag exists, a checkout of this repository runs the same action with `uses: ./`.

The action sets up Node.js 20, builds this repository from the checkout GitHub resolved for that ref, and lints each matching file. Findings become workflow annotations. A gift-card warning and a URL handle with a space look like this:

```text
::warning file=products/coat.csv,line=3,title=SCL045::Row 3, column Gift card: Gift card is true. A gift card cannot be created by importing a product CSV. It has to be created in the admin.
::error file=products/coat.csv,line=4,title=SCL015::Row 4, column URL handle: "my coat" contains a space. A valid URL handle can contain letters, dashes, and numbers, but it can't contain spaces.
```

The job summary is a Markdown table of each file and its findings. `files` defaults to `**/*.csv`. `annotations` defaults to true. The annotation line is the CSV record number from the JSON report. No matching file is a success. Directories named `node_modules` and `.git` are not searched.

The job fails when any file has an error. `max-warnings` is a per-file cap: more warnings than that number fails the job. `fail-on-warnings` defaults to false. `fail-on-warnings: true` is the same as `max-warnings: "0"`. SCL003 and SCL047 warn on a new simple product that omits URL handle or the option columns. Those warnings matter for overwrite and update. Leave them as warnings for a first upload, or set `fail-on-warnings: true` only when every warning should fail the job.

## Rules

SCL001 through SCL050. Rules are taken from help pages or the sample CSV. Inferences and conflicts are marked. The table, the quotes, the date those pages were read (2026-10-27 UTC), and the list of things this tool does not check are in [docs/RULES.md](https://github.com/ericcheng0904-pixel/product-csv-lint/blob/main/docs/RULES.md). `catalog-csv-lint --rules` prints the same rules without the Fix column.

## Development

```bash
npm ci
npm test
```

`npm test` compiles TypeScript to `dist/` and runs `node --test`, including `scripts/gh-annotations.test.mjs` and `scripts/run-action.test.mjs`. `prepare` runs the same build, so `npm install -g --install-links` from a git URL produces the `catalog-csv-lint` command. The git-install test runs that command against a local `git+file://` clone, which installs dev dependencies from the npm registry, so `npm test` needs network access on a machine with a cold npm cache. Offline, run `CATALOG_CSV_LINT_SKIP_INSTALL=1 npm test`. The packed-tarball tests do not use the network. npm 11.16 warns that `prepare` is not covered by `allowScripts` for a git install; the install still builds `dist/` today, and the test will show it if npm starts enforcing the setting. There are no runtime dependencies. The published package contains `dist/`, this README, `LICENSE`, and `package.json`. `.github/workflows/self-test.yml` runs the composite action on the sample product CSV and on `test/fixtures/broken-product.csv`.

## Releasing

Maintainers publish; CI does not.

1. Bump `version` in `package.json` and add the same version to `CHANGELOG.md`.
2. Run `npm pack --dry-run`. The tarball should list only `dist/`, `README.md`, `LICENSE`, and `package.json`.
3. Tag that commit (`v0.1.0` for this version), move the `v0` tag to it, and push the tags.

## License

MIT, see [LICENSE](LICENSE). The sample files in `corpus/files` keep their own terms; see [corpus/NOTICE.md](corpus/NOTICE.md).
