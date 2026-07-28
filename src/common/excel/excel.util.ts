import * as ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

/** Builds an .xlsx file buffer from an array of plain objects. */
export async function buildExcelBuffer(
  rows: Record<string, any>[],
  columns: ExcelColumn[],
  sheetName = 'Sheet1',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
return buffer as unknown as Buffer;
}

/**
 * Parses an uploaded .xlsx buffer into an array of row objects keyed by the
 * exact header text found in row 1 (e.g. { "Make": "Toyota", "Model": "Camry" }).
 * Fully blank rows are skipped.
 */
export async function parseExcelBuffer(buffer: Buffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  const rows: Record<string, any>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const obj: Record<string, any> = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (key) obj[key] = cell.value;
    });

    const hasData = Object.values(obj).some((v) => v !== null && v !== undefined && v !== '');
    if (hasData) rows.push(obj);
  });

  return rows;
}

/** Coerces common truthy spreadsheet representations ('true', 'TRUE', 1) to boolean. */
export function toBool(value: any): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['true', 'yes', '1'].includes(value.trim().toLowerCase());
  return false;
}