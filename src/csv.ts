/**
 * RFC 4180 CSV reader.
 *
 * Quotes, escaped quotes, embedded newlines, CR, LF, and CRLF are handled.
 * A leading U+FEFF is skipped so a UTF-8 BOM does not stick to the first
 * header. Blank lines (no characters between record separators) are ignored.
 * The parser keeps a field buffer. Pass onRecord to lint one record at a time
 * without retaining the file. Callers that reject files over the import size
 * stop feeding the parser once that many bytes have been read.
 */

export interface CsvRecord {
  /** 1-based CSV record number. The header row is 1. */
  row: number;
  values: string[];
  /**
   * True when the input quoted that cell. An empty `""` is quoted.
   * A cell the input left bare is false, even if it is empty.
   */
  quoted: boolean[];
  /** Separator that ended this record. Empty when the record ran to EOF. */
  terminator: string;
  /** Blank-line separators that followed this record, after `terminator`. */
  gapAfter: string;
}

export interface CsvParseSuccess {
  ok: true;
  records: CsvRecord[];
  /** Blank-line separators before the first record. */
  leadingGap: string;
}

export interface CsvParseFailure {
  ok: false;
  message: string;
  /** 1-based physical line where the problem was detected. */
  line: number;
  /** 1-based CSV record that was being read. */
  row: number;
}

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

type Mode = "field" | "quoted" | "afterQuote";

export function createCsvParser(options?: {
  onRecord?: (record: CsvRecord) => void;
}): {
  push(chunk: string): void;
  finish(): CsvParseResult;
} {
  const onRecord = options?.onRecord;
  let mode: Mode = "field";
  let field = "";
  let fieldQuoted = false;
  let record: string[] = [];
  let quoted: boolean[] = [];
  const records: CsvRecord[] = [];
  let started = false;
  let atFieldStart = true;
  let crPending = false;
  let skipBom = true;
  let line = 1;
  let recordNumber = 1;
  let quoteLine = 1;
  let quoteRow = 1;
  let failed: CsvParseFailure | null = null;
  let leadingGap = "";
  let lastRecord: CsvRecord | null = null;

  function fail(message: string, at?: { line: number; row: number }): void {
    if (failed) return;
    failed = {
      ok: false,
      message,
      line: at?.line ?? line,
      row: at?.row ?? recordNumber,
    };
  }

  function endField(): void {
    record.push(field);
    quoted.push(fieldQuoted);
    field = "";
    fieldQuoted = false;
    atFieldStart = true;
    mode = "field";
  }

  function pushRecord(terminator: string): void {
    endField();
    const finished: CsvRecord = {
      row: recordNumber,
      values: record,
      quoted,
      terminator,
      gapAfter: "",
    };
    lastRecord = finished;
    if (onRecord) onRecord(finished);
    else records.push(finished);
    recordNumber += 1;
    record = [];
    quoted = [];
    field = "";
    fieldQuoted = false;
    started = false;
    atFieldStart = true;
    mode = "field";
  }

  function newline(terminator: string): void {
    line += 1;
    if (!started && record.length === 0 && field === "") {
      if (lastRecord) lastRecord.gapAfter += terminator;
      else leadingGap += terminator;
      return;
    }
    pushRecord(terminator);
  }

  function take(ch: string): void {
    if (failed) return;
    if (skipBom) {
      skipBom = false;
      if (ch === "\uFEFF") return;
    }
    if (crPending) {
      crPending = false;
      if (ch === "\n" && mode !== "quoted") {
        newline("\r\n");
        return;
      }
      if (mode === "quoted") {
        field += "\r";
      } else {
        newline("\r");
      }
    }

    if (mode === "quoted") {
      if (ch === '"') {
        mode = "afterQuote";
        return;
      }
      if (ch === "\n") line += 1;
      field += ch;
      started = true;
      return;
    }

    if (mode === "afterQuote") {
      if (ch === '"') {
        field += '"';
        mode = "quoted";
        started = true;
        return;
      }
      if (ch !== "," && ch !== "\n" && ch !== "\r") {
        fail(
          'Stray quote. The importer reports "Illegal quoting" or "Missing or stray quote" when a quote is not closed or not doubled.',
        );
        return;
      }
      mode = "field";
      atFieldStart = false;
    }

    if (ch === '"') {
      if (atFieldStart && field === "") {
        mode = "quoted";
        fieldQuoted = true;
        quoteLine = line;
        quoteRow = recordNumber;
        started = true;
        atFieldStart = false;
        return;
      }
      fail(
        'Stray quote. The importer reports "Illegal quoting" or "Missing or stray quote" when a quote is not closed or not doubled.',
      );
      return;
    }
    if (ch === ",") {
      endField();
      started = true;
      return;
    }
    if (ch === "\n") {
      newline("\n");
      return;
    }
    if (ch === "\r") {
      crPending = true;
      return;
    }
    field += ch;
    started = true;
    atFieldStart = false;
  }

  return {
    push(chunk: string): void {
      for (const ch of chunk) take(ch);
    },
    finish(): CsvParseResult {
      if (crPending && !failed) {
        crPending = false;
        if (mode === "quoted") field += "\r";
        else newline("\r");
      }
      if (failed) return failed;
      if (mode === "quoted") {
        fail("quote opened here is never closed", { line: quoteLine, row: quoteRow });
        return failed!;
      }
      if (started || field !== "" || record.length > 0) pushRecord("");
      return { ok: true, records, leadingGap };
    },
  };
}

export function parseCsv(text: string): CsvParseResult {
  const parser = createCsvParser();
  parser.push(text);
  return parser.finish();
}

export function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}
