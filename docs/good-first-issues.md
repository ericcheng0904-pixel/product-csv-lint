# Good first issues

Five small tasks. Each one can land as a single pull request. Open an issue with the title and body if you want to work on it, and leave a comment so two people do not do the same work.

## Proofread the project sentences in the rule doc

**Title:** Proofread the project sentences in docs/RULES.md

**Body:**

The quotes in the rule table are shortened words from help pages, and the "What it checks" cells are the summaries in `src/rules.ts`. `test/rules.test.ts` requires each quote, citation, and summary to appear unchanged in `docs/RULES.md`. Leave those cells, the URLs, the severities, the basis values, and the dates as they are.

Read "How a few rules are applied" and "Not checked". Fix spelling and grammar in those sections. If a sentence disagrees with the checker, leave the sentence and describe the disagreement in the pull request. Do not change a limit, a severity, or the code.

**Acceptance criteria:**

- The diff is limited to the prose in `docs/RULES.md` outside the quote column and the "What it checks" column.
- No severity, basis, URL, quote, summary, or checked date changes.
- `npm test` passes.
- No runtime dependency is added.

## Test URL-handle identity edges

**Title:** Test a spaces-only URL handle, a case change, and a trailing space

**Body:**

`README.md` and `docs/RULES.md` say that a URL handle of only spaces is not blank, that `--fix` moves rows with that handle together, and that a different case or a trailing space stays a different handle. The grouping tests in `test/fix.test.ts` cover an empty handle. They do not cover these three.

Add tests. Do not change the checker unless a test shows the docs are already wrong. A handle that contains a space is still an SCL015 error; that includes a spaces-only handle and a trailing space. SCL015 is expected there. SCL016 and a rewrite are not expected for a case change or a trailing space.

Use synthetic rows:

```csv
Title,URL handle
Hat,   
Coat,coat
Cap,   
```

```csv
Title,URL handle
Hat,hat
Coat,coat
Cap,Hat
```

```csv
Title,URL handle
Hat,hat
Coat,coat
Cap,hat 
```

For the spaces-only file, the report includes SCL016, and `--fix` rewrites the rows so the two `   ` handles sit together (`Hat`, then `Cap`, then `Coat`). For the other two files, `--fix` writes nothing, and SCL016 is absent. `hat` and `Hat` produce no findings. `hat ` (trailing space) produces SCL015 only.

**Acceptance criteria:**

- New tests live in `test/fix.test.ts` or `test/rules.test.ts` and fail if this behavior changes.
- The three files above keep the results just described.
- No production code changes unless a new test fails on the current checker.
- `npm test` passes.
- No runtime dependency is added.

## Add a test that each quote is under 25 words

**Title:** Fail the build when a rule quote reaches 25 words

**Body:**

`docs/RULES.md` says a quote is the supporting words from the cited page, kept under 25 words. Nothing checks the length. A quote can grow past that limit and `npm test` still passes.

Add a test beside the other rule-catalog checks in `test/rules.test.ts`. For every rule with a non-empty `quote`, split the quote on whitespace and assert there are at most 24 words. The quotes in the tree today are under that limit, so the test should pass without editing `src/rules.ts` or `docs/RULES.md`.

Count words the way the sentence is written: split on whitespace, and do not strip punctuation. `aren't` is one word. A `/` with spaces around it is its own word.

**Acceptance criteria:**

- `npm test` fails when any non-empty `Rule.quote` has 25 or more whitespace-separated words.
- Empty quotes (the inference rules) are skipped.
- Existing quotes and `docs/RULES.md` stay as they are.
- `npm test` passes.
- No runtime dependency is added.

## Add a `--quiet` flag

**Title:** Add `--quiet` to print the summary line only

**Body:**

`catalog-csv-lint` always prints every finding. A script that only wants the exit code and the totals still gets the full report.

Add `--quiet`:

- A text report is one summary line, the same line the full report ends with (`6 errors, 8 warnings, 3 data rows, 2 products.`), plus a trailing newline. Finding lines and `No problems found.` are omitted.
- With `--fix`, `--quiet` still prints the change list, or `No automatic fixes apply.`, using the same preface as the full report, then the summary line. It omits the per-finding report of the copy.
- Exit codes stay the same, including `--max-warnings` and a copy that still has errors.
- `--quiet` combined with `--json` or `--rules` is a usage error and exits 1. When `--json` is present, the error follows the existing usage-error shape: a `schemaVersion` 1 object on stdout and the same message on stderr. Without `--json`, the message goes to stderr and stdout stays empty.
- `--help` lists `--quiet` and still exits 0. The Usage line in `README.md` lists `--quiet` too.

**Acceptance criteria:**

- `test/cli.test.ts` covers a text report, a `--fix` report, an unchanged exit code, and the `--json` / `--rules` usage error.
- The default text report and the default JSON report are unchanged.
- `npm test` passes.
- No rule change and no runtime dependency.

## Add a `--version` flag

**Title:** Add `--version` and print the package version

**Body:**

`package.json` has a version. The command does not. `--version` should print `catalog-csv-lint` and that version (today, `catalog-csv-lint 0.1.0`) and exit 0. Read the version from `package.json` next to the program, so a release bump does not require a second edit. Do not hardcode the number in `src/cli.ts`.

`--version` does not read a CSV. Handle it like `--help`: when the flag is present, print the version and exit 0 before usage checks, so a file path or `--fix` on the same command does not lint and does not need an output path. `--help` mentions `--version`. A test installs nothing extra: run `dist/cli.js --version` and compare it with the `version` field in `package.json`.

**Acceptance criteria:**

- `catalog-csv-lint --version` prints the package version and exits 0.
- `catalog-csv-lint --version some.csv` does not lint and exits 0.
- `--help` mentions the flag.
- `npm test` passes.
- No rule change and no runtime dependency.
