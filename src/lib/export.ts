import * as XLSX from "xlsx";

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

function toPlainRows<T>(rows: T[], columns: ExportColumn<T>[]): Record<string, string | number>[] {
  return rows.map((row) => {
    const plain: Record<string, string | number> = {};
    columns.forEach((col) => {
      plain[col.header] = col.accessor(row);
    });
    return plain;
  });
}

export function exportToCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(toPlainRows(rows, columns));
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(toPlainRows(rows, columns));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function printRows<T>(rows: T[], columns: ExportColumn<T>[], title: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  const head = columns.map((c) => `<th>${c.header}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${String(c.accessor(row))}</td>`).join("")}</tr>`)
    .join("");
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">${rows.length} record(s) &middot; exported ${new Date().toLocaleString()}</div>
        <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
