export type FieldId =
  | "title"
  | "handle"
  | "description"
  | "vendor"
  | "productCategory"
  | "type"
  | "tags"
  | "published"
  | "status"
  | "sku"
  | "barcode"
  | "barcodes"
  | "option1Name"
  | "option1Value"
  | "option1Linked"
  | "option2Name"
  | "option2Value"
  | "option2Linked"
  | "option3Name"
  | "option3Value"
  | "option3Linked"
  | "price"
  | "compareAt"
  | "cost"
  | "chargeTax"
  | "inventoryTracker"
  | "inventoryQty"
  | "inventoryPolicy"
  | "weightGrams"
  | "weightUnit"
  | "packedLength"
  | "packedWidth"
  | "packedHeight"
  | "packedUnit"
  | "requiresShipping"
  | "fulfillment"
  | "imageSrc"
  | "imagePosition"
  | "imageAlt"
  | "variantImage"
  | "giftCard"
  | "seoTitle"
  | "seoDescription"
  | "collection"
  | "taxCode"
  | "unitPriceTotal"
  | "unitPriceTotalUnit"
  | "unitPriceBase"
  | "unitPriceBaseUnit";

export interface HeaderAlias {
  header: string;
  field: FieldId;
  generation: "current" | "legacy";
}

/**
 * Current names are the column table on the product CSV help page, plus
 * headers in the sample file that page links to. The sample fetched on
 * 2026-10-27 uses `Variant Barcodes` where the table says `Barcodes`.
 * Legacy names are the header line on the common import-issues page and the
 * 2022-01-26 sample (`Standard Product Type`, `Custom Product Type`).
 * `Standardized Product Type` is that same product-category column. The
 * product CSV page says older column names stay backward compatible.
 * Header text is bound without regard to case, so a case difference adds no
 * further findings. It is reported once as the SCL005 warning: the
 * import-products page says header names are case-sensitive, and the
 * common-import-issues page describes a mapping dialog. The table and the
 * sample also spell some headers differently (`Option1 LinkedTo` and
 * `Option1 Linked To`), which is why this is a warning.
 */
export const HEADER_ALIASES: HeaderAlias[] = [
  { header: "Title", field: "title", generation: "current" },
  { header: "URL handle", field: "handle", generation: "current" },
  { header: "Handle", field: "handle", generation: "legacy" },
  { header: "Description", field: "description", generation: "current" },
  { header: "Body (HTML)", field: "description", generation: "legacy" },
  { header: "Vendor", field: "vendor", generation: "current" },
  { header: "Product category", field: "productCategory", generation: "current" },
  { header: "Product Category", field: "productCategory", generation: "legacy" },
  { header: "Standard Product Type", field: "productCategory", generation: "legacy" },
  { header: "Standardized Product Type", field: "productCategory", generation: "legacy" },
  { header: "Type", field: "type", generation: "current" },
  { header: "Custom Product Type", field: "type", generation: "legacy" },
  { header: "Tags", field: "tags", generation: "current" },
  { header: "Published on online store", field: "published", generation: "current" },
  { header: "Published", field: "published", generation: "legacy" },
  { header: "Status", field: "status", generation: "current" },
  { header: "SKU", field: "sku", generation: "current" },
  { header: "Variant SKU", field: "sku", generation: "legacy" },
  { header: "Barcode", field: "barcode", generation: "current" },
  { header: "Variant Barcode", field: "barcode", generation: "legacy" },
  { header: "Barcodes", field: "barcodes", generation: "current" },
  { header: "Variant Barcodes", field: "barcodes", generation: "current" },
  { header: "Option1 name", field: "option1Name", generation: "current" },
  { header: "Option1 Name", field: "option1Name", generation: "legacy" },
  { header: "Option1 value", field: "option1Value", generation: "current" },
  { header: "Option1 Value", field: "option1Value", generation: "legacy" },
  { header: "Option1 LinkedTo", field: "option1Linked", generation: "current" },
  { header: "Option1 Linked To", field: "option1Linked", generation: "current" },
  { header: "Option2 name", field: "option2Name", generation: "current" },
  { header: "Option2 Name", field: "option2Name", generation: "legacy" },
  { header: "Option2 value", field: "option2Value", generation: "current" },
  { header: "Option2 Value", field: "option2Value", generation: "legacy" },
  { header: "Option2 LinkedTo", field: "option2Linked", generation: "current" },
  { header: "Option2 Linked To", field: "option2Linked", generation: "current" },
  { header: "Option3 name", field: "option3Name", generation: "current" },
  { header: "Option3 Name", field: "option3Name", generation: "legacy" },
  { header: "Option3 value", field: "option3Value", generation: "current" },
  { header: "Option3 Value", field: "option3Value", generation: "legacy" },
  { header: "Option3 LinkedTo", field: "option3Linked", generation: "current" },
  { header: "Option3 Linked To", field: "option3Linked", generation: "current" },
  { header: "Price", field: "price", generation: "current" },
  { header: "Variant Price", field: "price", generation: "legacy" },
  { header: "Compare-at price", field: "compareAt", generation: "current" },
  { header: "Variant Compare-at Price", field: "compareAt", generation: "legacy" },
  { header: "Variant Compare At Price", field: "compareAt", generation: "legacy" },
  { header: "Cost per item", field: "cost", generation: "current" },
  { header: "Charge tax", field: "chargeTax", generation: "current" },
  { header: "Variant Taxable", field: "chargeTax", generation: "legacy" },
  { header: "Inventory tracker", field: "inventoryTracker", generation: "current" },
  { header: "Variant Inventory Tracker", field: "inventoryTracker", generation: "legacy" },
  { header: "Inventory quantity", field: "inventoryQty", generation: "current" },
  { header: "Variant Inventory Qty", field: "inventoryQty", generation: "legacy" },
  { header: "Continue selling when out of stock", field: "inventoryPolicy", generation: "current" },
  { header: "Variant Inventory Policy", field: "inventoryPolicy", generation: "legacy" },
  { header: "Weight value (grams)", field: "weightGrams", generation: "current" },
  { header: "Variant Grams", field: "weightGrams", generation: "legacy" },
  { header: "Weight unit for display", field: "weightUnit", generation: "current" },
  { header: "Variant Weight Unit", field: "weightUnit", generation: "legacy" },
  { header: "Packed product length", field: "packedLength", generation: "current" },
  { header: "Packed product width", field: "packedWidth", generation: "current" },
  { header: "Packed product height", field: "packedHeight", generation: "current" },
  { header: "Packed product dimension unit", field: "packedUnit", generation: "current" },
  { header: "Requires shipping", field: "requiresShipping", generation: "current" },
  { header: "Variant Requires Shipping", field: "requiresShipping", generation: "legacy" },
  { header: "Fulfillment service", field: "fulfillment", generation: "current" },
  { header: "Variant Fulfillment Service", field: "fulfillment", generation: "legacy" },
  { header: "Product image URL", field: "imageSrc", generation: "current" },
  { header: "Image Src", field: "imageSrc", generation: "legacy" },
  { header: "Image position", field: "imagePosition", generation: "current" },
  { header: "Image Position", field: "imagePosition", generation: "legacy" },
  { header: "Image alt text", field: "imageAlt", generation: "current" },
  { header: "Image Alt Text", field: "imageAlt", generation: "legacy" },
  { header: "Variant image URL", field: "variantImage", generation: "current" },
  { header: "Variant Image", field: "variantImage", generation: "legacy" },
  { header: "Gift card", field: "giftCard", generation: "current" },
  { header: "Gift Card", field: "giftCard", generation: "legacy" },
  { header: "SEO title", field: "seoTitle", generation: "current" },
  { header: "SEO Title", field: "seoTitle", generation: "legacy" },
  { header: "SEO description", field: "seoDescription", generation: "current" },
  { header: "SEO Description", field: "seoDescription", generation: "legacy" },
  { header: "Collection", field: "collection", generation: "current" },
  { header: "Tax code", field: "taxCode", generation: "current" },
  { header: "Variant Tax Code", field: "taxCode", generation: "legacy" },
  { header: "Unit price total measure", field: "unitPriceTotal", generation: "current" },
  { header: "Unit price total measure unit", field: "unitPriceTotalUnit", generation: "current" },
  { header: "Unit price base measure", field: "unitPriceBase", generation: "current" },
  { header: "Unit price base measure unit", field: "unitPriceBaseUnit", generation: "current" },
];

const EXACT = new Map<string, HeaderAlias[]>();
const BY_LOWER = new Map<string, HeaderAlias[]>();

for (const alias of HEADER_ALIASES) {
  const exact = EXACT.get(alias.header) ?? [];
  exact.push(alias);
  EXACT.set(alias.header, exact);
  const key = alias.header.toLowerCase();
  const lower = BY_LOWER.get(key) ?? [];
  lower.push(alias);
  BY_LOWER.set(key, lower);
}

export interface FieldColumn {
  kind: "field";
  index: number;
  header: string;
  field: FieldId;
}

export interface MarketColumn {
  kind: "market";
  index: number;
  header: string;
  market: "included" | "price" | "compareAt";
  name: string;
}

export interface LooseColumn {
  kind: "google" | "metafield";
  index: number;
  header: string;
}

export type BoundColumn = FieldColumn | MarketColumn | LooseColumn;

export interface HeaderFinding {
  ruleId: "SCL004" | "SCL005" | "SCL006" | "SCL007" | "SCL008" | "SCL009";
  header: string;
  detail: string;
}

export interface HeaderPlan {
  columns: BoundColumn[];
  findings: HeaderFinding[];
  fields: Set<FieldId>;
}

function prefer(matches: HeaderAlias[]): HeaderAlias {
  return matches.find((item) => item.generation === "current") ?? matches[0]!;
}

export interface HeaderMatch {
  field: FieldId;
  /** Spelling planHeaders treats as the documented name for this header. */
  documented: string;
  /** True when the trimmed header is already a documented spelling. */
  exact: boolean;
}

/**
 * The column a header binds to, using the same aliases as planHeaders.
 * Returns null when the name is blank, unknown, or matches more than one field.
 */
export function matchHeader(raw: string): HeaderMatch | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const exact = EXACT.get(trimmed);
  if (exact && exact.length > 0) {
    const fields = new Set(exact.map((item) => item.field));
    if (fields.size !== 1) return null;
    const alias = prefer(exact);
    return { field: alias.field, documented: alias.header, exact: true };
  }
  const lower = BY_LOWER.get(trimmed.toLowerCase());
  if (!lower || lower.length === 0) return null;
  const fields = new Set(lower.map((item) => item.field));
  if (fields.size !== 1) return null;
  const alias = prefer(lower);
  return { field: alias.field, documented: alias.header, exact: alias.header === trimmed };
}

function bindField(index: number, header: string, field: FieldId): FieldColumn {
  return { kind: "field", index, header, field };
}

export function planHeaders(headers: string[]): HeaderPlan {
  const columns: BoundColumn[] = [];
  const findings: HeaderFinding[] = [];
  const fields = new Set<FieldId>();
  const seenField = new Map<FieldId, string>();
  const seenHeader = new Map<string, string>();

  headers.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (index === headers.length - 1 && raw !== raw.trimEnd() && trimmed !== "") {
      findings.push({
        ruleId: "SCL007",
        header: raw,
        detail: `the header line ends with extra whitespace in ${JSON.stringify(raw)}. Check for extra white spaces at the end of the first line.`,
      });
    }
    if (trimmed === "") {
      findings.push({
        ruleId: "SCL004",
        header: raw,
        detail: "a header cell is blank. The column table lists the columns you can use, and incorrect headers open a mapping dialog, so a blank header is a warning.",
      });
      return;
    }

    const owned = seenHeader.get(trimmed);
    if (owned) {
      findings.push({
        ruleId: "SCL006",
        header: raw,
        detail: `two headers map to the same column (${JSON.stringify(trimmed)} is repeated). The help pages do not say which one wins.`,
      });
    } else {
      seenHeader.set(trimmed, raw);
    }

    const exact = EXACT.get(trimmed);
    if (exact) {
      const alias = prefer(exact);
      rememberField(alias.field, trimmed, findings, seenField);
      columns.push(bindField(index, raw, alias.field));
      fields.add(alias.field);
      return;
    }

    const lower = BY_LOWER.get(trimmed.toLowerCase());
    if (lower && lower.length > 0) {
      const alias = prefer(lower);
      findings.push({
        ruleId: "SCL005",
        header: raw,
        detail: `header ${JSON.stringify(trimmed)} differs in case from the documented ${JSON.stringify(alias.header)}. The import-products page says column header names are case-sensitive. The header is still checked as that column, and this is a warning because the column table and the sample spell some headers differently.`,
      });
      rememberField(alias.field, trimmed, findings, seenField);
      columns.push(bindField(index, raw, alias.field));
      fields.add(alias.field);
      return;
    }

    const option = /^Option(\d+)\s+(name|value|linkedto|linked to)$/i.exec(trimmed);
    if (option) {
      const n = Number(option[1]);
      if (n > 3) {
        findings.push({
          ruleId: "SCL009",
          header: raw,
          detail: `header ${JSON.stringify(trimmed)} is a fourth or later option. A product can have up to 3 options.`,
        });
        return;
      }
    }

    const included = /^Included \/ (.+)$/.exec(trimmed);
    if (included) {
      columns.push({
        kind: "market",
        index,
        header: raw,
        market: "included",
        name: included[1]!,
      });
      return;
    }
    const marketPrice = /^Price \/ (.+)$/.exec(trimmed);
    if (marketPrice) {
      columns.push({
        kind: "market",
        index,
        header: raw,
        market: "price",
        name: marketPrice[1]!,
      });
      return;
    }
    const marketCompare = /^(?:Compare-at price|Compare At Price) \/ (.+)$/.exec(trimmed);
    if (marketCompare) {
      columns.push({
        kind: "market",
        index,
        header: raw,
        market: "compareAt",
        name: marketCompare[1]!,
      });
      return;
    }
    if (/^Google Shopping \/ .+/.test(trimmed)) {
      columns.push({ kind: "google", index, header: raw });
      return;
    }
    if (trimmed.includes("product.metafields.")) {
      columns.push({ kind: "metafield", index, header: raw });
      return;
    }

    findings.push({
      ruleId: "SCL004",
      header: raw,
      detail: `header ${JSON.stringify(trimmed)} is not a documented product CSV column. The page says you can't add any other columns. Incorrect headers open a mapping dialog, so this is a warning.`,
    });
  });

  if (fields.has("barcode") && fields.has("barcodes")) {
    findings.push({
      ruleId: "SCL008",
      header: "Barcodes",
      detail: "the file has both a Barcode column and a Barcodes column. A file that has both columns fails to import.",
    });
  }

  return { columns, findings, fields };
}

function rememberField(
  field: FieldId,
  header: string,
  findings: HeaderFinding[],
  seenField: Map<FieldId, string>,
): void {
  const previous = seenField.get(field);
  if (previous && previous !== header) {
    findings.push({
      ruleId: "SCL006",
      header,
      detail: `two headers map to the same column (${JSON.stringify(previous)} and ${JSON.stringify(header)}). The help pages do not say which one wins.`,
    });
  }
  if (!previous) seenField.set(field, header);
}

export const VARIANT_COLUMN_FIELDS: readonly FieldId[] = [
  "sku",
  "weightGrams",
  "price",
  "compareAt",
  "cost",
  "inventoryTracker",
  "inventoryQty",
  "inventoryPolicy",
  "barcode",
  "barcodes",
  "variantImage",
  "fulfillment",
  "chargeTax",
  "requiresShipping",
  "weightUnit",
];

export const PRODUCT_LEVEL_FIELDS: readonly FieldId[] = [
  "title",
  "description",
  "vendor",
  "tags",
];

export const OPTION_SLOTS = [
  { name: "option1Name", value: "option1Value", linked: "option1Linked", label: "Option1" },
  { name: "option2Name", value: "option2Value", linked: "option2Linked", label: "Option2" },
  { name: "option3Name", value: "option3Value", linked: "option3Linked", label: "Option3" },
] as const;

export const PACKED_FIELDS: readonly FieldId[] = [
  "packedLength",
  "packedWidth",
  "packedHeight",
  "packedUnit",
];
