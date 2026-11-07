import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import {
  FILE_SIZE_DECIMAL,
  FILE_SIZE_LIMIT,
  MAX_ALT,
  MAX_BARCODES,
  MAX_COLLECTION,
  MAX_FINDINGS_PER_RULE,
  MAX_IMAGES,
  MAX_SEO_DESCRIPTION,
  MAX_SEO_TITLE,
  MAX_TAGS,
  MAX_VARIANTS,
  OPTIMAL_ALT,
} from "./citations.js";
import {
  OPTION_SLOTS,
  PACKED_FIELDS,
  PRODUCT_LEVEL_FIELDS,
  VARIANT_COLUMN_FIELDS,
  planHeaders,
  type BoundColumn,
  type FieldId,
  type HeaderPlan,
} from "./columns.js";
import { createCsvParser, decodeUtf8, type CsvParseFailure, type CsvRecord } from "./csv.js";
import { ruleById, type Severity } from "./rules.js";
import { escapeControls } from "./text.js";

export interface Finding {
  ruleId: string;
  severity: Severity;
  row: number | null;
  column: string | null;
  message: string;
  citation: string;
}

export interface Report {
  schemaVersion: 1;
  file: string;
  bytes: number;
  dataRows: number;
  products: number;
  errorCount: number;
  warningCount: number;
  maxWarnings: number | null;
  ok: boolean;
  /** Omitted findings per rule after the first 100, or null when nothing was cut. */
  truncated: Record<string, number> | null;
  findings: Finding[];
}

export interface LintOptions {
  file?: string;
  byteLength?: number;
  maxWarnings?: number | null;
}

interface Cell {
  header: string;
  value: string;
}

interface MarketCell {
  market: "included" | "price" | "compareAt";
  name: string;
  header: string;
  value: string;
}

interface DataRow {
  row: number;
  fields: Partial<Record<FieldId, Cell>>;
  markets: MarketCell[];
}

interface PendingOption {
  row: number;
  column: string | null;
  value: string;
  label: string;
}

interface ProductState {
  handle: string;
  firstRow: number;
  rowCount: number;
  anyTitle: boolean;
  anyHandle: boolean;
  firstCells: Partial<Record<FieldId, string>>;
  optionFirstName: string[];
  optionNamed: boolean[];
  pendingValue: Array<PendingOption | null>;
  seenOptions: Map<string, number>;
  variants: number;
  images: Set<string>;
}

type Add = (
  id: string,
  row: number | null,
  column: string | null,
  detail: string,
  severity?: Severity,
) => void;

const PLAIN_MONEY = /^(?:\d+(?:\.\d+)?|\.\d+)$/;
const HANDLE = /^[\p{L}\p{Nd}-]+$/u;
const NUMBER = /^-?\d+(\.\d+)?$/;
const LINKED = /^product\.metafields\.shopify\.\S+$/;
const CUSTOM_FULFILLMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY = /[A-Za-z$€£¥₹₩¢]/;
const KNOWN_FULFILLMENT = new Set([
  "manual",
  "shipwire",
  "webgistix",
  "amazon_marketplace_web",
  "gift_card",
]);
const TRACKERS = ["shopify", "shipwire", "amazon_marketplace_web"];

const CHOICES: Partial<Record<FieldId, readonly string[]>> = {
  published: ["true", "false"],
  status: ["active", "draft", "archived"],
  giftCard: ["true", "false"],
  chargeTax: ["true", "false"],
  requiresShipping: ["true", "false"],
  inventoryPolicy: ["deny", "continue"],
  weightUnit: ["g", "kg", "lb", "oz"],
  packedUnit: ["cm", "in"],
};

const CHOICE_ENTRIES = Object.entries(CHOICES) as Array<[FieldId, readonly string[]]>;

const CHOICE_LABEL: Partial<Record<FieldId, string>> = {
  published: "true or false",
  status: "active, draft, or archived",
  giftCard: "true or false",
  chargeTax: "true or false",
  requiresShipping: "true or false",
  inventoryPolicy: "deny or continue",
  weightUnit: "g, kg, lb, or oz",
  packedUnit: "cm or in",
};

const IMAGE_FIELDS: readonly FieldId[] = ["imageSrc", "imageAlt", "imagePosition", "variantImage"];
const BUSY_FIELDS: readonly FieldId[] = [
  "title",
  "description",
  "vendor",
  "tags",
  "type",
  "productCategory",
  "published",
  "status",
  "giftCard",
  "seoTitle",
  "seoDescription",
  "option1Name",
  "option1Value",
  "option2Name",
  "option2Value",
  "option3Name",
  "option3Value",
  "sku",
  "price",
  "compareAt",
  "cost",
  "weightGrams",
  "weightUnit",
  "inventoryTracker",
  "inventoryQty",
  "inventoryPolicy",
  "barcode",
  "barcodes",
  "fulfillment",
  "chargeTax",
  "requiresShipping",
];

export function lintCsv(input: string | Uint8Array, options: LintOptions = {}): Report {
  const file = options.file ?? "stdin.csv";
  const bytes =
    options.byteLength ??
    (typeof input === "string" ? Buffer.byteLength(input) : input.byteLength);
  const maxWarnings = options.maxWarnings ?? null;
  if (bytes > FILE_SIZE_LIMIT) return sizeReport(file, bytes, maxWarnings, true);
  if (typeof input !== "string") {
    const decoded = decodeUtf8(input);
    if (decoded === null) return utf8Report(file, bytes, maxWarnings);
    return lintText(decoded, file, bytes, maxWarnings);
  }
  return lintText(input, file, bytes, maxWarnings);
}

export async function lintFile(filePath: string, options: LintOptions = {}): Promise<Report> {
  const file = options.file ?? filePath;
  const maxWarnings = options.maxWarnings ?? null;
  const session = createSession(file, maxWarnings);
  const parser = createCsvParser({
    onRecord: (record) => session.push(record),
  });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const stream = createReadStream(filePath);
  let bytes = 0;
  let oversize = false;
  try {
    for await (const chunk of stream) {
      const buf = chunk as Uint8Array;
      bytes += buf.length;
      if (bytes > FILE_SIZE_LIMIT) {
        oversize = true;
        break;
      }
      parser.push(decoder.decode(buf, { stream: true }));
    }
    if (!oversize) parser.push(decoder.decode());
  } catch (error) {
    if (isUtf8Error(error)) return utf8Report(file, bytes, maxWarnings);
    throw error;
  } finally {
    stream.destroy();
  }
  if (oversize) {
    // A regular file reports its size. A pipe has no size, so it reports the bytes read.
    const info = await stat(filePath).catch(() => null);
    if (info?.isFile()) return sizeReport(file, info.size, maxWarnings, true);
    return sizeReport(file, bytes, maxWarnings, false);
  }
  const parsed = parser.finish();
  if (!parsed.ok) return quoteReport(file, bytes, maxWarnings, parsed);
  return session.finish(bytes);
}

function lintText(text: string, file: string, bytes: number, maxWarnings: number | null): Report {
  const session = createSession(file, maxWarnings);
  const parser = createCsvParser({
    onRecord: (record) => session.push(record),
  });
  parser.push(text);
  const parsed = parser.finish();
  if (!parsed.ok) return quoteReport(file, bytes, maxWarnings, parsed);
  return session.finish(bytes);
}

function createSession(file: string, maxWarnings: number | null): {
  push(record: CsvRecord): void;
  finish(bytes: number): Report;
} {
  const findings: Finding[] = [];
  const counts = new Map<string, number>();
  const omitted = new Map<string, number>();
  let errorCount = 0;
  let warningCount = 0;
  let plan: HeaderPlan | null = null;
  let headerLength = 0;
  let dataRows = 0;
  let products = 0;
  let multiRow = false;
  let current: ProductState | null = null;
  const seen = new Set<string>();
  const packedHeaderReported = { value: false };

  const add: Add = (id, row, column, detail, severity) => {
    const meta = ruleById(id);
    const used = severity ?? meta.severity;
    if (used === "error") errorCount += 1;
    else warningCount += 1;
    const seenCount = (counts.get(id) ?? 0) + 1;
    counts.set(id, seenCount);
    if (seenCount > MAX_FINDINGS_PER_RULE) {
      omitted.set(id, (omitted.get(id) ?? 0) + 1);
      return;
    }
    const where = row === null ? "File" : column ? `Row ${row}, column ${column}` : `Row ${row}`;
    findings.push({
      ruleId: meta.id,
      severity: used,
      row,
      column,
      message: escapeControls(`${where}: ${detail}`),
      citation: meta.citation,
    });
  };

  function push(record: CsvRecord): void {
    if (!plan) {
      plan = planHeaders(record.values);
      headerLength = record.values.length;
      bindHeader(plan, add);
      return;
    }
    if (record.values.length > headerLength) {
      const extra = record.values.slice(headerLength);
      if (extra.some((value) => value !== "")) {
        add(
          "SCL013",
          record.row,
          null,
          `this row has a non-empty cell past the header (${record.values.length} cells, ${headerLength} headers). The help pages do not say an extra cell is rejected.`,
        );
      }
    }
    const row = buildRow(record, plan);
    if (row === null) return;
    dataRows += 1;
    const handle = plan.fields.has("handle") ? cell(row, "handle") : "";
    if (plan.fields.has("handle") && handle !== "") {
      if (!current || current.handle !== handle) {
        flush();
        if (seen.has(handle)) {
          add(
            "SCL016",
            row.row,
            headerOf(row, "handle", plan),
            `URL handle ${shown(handle)} already appeared in an earlier product. Keep every row for a product together. If rows with the same URL handle are separated by other products, the later rows are not imported as variants.`,
          );
        }
        current = startProduct(handle, row.row);
        seen.add(handle);
      }
      absorb(current, row, plan, add, packedHeaderReported, current.rowCount === 0);
      return;
    }
    const startsNew = !current || cell(row, "title") !== "";
    if (startsNew) {
      flush();
      current = startProduct(handle, row.row);
    }
    absorb(current!, row, plan, add, packedHeaderReported, current!.rowCount === 0);
  }

  function flush(): void {
    if (!current || !plan) return;
    const state = current;
    current = null;
    if (state.rowCount > 1) multiRow = true;
    if (plan.fields.has("title") && state.anyHandle && !state.anyTitle) {
      add(
        "SCL017",
        state.firstRow,
        headerName(plan, "title"),
        `handle ${shown(state.handle)} has no Title. The importer ignores a line that has a handle and no product title.`,
      );
    }
    if (state.variants > MAX_VARIANTS) {
      add(
        "SCL021",
        state.firstRow,
        headerName(plan, "title"),
        `this product has ${state.variants} variants. The documented limit is ${MAX_VARIANTS}.`,
      );
    }
    if (state.images.size > MAX_IMAGES) {
      add(
        "SCL034",
        state.firstRow,
        headerName(plan, "imageSrc") ?? "Product image URL",
        `this product has ${state.images.size} distinct image URLs. The documented limit is ${MAX_IMAGES}.`,
      );
    }
    for (let index = 0; index < OPTION_SLOTS.length; index += 1) {
      const pending = state.pendingValue[index];
      if (!pending || state.optionNamed[index]) continue;
      add(
        "SCL023",
        pending.row,
        pending.column,
        `${pending.label} value is ${shown(pending.value)} and this product never sets ${pending.label} name. The help pages do not say the importer rejects this.`,
      );
    }
  }

  function startProduct(handle: string, row: number): ProductState {
    products += 1;
    return {
      handle,
      firstRow: row,
      rowCount: 0,
      anyTitle: false,
      anyHandle: false,
      firstCells: {},
      optionFirstName: ["", "", ""],
      optionNamed: [false, false, false],
      pendingValue: [null, null, null],
      seenOptions: new Map(),
      variants: 0,
      images: new Set(),
    };
  }

  return {
    push,
    finish(bytes: number): Report {
      flush();
      if (!plan) {
        add(
          "SCL014",
          null,
          null,
          "the file has no header row. The first record must be the product CSV column headers.",
        );
      } else if (!plan.fields.has("handle")) {
        if (multiRow) {
          add(
            "SCL002",
            1,
            "URL handle",
            "the URL handle column is missing. Variant rows and extra image rows have to repeat the product URL handle, and a new product with variants requires it.",
          );
        } else if (dataRows > 0) {
          add(
            "SCL003",
            1,
            "URL handle",
            "the URL handle column is missing. This matters when you overwrite or update. A new product with no variants can omit it, because the handle is created from Title. An update requires URL handle and Title.",
          );
        }
      }
      if (bytes > FILE_SIZE_DECIMAL && bytes <= FILE_SIZE_LIMIT) {
        add(
          "SCL011",
          null,
          null,
          `the file is ${bytes} bytes, between 15000000 and 15728640. The help pages say 15 MB and do not say decimal or binary, so this band is a warning and the file is still checked.`,
          "warning",
        );
      }
      const truncated = omitted.size === 0 ? null : Object.fromEntries([...omitted.entries()].sort());
      return assemble(
        file,
        bytes,
        dataRows,
        products,
        findings,
        maxWarnings,
        truncated,
        errorCount,
        warningCount,
      );
    },
  };
}

function bindHeader(plan: HeaderPlan, add: Add): void {
  for (const item of plan.findings) {
    add(item.ruleId, 1, item.header === "" ? null : item.header, item.detail);
  }
  if (!plan.fields.has("title")) {
    add(
      "SCL001",
      1,
      "Title",
      "the Title column is missing. Title is required for a new product and for an update.",
    );
  }
  const variantHeaders = VARIANT_COLUMN_FIELDS.filter((field) => plan.fields.has(field));
  if (variantHeaders.length > 0 && (!plan.fields.has("option1Name") || !plan.fields.has("option1Value"))) {
    const names = variantHeaders.map((field) => headerName(plan, field) ?? field);
    add(
      "SCL047",
      1,
      "Option1 name",
      `this file has ${names.join(", ")} without both Option1 name and Option1 value. This matters when you overwrite or update: a new default variant is created and existing variants are deleted.`,
    );
  }
}

function absorb(
  state: ProductState,
  row: DataRow,
  plan: HeaderPlan,
  add: Add,
  packedHeaderReported: { value: boolean },
  isFirst: boolean,
): void {
  state.rowCount += 1;
  if (cell(row, "title") !== "") state.anyTitle = true;
  if (cell(row, "handle") !== "") state.anyHandle = true;
  if (isFirst) {
    for (const field of PRODUCT_LEVEL_FIELDS) state.firstCells[field] = cell(row, field);
    for (let index = 0; index < OPTION_SLOTS.length; index += 1) {
      state.optionFirstName[index] = cell(row, OPTION_SLOTS[index]!.name);
    }
    if (plan.fields.has("status") && cell(row, "status").trim() === "") {
      add(
        "SCL044",
        row.row,
        headerOf(row, "status", plan),
        "Status is blank. When the Status column is present it needs a value on the product row (active, draft, or archived). Later variant rows in the sample file leave it blank.",
      );
    }
  } else {
    for (const field of PRODUCT_LEVEL_FIELDS) {
      const value = cell(row, field);
      const initial = state.firstCells[field] ?? "";
      if (value === "" || value === initial) continue;
      const name = headerOf(row, field, plan) ?? field;
      const detail =
        initial === ""
          ? `${name} is ${shown(value)} here and blank on the first row of this product. Put Title, Description, Vendor, and Tags on the first row and skip them on later rows.`
          : `${name} is ${shown(value)} here and ${shown(initial)} on the first row. Later rows are documented to skip this column, and the help page does not say which value the importer keeps.`;
      add("SCL018", row.row, headerOf(row, field, plan), detail);
    }
  }

  for (let index = 0; index < OPTION_SLOTS.length; index += 1) {
    const slot = OPTION_SLOTS[index]!;
    const name = cell(row, slot.name);
    const firstName = state.optionFirstName[index] ?? "";
    if (!isFirst && name !== "") {
      if (firstName === "") {
        add(
          "SCL020",
          row.row,
          headerOf(row, slot.name, plan),
          `${slot.label} name is ${shown(name)} here and blank on the first row. The sample product CSV puts each option name on the first row of the product only.`,
        );
      } else if (name !== firstName) {
        add(
          "SCL019",
          row.row,
          headerOf(row, slot.name, plan),
          `${slot.label} name is ${shown(name)} here and ${shown(firstName)} on the first row of this product. The sample product CSV keeps one option name, on the first row.`,
        );
      }
    }
    if (name !== "") state.optionNamed[index] = true;
    const value = cell(row, slot.value);
    if (value !== "" && !state.optionNamed[index] && !state.pendingValue[index]) {
      state.pendingValue[index] = {
        row: row.row,
        column: headerOf(row, slot.value, plan),
        value,
        label: slot.label,
      };
    }
    const linked = cell(row, slot.linked);
    if (linked !== "" && !LINKED.test(linked)) {
      add(
        "SCL050",
        row.row,
        headerOf(row, slot.linked, plan),
        `${shown(linked)} is not product.metafields.shopify.{taxonomy_attribute}.`,
      );
    }
  }

  const variant = isVariant(row, isFirst);
  if (variant) state.variants += 1;
  const imageSrc = cell(row, "imageSrc");
  const variantImage = cell(row, "variantImage");
  if (imageSrc !== "") state.images.add(imageSrc);
  if (variantImage !== "") state.images.add(variantImage);
  lintRow(row, plan, variant, add, packedHeaderReported);

  const optionValues = [
    cell(row, OPTION_SLOTS[0].value),
    cell(row, OPTION_SLOTS[1].value),
    cell(row, OPTION_SLOTS[2].value),
  ];
  if (optionValues[0] !== "" || optionValues[1] !== "" || optionValues[2] !== "") {
    const key = optionValues.join("\0");
    const previous = state.seenOptions.get(key);
    if (previous !== undefined) {
      add(
        "SCL022",
        row.row,
        headerOf(row, "option1Value", plan),
        `option values ${optionValues.filter(Boolean).map(shown).join(" / ")} are already used on row ${previous}. The importer reports "Validation failed: options are not unique".`,
      );
    } else {
      state.seenOptions.set(key, row.row);
    }
  }
}

function lintRow(
  row: DataRow,
  plan: HeaderPlan,
  variant: boolean,
  add: Add,
  packedHeaderReported: { value: boolean },
): void {
  const handle = cell(row, "handle");
  if (handle !== "" && !HANDLE.test(handle)) {
    if (/\s/u.test(handle)) {
      add(
        "SCL015",
        row.row,
        headerOf(row, "handle", plan),
        `${shown(handle)} contains a space. A valid URL handle can contain letters, dashes, and numbers, but it can't contain spaces.`,
      );
    } else {
      add(
        "SCL015",
        row.row,
        headerOf(row, "handle", plan),
        `${shown(handle)} has a character other than letters, dashes, and numbers. Documented valid handles use letters, dashes, and numbers.`,
        "warning",
      );
    }
  }

  if (variant && plan.fields.has("price") && cell(row, "price").trim() === "") {
    add(
      "SCL024",
      row.row,
      headerOf(row, "price", plan),
      'Price is blank. The current column table says the default is 0.00. The older troubleshooting page lists "Validation failed: price can\'t be blank".',
    );
  }

  const amounts = new Map<string, string>();
  for (const field of ["price", "compareAt", "cost"] as const) {
    const kind = moneyKind(cell(row, field));
    if (kind.kind === "empty") continue;
    if (kind.kind === "ok") {
      amounts.set(field, kind.value);
      continue;
    }
    add(
      "SCL025",
      row.row,
      headerOf(row, field, plan),
      kind.kind === "symbol"
        ? `${shown(cell(row, field))} includes a currency symbol or letters. Only include the monetary value, without a currency symbol.`
        : `${shown(cell(row, field))} is not a plain number such as 9.99 or .99. Only a currency symbol or letters are documented as invalid, so this shape is a warning.`,
      kind.kind === "symbol" ? "error" : "warning",
    );
  }
  const price = amounts.get("price");
  const compare = amounts.get("compareAt");
  if (price !== undefined && compare !== undefined && cmpMoney(compare, price) <= 0) {
    add(
      "SCL026",
      row.row,
      headerOf(row, "compareAt", plan),
      `compare-at price ${compare} is not higher than price ${price}. The compare-at price has to be higher than the price to display a sale.`,
    );
  }

  for (const [field, allowed] of CHOICE_ENTRIES) {
    const raw = cell(row, field);
    const value = raw.trim();
    if (value === "") continue;
    if (allowed.includes(value.toLowerCase())) continue;
    add(
      "SCL027",
      row.row,
      headerOf(row, field, plan),
      `${shown(raw)} is not one of: ${CHOICE_LABEL[field]}. Values are matched without case sensitivity because the sample CSV uses TRUE, FALSE, DENY, CONTINUE, and Active, while the column table shows those words in lowercase. Surrounding spaces are ignored.`,
    );
  }

  const tracker = cell(row, "inventoryTracker").trim();
  if (tracker !== "" && !TRACKERS.includes(tracker.toLowerCase())) {
    add(
      "SCL027",
      row.row,
      headerOf(row, "inventoryTracker", plan),
      `${shown(cell(row, "inventoryTracker"))} is not one of the listed inventory trackers (shopify, shipwire, amazon_marketplace_web, or blank). The column says "valid values include", so this is a warning.`,
      "warning",
    );
  }

  if (cell(row, "giftCard").trim().toLowerCase() === "true") {
    add(
      "SCL045",
      row.row,
      headerOf(row, "giftCard", plan),
      "Gift card is true. A gift card cannot be created by importing a product CSV. It has to be created in the admin.",
    );
  }

  for (const field of ["imageSrc", "variantImage"] as const) {
    const value = cell(row, field);
    if (value === "") continue;
    const url = httpUrl(value);
    if (!url) {
      add(
        "SCL028",
        row.row,
        headerOf(row, field, plan),
        `${shown(value)} is not an absolute http:// or https:// URL. The importer requires http:// in front of an image URL, and product images are documented as publicly reachable https:// URLs.`,
      );
      continue;
    }
    const suffix = imageSuffix(url);
    if (suffix) {
      add(
        "SCL037",
        row.row,
        headerOf(row, field, plan),
        `the image file name ends with ${suffix}. The product image file name must not include _thumb, _small, or _medium.`,
      );
    }
  }

  const position = cell(row, "imagePosition");
  if (position.trim() !== "" && !validPosition(position)) {
    add(
      "SCL048",
      row.row,
      headerOf(row, "imagePosition", plan),
      `${shown(position)} is not an image position. Enter an integer starting at 1.`,
    );
  }

  const alt = cell(row, "imageAlt");
  const altLength = chars(alt);
  if (altLength > MAX_ALT) {
    add(
      "SCL035",
      row.row,
      headerOf(row, "imageAlt", plan),
      `image alt text is ${altLength} characters. The maximum length is ${MAX_ALT}.`,
    );
  } else if (altLength > OPTIMAL_ALT) {
    add(
      "SCL036",
      row.row,
      headerOf(row, "imageAlt", plan),
      `image alt text is ${altLength} characters. The maximum is ${MAX_ALT} and the documented optimal length is ${OPTIMAL_ALT} or fewer.`,
    );
  }

  const seoTitle = cell(row, "seoTitle");
  if (chars(seoTitle) > MAX_SEO_TITLE) {
    add(
      "SCL029",
      row.row,
      headerOf(row, "seoTitle", plan),
      `SEO title is ${chars(seoTitle)} characters. The documented limit is ${MAX_SEO_TITLE}.`,
    );
  }
  const seoDescription = cell(row, "seoDescription");
  if (chars(seoDescription) > MAX_SEO_DESCRIPTION) {
    add(
      "SCL030",
      row.row,
      headerOf(row, "seoDescription", plan),
      `SEO description is ${chars(seoDescription)} characters. The documented limit is ${MAX_SEO_DESCRIPTION}.`,
    );
  }

  const tags = cell(row, "tags");
  if (tags !== "") {
    const parts = tags.split(",").map((part) => part.trim()).filter((part) => part !== "");
    if (parts.length > MAX_TAGS) {
      add(
        "SCL031",
        row.row,
        headerOf(row, "tags", plan),
        `this cell has ${parts.length} tags. The maximum is ${MAX_TAGS} tags for a product.`,
      );
    }
    for (const tag of parts) {
      const issue = tagIssue(tag);
      if (!issue) continue;
      add(
        "SCL032",
        row.row,
        headerOf(row, "tags", plan),
        `tag ${shown(tag)} contains ${issue}. Tags should use letters, numbers, and hyphens, and should avoid accented characters and symbols.`,
      );
      break;
    }
  }

  for (const field of ["barcode", "barcodes"] as const) {
    const value = cell(row, field);
    if (value === "") continue;
    const codes = splitBarcodes(value);
    if (codes.length > MAX_BARCODES) {
      add(
        "SCL033",
        row.row,
        headerOf(row, field, plan),
        `this cell has ${codes.length} barcodes. The maximum is ${MAX_BARCODES}. Separate barcodes with a semicolon.`,
      );
    }
  }

  const weightRaw = cell(row, "weightGrams");
  if (weightRaw !== "") {
    const weight = weightRaw.trim();
    if (!PLAIN_MONEY.test(weight)) {
      add(
        "SCL038",
        row.row,
        headerOf(row, "weightGrams", plan),
        `${shown(weightRaw)} is not only a number of grams. You should specify only the numerical value, without the unit of measurement or decimals.`,
      );
    } else if (weight.includes(".")) {
      add(
        "SCL038",
        row.row,
        headerOf(row, "weightGrams", plan),
        `${shown(weightRaw)} includes a decimal. You should specify only the numerical value, without the unit of measurement or decimals.`,
      );
    }
  }

  const quantity = cell(row, "inventoryQty");
  if (tracker !== "" && quantity.trim() === "") {
    add(
      "SCL040",
      row.row,
      headerOf(row, "inventoryQty", plan),
      `inventory quantity is blank while inventory tracker is ${shown(tracker)}. The current column table says the default is 0. The older troubleshooting page says inventory quantity can't be blank.`,
    );
  } else if (quantity.trim() !== "" && !NUMBER.test(quantity.trim())) {
    add(
      "SCL039",
      row.row,
      headerOf(row, "inventoryQty", plan),
      `${shown(quantity)} is not a number. The importer reports "Inventory quantity is not a number".`,
    );
  }

  const fulfillment = cell(row, "fulfillment").trim();
  if (fulfillment !== "" && !knownFulfillment(fulfillment) && !CUSTOM_FULFILLMENT.test(fulfillment)) {
    add(
      "SCL041",
      row.row,
      headerOf(row, "fulfillment", plan),
      `${shown(fulfillment)} is not manual, shipwire, webgistix, amazon_marketplace_web, or gift_card, and it is not a custom handle of lowercase letters, numbers, and dashes. The page gives that handle shape as guidance and does not say the importer rejects another value, so this is a warning.`,
    );
  }
  if (fulfillment !== "" && !knownFulfillment(fulfillment) && cell(row, "sku") === "") {
    add(
      "SCL042",
      row.row,
      headerOf(row, "sku", plan),
      `SKU is blank and fulfillment service is ${shown(fulfillment)}. The SKU column can't be blank for a custom fulfillment service.`,
    );
  }

  const presentPacked = PACKED_FIELDS.filter((field) => plan.fields.has(field));
  if (presentPacked.length === PACKED_FIELDS.length) {
    const filled = PACKED_FIELDS.filter((field) => cell(row, field) !== "");
    const shipping = cell(row, "requiresShipping").trim().toLowerCase();
    if (filled.length > 0 && filled.length < PACKED_FIELDS.length && shipping !== "false") {
      add(
        "SCL043",
        row.row,
        headerOf(row, filled[0]!, plan),
        "packed product length, width, height, and unit must all be filled or all be blank. A partial row is an import error unless Requires shipping is false.",
      );
    }
  } else if (presentPacked.length > 0 && !packedHeaderReported.value) {
    const filled = presentPacked.filter((field) => cell(row, field) !== "");
    const shipping = cell(row, "requiresShipping").trim().toLowerCase();
    if (filled.length > 0 && shipping !== "false") {
      packedHeaderReported.value = true;
      add(
        "SCL043",
        row.row,
        headerOf(row, filled[0]!, plan),
        "packed product columns are only partly included, and this row has a packed value while Requires shipping is not false. A file with values in only some of the four columns results in an import error.",
      );
    }
  }

  const collection = cell(row, "collection");
  if (chars(collection) > MAX_COLLECTION) {
    add(
      "SCL046",
      row.row,
      headerOf(row, "collection", plan),
      `Collection is ${chars(collection)} characters. The maximum length is ${MAX_COLLECTION}.`,
    );
  }

  const priceByName = new Map<string, string>();
  for (const market of row.markets) {
    if (market.market === "price") priceByName.set(market.name, market.value);
  }
  for (const market of row.markets) {
    if ((market.market === "price" || market.market === "compareAt") && market.value !== "") {
      const kind = moneyKind(market.value);
      if (kind.kind === "symbol" || kind.kind === "other") {
        add(
          "SCL025",
          row.row,
          market.header,
          kind.kind === "symbol"
            ? `${shown(market.value)} includes a currency symbol or letters. Only include the monetary value, without a currency symbol.`
            : `${shown(market.value)} is not a plain number such as 9.99 or .99. Only a currency symbol or letters are documented as invalid, so this shape is a warning.`,
          kind.kind === "symbol" ? "error" : "warning",
        );
      }
    }
    if (market.market === "included" && market.value.trim() !== "" && !["true", "false"].includes(market.value.trim().toLowerCase())) {
      add(
        "SCL027",
        row.row,
        market.header,
        `${shown(market.value)} is not true or false. The page gives Included a default of true and does not list allowed words, so this is a warning.`,
        "warning",
      );
    }
  }
  for (const compareAt of row.markets) {
    if (compareAt.market !== "compareAt" || compareAt.value.trim() === "") continue;
    const marketPrice = priceByName.get(compareAt.name) ?? "";
    if (marketPrice.trim() === "") {
      add(
        "SCL049",
        row.row,
        compareAt.header,
        `compare-at price for ${compareAt.name} is set and the fixed price for that market is blank. A fixed price is required to use a fixed compare-at price.`,
      );
    }
  }
}

interface PlanIndex {
  /** Column bound to each cell position. The first column bound to a field wins, even when it is blank. */
  byIndex: Array<BoundColumn | undefined>;
  /** Header text of the first column bound to each field. */
  headerByField: Map<FieldId, string>;
}

const planIndexCache = new WeakMap<HeaderPlan, PlanIndex>();

/**
 * Built once per file so that the cost of a row follows its cell count, not the
 * header width: a one-cell row under a very wide header must stay cheap.
 */
function indexOf(plan: HeaderPlan): PlanIndex {
  let index = planIndexCache.get(plan);
  if (index) return index;
  const byIndex: Array<BoundColumn | undefined> = [];
  const headerByField = new Map<FieldId, string>();
  for (const column of plan.columns) {
    if (column.kind === "field") {
      if (headerByField.has(column.field)) continue;
      headerByField.set(column.field, column.header);
      byIndex[column.index] = column;
    } else if (column.kind === "market") {
      byIndex[column.index] = column;
    }
  }
  index = { byIndex, headerByField };
  planIndexCache.set(plan, index);
  return index;
}

/**
 * Keeps only non-empty cells in mapped columns, so a missing entry means a blank
 * cell. Returns null when no mapped column has a value, which is how a blank row
 * and a row of only unmapped columns are skipped.
 */
function buildRow(record: CsvRecord, plan: HeaderPlan): DataRow | null {
  const fields: DataRow["fields"] = {};
  const markets: MarketCell[] = [];
  const { byIndex } = indexOf(plan);
  const values = record.values;
  const limit = Math.min(values.length, byIndex.length);
  let filled = false;
  for (let position = 0; position < limit; position += 1) {
    const value = values[position]!;
    if (value === "") continue;
    const column = byIndex[position];
    if (!column) continue;
    filled = true;
    if (column.kind === "field") {
      fields[column.field] = { header: column.header, value };
    } else if (column.kind === "market") {
      markets.push({ market: column.market, name: column.name, header: column.header, value });
    }
  }
  return filled ? { row: record.row, fields, markets } : null;
}

function isImageOnly(row: DataRow): boolean {
  const hasImage = IMAGE_FIELDS.some((field) => cell(row, field) !== "");
  if (!hasImage) return false;
  return BUSY_FIELDS.every((field) => cell(row, field) === "");
}

function isVariant(row: DataRow, isFirst: boolean): boolean {
  if (isImageOnly(row)) return false;
  const markers: FieldId[] = [
    "option1Value",
    "option2Value",
    "option3Value",
    "sku",
    "price",
    "compareAt",
    "cost",
    "weightGrams",
    "inventoryQty",
    "barcode",
    "barcodes",
  ];
  if (markers.some((field) => cell(row, field) !== "")) return true;
  return isFirst && cell(row, "title") !== "";
}

function cell(row: DataRow, field: FieldId): string {
  return row.fields[field]?.value ?? "";
}

function headerOf(row: DataRow, field: FieldId, plan: HeaderPlan): string | null {
  return row.fields[field]?.header ?? headerName(plan, field);
}

function headerName(plan: HeaderPlan, field: FieldId): string | null {
  return indexOf(plan).headerByField.get(field) ?? null;
}

function knownFulfillment(value: string): boolean {
  return KNOWN_FULFILLMENT.has(value.toLowerCase());
}

function moneyKind(raw: string): { kind: "empty" | "ok" | "symbol" | "other"; value: string } {
  const value = raw.trim();
  if (value === "") return { kind: "empty", value };
  if (PLAIN_MONEY.test(value)) return { kind: "ok", value };
  if (CURRENCY.test(value)) return { kind: "symbol", value };
  return { kind: "other", value };
}

function validPosition(raw: string): boolean {
  const value = raw.trim();
  if (!/^[0-9]+$/.test(value)) return false;
  try {
    return BigInt(value) >= 1n;
  } catch {
    return false;
  }
}

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

function imageSuffix(url: URL): string | null {
  const raw = url.pathname.split("/").pop() ?? "";
  let base = raw;
  try {
    base = decodeURIComponent(raw);
  } catch {
    base = raw;
  }
  const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  for (const suffix of ["_thumb", "_small", "_medium"]) {
    if (stem.endsWith(suffix)) return suffix;
  }
  return null;
}

function tagIssue(tag: string): string | null {
  if (/[^\p{L}\p{M}\p{N} -]/u.test(tag)) return "a symbol";
  if (/\p{Script=Latin}\p{M}/u.test(tag) || /[\u00C0-\u024F]/.test(tag)) return "an accented character";
  return null;
}

function splitBarcodes(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index]!;
    if (ch === "\\" && index + 1 < value.length) {
      current += value[index + 1];
      index += 1;
      continue;
    }
    if (ch === ";") {
      if (current.trim() !== "") parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

function chars(value: string): number {
  return Array.from(value).length;
}

function cmpMoney(left: string, right: string): number {
  const norm = (value: string): string => (value.startsWith(".") ? `0${value}` : value);
  const [leftWhole, leftFrac = ""] = norm(left).split(".");
  const [rightWhole, rightFrac = ""] = norm(right).split(".");
  const scale = Math.max(leftFrac.length, rightFrac.length);
  const factor = 10n ** BigInt(scale);
  const leftValue = BigInt(leftWhole!) * factor + BigInt(leftFrac.padEnd(scale, "0") || "0");
  const rightValue = BigInt(rightWhole!) * factor + BigInt(rightFrac.padEnd(scale, "0") || "0");
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function shown(value: string): string {
  const text = value.length > 60 ? `${value.slice(0, 57)}...` : value;
  return JSON.stringify(text);
}

function isUtf8Error(error: unknown): boolean {
  return error instanceof TypeError && /utf-8|UTF-8|encoded data/i.test(error.message);
}

function sizeReport(file: string, bytes: number, maxWarnings: number | null, exact: boolean): Report {
  const size = exact
    ? `the file is ${bytes} bytes, above 15728640 (15 MiB)`
    : `the input is more than 15728640 bytes (15 MiB); reading stopped after ${bytes} bytes`;
  return single(
    file,
    bytes,
    maxWarnings,
    "SCL011",
    null,
    null,
    `${size}. The help pages say a product CSV can't exceed 15 MB and do not say decimal or binary. This check errors only above 15728640 bytes.`,
  );
}

function utf8Report(file: string, bytes: number, maxWarnings: number | null): Report {
  return single(
    file,
    bytes,
    maxWarnings,
    "SCL010",
    null,
    null,
    "the file is not valid UTF-8. Product CSV files have to be UTF-8 or the importer inserts unexpected characters and can report illegal quoting.",
  );
}

function quoteReport(
  file: string,
  bytes: number,
  maxWarnings: number | null,
  parsed: CsvParseFailure,
): Report {
  const meta = ruleById("SCL012");
  return assemble(
    file,
    bytes,
    0,
    0,
    [
      {
        ruleId: meta.id,
        severity: meta.severity,
        row: parsed.row,
        column: null,
        message: escapeControls(`Line ${parsed.line}: ${parsed.message}`),
        citation: meta.citation,
      },
    ],
    maxWarnings,
    null,
    1,
    0,
  );
}

function single(
  file: string,
  bytes: number,
  maxWarnings: number | null,
  id: string,
  row: number | null,
  column: string | null,
  detail: string,
): Report {
  const meta = ruleById(id);
  const where = row === null ? "File" : column ? `Row ${row}, column ${column}` : `Row ${row}`;
  const severity = meta.severity;
  return assemble(
    file,
    bytes,
    0,
    0,
    [
      {
        ruleId: meta.id,
        severity,
        row,
        column,
        message: escapeControls(`${where}: ${detail}`),
        citation: meta.citation,
      },
    ],
    maxWarnings,
    null,
    severity === "error" ? 1 : 0,
    severity === "warning" ? 1 : 0,
  );
}

function assemble(
  file: string,
  bytes: number,
  dataRows: number,
  products: number,
  findings: Finding[],
  maxWarnings: number | null,
  truncated: Record<string, number> | null,
  errorCount: number,
  warningCount: number,
): Report {
  findings.sort((left, right) => {
    const leftRow = left.row ?? -1;
    const rightRow = right.row ?? -1;
    if (leftRow !== rightRow) return leftRow - rightRow;
    const leftColumn = left.column ?? "";
    const rightColumn = right.column ?? "";
    if (leftColumn !== rightColumn) return leftColumn < rightColumn ? -1 : 1;
    if (left.ruleId !== right.ruleId) return left.ruleId < right.ruleId ? -1 : 1;
    return left.message < right.message ? -1 : left.message > right.message ? 1 : 0;
  });
  const ok = errorCount === 0 && (maxWarnings === null || warningCount <= maxWarnings);
  return {
    schemaVersion: 1,
    file,
    bytes,
    dataRows,
    products,
    errorCount,
    warningCount,
    maxWarnings,
    ok,
    truncated,
    findings,
  };
}

export { FILE_SIZE_LIMIT, FILE_SIZE_DECIMAL };
