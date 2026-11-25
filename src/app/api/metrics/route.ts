import { connection } from "next/server";
import { metricsText } from "@/lib/ops";

export async function GET() {
  await connection();
  return new Response(metricsText(), {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
  });
}
