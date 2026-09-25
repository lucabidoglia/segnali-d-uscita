import { templateWorkbook } from "@/lib/excel";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET() {
  return new Response(await templateWorkbook(), {
    headers: { "Content-Type": XLSX, "Content-Disposition": 'attachment; filename="Modello_dati_retributivi.xlsx"' },
  });
}
