# Contributing

catalog-csv-lint checks a Shopify product CSV against documented import rules. It is not affiliated with Shopify.

A rule needs all three of these:

- A sentence on a current help.shopify.com page, cited in `docs/RULES.md` with the date the page was read. An error needs a sentence that says the importer rejects, fails, or limits the value.
- The basis `inference` when no page states the outcome, `sample` when the evidence is the sample CSV, or `conflict` when two pages disagree. Those findings are warnings.
- A test.

Do not invent a limit. If the pages do not support the check, leave it out.
