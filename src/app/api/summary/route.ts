import { connection } from "next/server";
import { buildSummaryPayload, widgetTokenValid } from "@/lib/summary";

export async function GET(request: Request) {
  await connection();
  if (!widgetTokenValid(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const payload = buildSummaryPayload({
    period: sp.get("period") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
  });
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
