# Contributing

catalog-csv-lint checks a Shopify product CSV against documented import rules. It is not affiliated with Shopify.

## Run the tests

Node.js 20 or later.

```bash
npm ci
npm test
```

`npm test` compiles TypeScript to `dist/` and runs `node --test` on `test/*.test.ts`, `scripts/gh-annotations.test.mjs`, and `scripts/run-action.test.mjs`.

The git-install test installs dev dependencies from the npm registry, so a cold cache needs network access. Offline, run `CATALOG_CSV_LINT_SKIP_INSTALL=1 npm test`. There are no runtime dependencies.

## Add a rule

A rule needs all three of these:

- A sentence on a current help.shopify.com page, cited in `docs/RULES.md` with the date the page was read. An error needs a sentence that says the importer rejects, fails, or limits the value.
- The basis `inference` when no page states the outcome, `sample` when the evidence is the sample CSV, or `conflict` when two pages disagree. Those findings are warnings.
- A test.

Do not invent a limit. If the pages do not support the check, leave it out.

### Source quote

`docs/RULES.md` keeps a quote for each rule. The quote is the supporting words from the cited page, kept under 25 words. Shorten it lightly: a full stop may be added, or a placeholder or a trailing clause cut. A `/` may separate bullets the page already lists. For a `sample` rule the quote describes what the sample CSV shows and is not page text. An `inference` has no supporting sentence, so the quote and the citation are empty. `conflict` means two pages disagree, so the finding is a warning, and the URL cell lists both pages.

The quote, the citation, and the summary in `src/rules.ts` must appear unchanged in `docs/RULES.md`. `test/rules.test.ts` checks that.

### Where it goes

1. Add the rule in `src/rules.ts` (`id`, `severity`, `basis`, `summary`, `citation`, `quote`). Use a page constant from `src/citations.ts`. Add a constant there when the page is new.
2. Implement the check in `src/lint.ts`. Basis `inference`, `sample`, or `conflict` is a warning. An error has basis `page`.
3. Add a row to the table in `docs/RULES.md`: ID, severity, basis, quote, URL, what it checks, the UTC date you read the page, and a Fix cell. Use `—` in Fix when `--fix` does not change that rule. When the behavior needs a longer note, add it under "How a few rules are applied".
4. Add a passing fixture and a failing fixture to the `cases` array in `test/rules.test.ts`, in the same order as `src/rules.ts`. The passing fixture must not report that rule. The failing fixture must report it at the rule's severity, with that rule's citation.
5. Run `npm test`.

Fixtures are synthetic. Do not commit a store export.

## Pull request checklist

- [ ] `npm test` passes
- [ ] No runtime dependency was added
- [ ] Examples and fixtures are synthetic, or an official sample that already has a source URL in the repository
- [ ] A new or changed rule updates `src/rules.ts`, `docs/RULES.md`, and `test/rules.test.ts` together
- [ ] The quote is under 25 words and follows the source-quote rules in `docs/RULES.md`
- [ ] An error cites a sentence that says the importer rejects, fails, or limits the value
- [ ] `sample`, `inference`, and `conflict` are warnings
- [ ] A limit the pages do not state was left out
- [ ] The Date checked cell is the UTC date the page was read

## README demo

`media/demo.gif` is recorded from `media/demo.tape`. From the repository root, after `npm ci`, regenerate it with [VHS](https://github.com/charmbracelet/vhs) when the demo commands change:

```bash
vhs media/demo.tape
```

VHS needs [ttyd](https://github.com/tsl0922/ttyd) and ffmpeg. The tape lints `test/fixtures/broken-product.csv` and writes a corrected copy with `--fix`.

Small tasks are drafted in [docs/good-first-issues.md](docs/good-first-issues.md).
