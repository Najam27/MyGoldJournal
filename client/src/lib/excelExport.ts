const escapeXml = (value: unknown) => String(value ?? "").replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[char]!));
const neutralizeFormula = (value: unknown) => /^[=+\-@]/.test(String(value ?? "")) ? `'${String(value)}` : String(value ?? "");

export function createExcelXml(rows: Array<Record<string, unknown>>, sheetName = "Trades") {
  const headers = Object.keys(rows[0] ?? {});
  const cell = (value: unknown) => `<Cell><Data ss:Type="String">${escapeXml(neutralizeFormula(value))}</Data></Cell>`;
  const headerRow = `<Row>${headers.map(cell).join("")}</Row>`;
  const body = rows.map(row => `<Row>${headers.map(header => cell(row[header])).join("")}</Row>`).join("");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escapeXml(sheetName)}"><Table>${headerRow}${body}</Table></Worksheet></Workbook>`;
}

export function downloadExcelXml(rows: Array<Record<string, unknown>>, filename: string) {
  const blob = new Blob([createExcelXml(rows)], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
