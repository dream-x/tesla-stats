import { pollOnce } from "@/lib/poller";
import { widgetTokenValid } from "@/lib/summary";

/** Lets an external cron trigger a poll (e.g. when the built-in poller is disabled). */
export async function POST(request: Request) {
  if (!widgetTokenValid(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await pollOnce());
}
