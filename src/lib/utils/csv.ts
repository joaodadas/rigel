// CSV export utility for dashboard tables

export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(";"),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(";")
    ),
  ].join("\n");

  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
