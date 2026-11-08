# Regenerate from the repository root, after npm ci:
#   vhs media/demo.tape
# https://github.com/charmbracelet/vhs
# The tape lints test/fixtures/broken-product.csv, then writes a --fix copy.
Output media/demo.gif

Set Shell bash
Set Theme "Catppuccin Mocha"
Set FontFamily "JetBrains Mono"
Set FontSize 13
Set LineHeight 1.1
Set LetterSpacing 0
Set Padding 16
Set Columns 100
Set Rows 58
Set TypingSpeed 40ms
Set Framerate 12
Set CursorBlink false
Set WindowBar Colorful
Set BorderRadius 8

Hide
Type "mkdir -p /tmp/catalog-csv-lint-bin"
Enter
Sleep 100ms
Type "ln -sfn $PWD/dist/cli.js /tmp/catalog-csv-lint-bin/catalog-csv-lint"
Enter
Sleep 100ms
Type "export PATH=/tmp/catalog-csv-lint-bin:$PATH"
Enter
Sleep 100ms
Type "unset PROMPT_COMMAND"
Enter
Sleep 100ms
Type "export PS1='$ '"
Enter
Sleep 100ms
Type "rm -f broken-product-fixed.csv"
Enter
Sleep 100ms
Type "clear"
Enter
Sleep 200ms
Show

Type "catalog-csv-lint test/fixtures/broken-product.csv"
Enter
Sleep 4.5s

Type "catalog-csv-lint test/fixtures/broken-product.csv --fix broken-product-fixed.csv"
Enter
Sleep 5.3s

Hide
Type "rm -f broken-product-fixed.csv"
Enter
