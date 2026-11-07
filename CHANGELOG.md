# Changelog

## 0.1.0

- Checker for documented Shopify product CSV import problems, with a text report and a JSON report.
- Composite GitHub Action that annotates findings, writes a job summary, and fails the job when a file has an error.
- `--fix` writes a corrected copy for five mechanical problems: trailing header spaces, a unique documented header spelling, contiguous URL-handle rows, one currency mark on a plain price, and a whole-number gram suffix.
