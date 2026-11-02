import ExcelJS from "exceljs";
import Papa from "papaparse";

export type Row = Record<string, string>;

const ALIASES: Record<string, string[]> = {
  phone: ["phone", "mobile", "mobile number", "phone number", "number", "contact", "contact number", "mob", "mobile no", "phone no", "whatsapp", "msisdn", "नंबर", "मोबाइल"],
  name: ["name", "full name", "contact name", "naam", "नाम", "customer name"],
  consent_source: ["consent_source", "consent source", "source", "opt-in source", "optin source", "consent"],
  consent_date: ["consent_date", "consent date", "opt-in date", "optin date", "granted at", "date"],
  consent_evidence: ["consent_evidence", "consent evidence", "evidence", "proof", "evidence ref", "reference"],
  consent_expiry: ["consent_expiry", "consent expiry", "expiry", "expires", "valid till"],
  tags: ["tags", "tag", "group", "list", "segment", "area", "city"],
};

export function canonicalHeader(h: string): string | null {
  const k = h.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [canon, list] of Object.entries(ALIASES)) if (list.includes(k)) return canon;
  return null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("text" in v && v.text != null) return String(v.text);
    if ("result" in v && v.result != null) return String(v.result);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("hyperlink" in v) return String((v as { text?: string }).text ?? "");
    return "";
  }
  return String(v);
}

export async function parseSheet(fileName: string, buf: Buffer): Promise<{ headers: string[]; rows: Row[] }> {
  const lower = fileName.toLowerCase();
  let table: string[][] = [];
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const r = Papa.parse<string[]>(buf.toString("utf8").replace(/^\uFEFF/, ""), { skipEmptyLines: true });
    table = r.data;
  } else if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("Workbook has no sheets");
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let i = 1; i <= ws.columnCount; i++) vals.push(cellText(row.getCell(i).value).trim());
      table.push(vals);
    });
  } else {
    throw new Error("Upload a .xlsx or .csv file (old .xls: open in Excel and Save As .xlsx)");
  }
  if (table.length < 2) throw new Error("File has no data rows");
  const raw = table[0].map((h) => String(h ?? ""));
  const headers = raw.map((h) => canonicalHeader(h) ?? h.trim().toLowerCase());
  if (!headers.includes("phone")) throw new Error(`No phone/mobile column found. Columns seen: ${raw.join(", ")}`);
  const rows = table.slice(1).map((r) => {
    const o: Row = {};
    headers.forEach((h, i) => (o[h] = String(r[i] ?? "").trim()));
    return o;
  });
  return { headers, rows: rows.filter((r) => Object.values(r).some(Boolean)) };
}

export function parseLooseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 6, 30));
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const d = new Date(t.length > 10 ? t : `${t}T06:30:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) return new Date(Math.round((Number(t) - 25569) * 86400_000));
  return null;
}

export const TEMPLATE_HEADERS = ["phone", "name", "consent_source", "consent_date", "consent_evidence", "consent_expiry", "tags"];
export const TEMPLATE_SAMPLE = [
  ["9876543210", "Ramesh Kumar", "Website signup form", "01/10/2026", "FORM-2026-0012", "", "jaipur;supporters"],
  ["+919812345678", "Sunita Devi", "Event registration desk", "15/10/2026", "REG-BOOK-44", "31/12/2027", "dausa"],
];
