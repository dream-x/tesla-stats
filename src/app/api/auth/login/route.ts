import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isTeslaConfigured, TESLA_AUTH_URL, TESLA_SCOPES, teslaConfig } from "@/lib/tesla";

export async function GET() {
  await connection();
  if (!isTeslaConfigured()) redirect("/settings?error=not_configured");
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("tesla_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  const c = teslaConfig();
  const url = new URL(TESLA_AUTH_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    scope: TESLA_SCOPES,
    state,
    locale: "ru-RU",
    prompt: "login",
  }).toString();
  redirect(url.toString());
}
