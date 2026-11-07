/** Official help pages read on 2026-10-27 UTC. */
export const CHECKED_ON = "2026-10-27 UTC";

export const USING_CSV =
  "https://help.shopify.com/en/manual/products/import-export/using-csv";
export const IMPORT_PRODUCTS =
  "https://help.shopify.com/en/manual/products/import-export/import-products";
export const COMMON_ISSUES =
  "https://help.shopify.com/en/manual/products/import-export/common-import-issues";
export const CSV_FILES =
  "https://help.shopify.com/en/manual/shopify-admin/productivity-tools/csv-files";
export const ADD_VARIANTS =
  "https://help.shopify.com/en/manual/products/variants/add-variants";
export const SALE_PRICING =
  "https://help.shopify.com/en/manual/products/details/product-pricing/sale-pricing";
export const MIGRATE_AMAZON =
  "https://help.shopify.com/en/manual/migrating-to-shopify/migrating-from-amazon";
/**
 * The using-csv page links the sample as help.shopify.com/csv/product_template.csv.
 * That address answers 403 to a client without a browser session and redirects
 * to this CDN address, which answers 200 to any client.
 */
export const SAMPLE_CSV =
  "https://cdn.shopify.com/shopifycloud/product-knowledge/production/csv/product_template.csv";

/**
 * The help pages say 15 MB and do not say decimal or binary.
 * A file above 15 MiB is an error and is not linted.
 * A file from 15,000,001 through 15 MiB is a warning and is still linted.
 */
export const FILE_SIZE_DECIMAL = 15_000_000;
export const FILE_SIZE_LIMIT = 15 * 1024 * 1024;

export const MAX_FINDINGS_PER_RULE = 100;
export const MAX_VARIANTS = 2048;
export const MAX_OPTIONS = 3;
export const MAX_TAGS = 250;
export const MAX_BARCODES = 20;
export const MAX_IMAGES = 250;
export const MAX_ALT = 512;
export const OPTIMAL_ALT = 125;
export const MAX_SEO_TITLE = 70;
export const MAX_SEO_DESCRIPTION = 320;
export const MAX_COLLECTION = 255;
