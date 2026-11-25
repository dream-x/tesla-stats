import { NextResponse, type NextRequest } from "next/server";

/** Optional HTTP Basic Auth for the whole app (set BASIC_AUTH_USER / BASIC_AUTH_PASSWORD). */
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  // Health and metrics expose no secrets; Gatus and VictoriaMetrics scrape them without credentials.
  if (pathname.startsWith("/.well-known/") || pathname === "/api/health" || pathname === "/api/metrics") {
    return NextResponse.next();
  }

  const widgetToken = process.env.WIDGET_TOKEN;
  if (widgetToken && ["/api/summary", "/api/poll", "/widget"].includes(pathname)) {
    const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (searchParams.get("token") === widgetToken || bearer === widgetToken) return NextResponse.next();
  }

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Tesla Stats", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon).*)"],
};
