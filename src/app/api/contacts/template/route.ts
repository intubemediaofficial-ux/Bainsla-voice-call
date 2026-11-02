import ExcelJS from "exceljs";
import { route } from "@/lib/api";
import { TEMPLATE_HEADERS, TEMPLATE_SAMPLE } from "@/lib/import";

export const GET = route("contacts.read", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Contacts");
  ws.addRow(TEMPLATE_HEADERS);
  TEMPLATE_SAMPLE.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 22));
  ws.getColumn(1).numFmt = "@";
  const help = wb.addWorksheet("How to fill");
  [
    ["phone", "Required. 10-digit Indian mobile or +91 format."],
    ["name", "Optional."],
    ["consent_source", "Required (or set once in the upload form). Where the person agreed: signup form, membership register, event desk, missed call..."],
    ["consent_date", "Required (or set once in the form). DD/MM/YYYY."],
    ["consent_evidence", "Required (or set once in the form). Form ID, register page no., recording ID — proof you can show later."],
    ["consent_expiry", "Optional. DD/MM/YYYY after which consent is no longer valid."],
    ["tags", "Optional. Groups like area or booth, separated by ; (used to pick the audience of a campaign)."],
    ["", ""],
    ["Note", "Voter rolls or purchased lists are NOT consent. Only include people who agreed to receive these calls."],
  ].forEach((r) => help.addRow(r));
  help.getColumn(1).width = 20;
  help.getColumn(2).width = 110;
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="bainsla-voice-contacts-template.xlsx"',
    },
  });
});
