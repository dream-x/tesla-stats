import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeCode } from "@/lib/tesla";
import { pollOnce } from "@/lib/poller";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const store = await cookies();
  const expected = store.get("tesla_oauth_state")?.value;
  store.delete("tesla_oauth_state");

  const code = sp.get("code");
  if (sp.get("error") || !code) redirect(`/settings?error=${encodeURIComponent(sp.get("error") || "no_code")}`);
  if (!expected || expected !== sp.get("state")) redirect("/settings?error=bad_state");

  let error: string | null = null;
  try {
    await exchangeCode(code);
    await pollOnce();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  redirect(error ? `/settings?error=${encodeURIComponent(error.slice(0, 200))}` : "/settings?connected=1");
}
