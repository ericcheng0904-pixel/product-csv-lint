export function csv(rows: string[][]): string {
  return `${rows.map((row) => row.map(escapeCell).join(",")).join("\n")}\n`;
}

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll("\"", "\"\"")}"`;
  return value;
}

export function variants(count: number): string {
  const rows: string[][] = [["Title", "URL handle", "Option1 name", "Option1 value", "Price"]];
  for (let index = 0; index < count; index += 1) {
    rows.push([index === 0 ? "Hat" : "", "hat", index === 0 ? "Size" : "", `V${index}`, "10"]);
  }
  return csv(rows);
}

export function images(count: number): string {
  const rows: string[][] = [[
    "Title",
    "URL handle",
    "Option1 name",
    "Option1 value",
    "Price",
    "Product image URL",
  ]];
  for (let index = 0; index < count; index += 1) {
    const url = `https://cdn.example.com/p${index}.jpg`;
    if (index === 0) rows.push(["Hat", "hat", "Size", "Small", "10", url]);
    else rows.push(["", "hat", "", "", "", url]);
  }
  return csv(rows);
}

export function tags(count: number): string {
  const value = Array.from({ length: count }, (_, index) => `tag${index}`).join(",");
  return csv([
    ["Title", "URL handle", "Tags"],
    ["Hat", "hat", value],
  ]);
}

export function barcodes(count: number): string {
  const value = Array.from({ length: count }, (_, index) => `b${index}`).join(";");
  return csv([
    ["Title", "URL handle", "Barcodes"],
    ["Hat", "hat", value],
  ]);
}
