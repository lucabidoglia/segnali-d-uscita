import { templateWorkbook } from "@/lib/excel";
import demo from "@/lib/demo.json";

// File di prova con 180 persone INVENTATE (periodo gen–giu 2026), già compilato nel formato del modello.
export async function GET() {
  return new Response(await templateWorkbook(demo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Esempio_dati_inventati.xlsx"',
    },
  });
}
