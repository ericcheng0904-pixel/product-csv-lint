/**
 * Mechanical corrections for a product CSV.
 *
 * Pure function of the CSV text. No file system, paths, or buffers, so a
 * browser can call it later. The CLI decides where the text is written.
 * A change is made only when the replacement is determined by the cell
 * itself. Anything that needs a choice is left for the report.
 */

import { matchHeader, type FieldId } from "./columns.js";
import { parseCsv, type CsvRecord } from "./csv.js";

export interface FixChange {
  ruleId: "SCL005" | "SCL007" | "SCL016" | "SCL025" | "SCL038";
  /** Input CSV record number. Null for an SCL016 move. Header changes are row 1. */
  row: number | null;
  column: string | null;
  /** Cell text, or for SCL016 the input row numbers of that handle. */
  before: string | number[];
  /** Cell text, or for SCL016 the row numbers after the move. */
  after: string | number[];
}

export interface FixBlocked {
  ok: false;
  ruleId: "SCL012" | "SCL014";
  message: string;
}

export interface FixReady {
  ok: true;
  fixes: FixChange[];
  /** Rewritten CSV, or null when no fix applies. The caller must not invent a file. */
  text: string | null;
}

export type FixResult = FixBlocked | FixReady;

interface PhysicalRow {
  row: number;
  values: string[];
  quoted: boolean[];
  terminator: string;
  gapAfter: string;
}

const MONEY_FIELDS = new Set<FieldId>(["price", "compareAt", "cost"]);

/**
 * A plain number with a dot and at most two decimals: 12, 12.5, 12.00.
 * A leading dot (.99) is accepted by the checker and is not rewritten here.
 */
const NUMBER = String.raw`\d+(?:\.\d{1,2})?`;
/**
 * Active ISO 4217 alphabetic codes (list one, including funds codes) as of
 * 1 January 2026. A three-letter word that is not in this set is not a price.
 * https://en.wikipedia.org/wiki/ISO_4217
 */
const ISO_CODES = [
  "AED", "AFN", "ALL", "AMD", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM",
  "BBD", "BDT", "BHD", "BIF", "BMD", "BND", "BOB", "BOV", "BRL", "BSD",
  "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHE", "CHF", "CHW", "CLF",
  "CLP", "CNY", "COP", "COU", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK",
  "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL",
  "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF",
  "IDR", "ILS", "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES",
  "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP",
  "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT",
  "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MXV", "MYR", "MZN", "NAD",
  "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP",
  "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD",
  "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN",
  "SVC", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD",
  "TWD", "TZS", "UAH", "UGX", "USD", "USN", "UYI", "UYU", "UYW", "UZS",
  "VED", "VES", "VND", "VUV", "WST", "XAD", "XAF", "XAG", "XAU", "XBA",
  "XBB", "XBC", "XBD", "XCD", "XCG", "XDR", "XOF", "XPD", "XPF", "XPT",
  "XSU", "XTS", "XUA", "XXX", "YER", "ZAR", "ZMW", "ZWG",
] as const;
const ISO = new Set<string>(ISO_CODES);
const MARK = String.raw`(?:[$€£¥]|[A-Z]{3})`;
const MONEY = new RegExp(`^(?:(${MARK}) *(${NUMBER})|(${NUMBER}) *(${MARK}))$`);
const GRAMS = /^(\d+) *(grams|gram|g)$/i;

export function fixCsv(text: string): FixResult {
  const parsed = parseCsv(text);
  if (!parsed.ok) {
    return { ok: false, ruleId: "SCL012", message: `Line ${parsed.line}: ${parsed.message}` };
  }
  if (parsed.records.length === 0) {
    return { ok: false, ruleId: "SCL014", message: "the file has no header row" };
  }

  const headerRecord = parsed.records[0]!;
  const originalHeaders = headerRecord.values.slice();
  const headerValues = originalHeaders.slice();
  const headerQuoted = headerRecord.quoted.slice();
  const matches = originalHeaders.map((header) => matchHeader(header));
  const fieldCount = new Map<FieldId, number>();
  for (const match of matches) {
    if (!match) continue;
    fieldCount.set(match.field, (fieldCount.get(match.field) ?? 0) + 1);
  }

  const fixes: FixChange[] = [];
  for (let index = 0; index < headerValues.length; index += 1) {
    const original = originalHeaders[index]!;
    let value = original;
    if (value.trim() !== "" && value !== value.trimEnd()) {
      const after = value.trimEnd();
      fixes.push({ ruleId: "SCL007", row: 1, column: original, before: value, after });
      value = after;
    }
    const match = matches[index];
    const alone = match !== null && (fieldCount.get(match.field) ?? 0) === 1;
    if (match && !match.exact && alone && match.documented !== value) {
      fixes.push({
        ruleId: "SCL005",
        row: 1,
        column: original,
        before: value,
        after: match.documented,
      });
      value = match.documented;
    }
    headerValues[index] = value;
  }

  let data: PhysicalRow[] = parsed.records.slice(1).map((record) => copyRow(record));
  const targets: Array<{ index: number; field: FieldId; header: string }> = [];
  matches.forEach((match, index) => {
    if (!match) return;
    if (!MONEY_FIELDS.has(match.field) && match.field !== "weightGrams") return;
    targets.push({ index, field: match.field, header: headerValues[index]! });
  });

  for (const row of data) {
    for (const target of targets) {
      if (target.index >= row.values.length) continue;
      const before = row.values[target.index]!;
      const after = target.field === "weightGrams" ? gramNumber(before) : moneyNumber(before);
      if (after === null || after === before) continue;
      fixes.push({
        ruleId: target.field === "weightGrams" ? "SCL038" : "SCL025",
        row: row.row,
        column: target.header,
        before,
        after,
      });
      row.values[target.index] = after;
    }
  }

  const handleIndex = matches.findIndex((match) => match?.field === "handle");
  if (handleIndex !== -1) {
    const moved = regroup(data, handleIndex);
    if (moved.changed) {
      data = moved.rows;
      for (const fix of moved.fixes) fixes.push(fix);
    }
  }

  if (fixes.length === 0) return { ok: true, fixes, text: null };

  const header: PhysicalRow = {
    row: headerRecord.row,
    values: headerValues,
    quoted: headerQuoted,
    terminator: headerRecord.terminator,
    gapAfter: headerRecord.gapAfter,
  };
  const bom = text.startsWith("\uFEFF") ? "\uFEFF" : "";
  const last = parsed.records[parsed.records.length - 1]!;
  const unterminated = last.terminator === "" ? last.row : null;
  return { ok: true, fixes, text: rewrite(bom, parsed.leadingGap, [header, ...data], unterminated) };
}

function copyRow(record: CsvRecord): PhysicalRow {
  return {
    row: record.row,
    values: record.values.slice(),
    quoted: record.quoted.slice(),
    terminator: record.terminator,
    gapAfter: record.gapAfter,
  };
}

/**
 * Each record keeps the separator that followed it, and the blank lines that
 * followed that separator. The record that ran to the end of the file has an
 * empty separator. If a move puts another row last, that separator and the
 * row's own are swapped, so the file still ends without a line ending and no
 * two rows are joined.
 */
function rewrite(
  bom: string,
  leadingGap: string,
  rows: PhysicalRow[],
  unterminatedRow: number | null,
): string {
  if (unterminatedRow !== null) {
    const tail = rows[rows.length - 1]!;
    const holder = rows.find((row) => row.row === unterminatedRow)!;
    if (holder !== tail) {
      holder.terminator = tail.terminator;
      holder.gapAfter = tail.gapAfter;
      tail.terminator = "";
      tail.gapAfter = "";
    }
  }
  let out = bom + leadingGap;
  for (const row of rows) out += encodeRecord(row.values, row.quoted) + row.terminator + row.gapAfter;
  return out;
}

/** Trim U+0020 only. Tabs, non-breaking spaces and line breaks stay. */
function stripSpaces(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) === 32) start += 1;
  while (end > start && value.charCodeAt(end - 1) === 32) end -= 1;
  return start === 0 && end === value.length ? value : value.slice(start, end);
}

/**
 * Remove one currency symbol or active ISO 4217 code. The gap is a space
 * (U+0020) only. Null for a comma, a minus, two symbols, another code, or
 * any other character between the mark and the number.
 */
function moneyNumber(raw: string): string | null {
  const value = stripSpaces(raw);
  if (value === "" || value.includes(",") || value.includes("-")) return null;
  const match = MONEY.exec(value);
  if (!match) return null;
  const symbol = match[1] ?? match[4];
  const number = match[2] ?? match[3];
  if (symbol === undefined || number === undefined) return null;
  if (symbol.length === 3 && !ISO.has(symbol)) return null;
  return number;
}

/** Whole number of grams with a g / gram / grams suffix. Never converts or rounds. */
function gramNumber(raw: string): string | null {
  const match = GRAMS.exec(stripSpaces(raw));
  if (!match) return null;
  return match[1]!;
}

function regroup(
  rows: PhysicalRow[],
  handleIndex: number,
): { rows: PhysicalRow[]; fixes: FixChange[]; changed: boolean } {
  const clusters: Array<{ handle: string; rows: PhysicalRow[] }> = [];
  for (const row of rows) {
    const handle = row.values[handleIndex] ?? "";
    if (handle === "" && clusters.length > 0) clusters[clusters.length - 1]!.rows.push(row);
    else clusters.push({ handle, rows: [row] });
  }

  const byHandle = new Map<string, typeof clusters>();
  for (const cluster of clusters) {
    if (cluster.handle === "") continue;
    const list = byHandle.get(cluster.handle) ?? [];
    list.push(cluster);
    byHandle.set(cluster.handle, list);
  }

  const emitted = new Set<string>();
  const ordered: typeof clusters = [];
  for (const cluster of clusters) {
    if (cluster.handle === "") {
      ordered.push(cluster);
      continue;
    }
    if (emitted.has(cluster.handle)) continue;
    emitted.add(cluster.handle);
    const group = byHandle.get(cluster.handle) ?? [];
    for (const item of group) ordered.push(item);
  }

  const next: PhysicalRow[] = [];
  for (const cluster of ordered) {
    for (const row of cluster.rows) next.push(row);
  }
  const changed = next.some((row, index) => row !== rows[index]);
  if (!changed) return { rows, fixes: [], changed: false };

  const newNumber = new Map<number, number>();
  next.forEach((row, index) => newNumber.set(row.row, index + 2));
  const fixes: FixChange[] = [];
  for (const [handle, group] of byHandle) {
    const before = group.flatMap((cluster) =>
      cluster.rows.filter((row) => (row.values[handleIndex] ?? "") === handle).map((row) => row.row),
    );
    const after = before.map((row) => newNumber.get(row)!);
    if (before.some((row, index) => row !== after[index])) {
      fixes.push({ ruleId: "SCL016", row: null, column: handle, before, after });
    }
  }
  return { rows: next, fixes, changed: true };
}

function encodeRecord(values: string[], quoted: boolean[]): string {
  return values.map((value, index) => encodeCell(value, quoted[index] === true)).join(",");
}

function encodeCell(value: string, quoted: boolean): string {
  if (quoted || /[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
