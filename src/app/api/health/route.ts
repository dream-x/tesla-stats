import { connection } from "next/server";
import { healthPayload } from "@/lib/ops";

export async function GET() {
  await connection();
  try {
    return Response.json(healthPayload(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ status: "error", message }, { status: 503 });
  }
}
