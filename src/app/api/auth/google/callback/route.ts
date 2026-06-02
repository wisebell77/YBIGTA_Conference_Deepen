import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCodeForGoogleSession,
  getSessionCookieOptions
} from "@/lib/google-drive/auth";
import { SESSION_COOKIE_NAME } from "@/lib/google-drive/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const projectId =
    request.nextUrl.searchParams.get("state") ||
    process.env.DEFAULT_PROJECT_ID ||
    "demo-project";

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ success: false, error: "GOOGLE_CODE_MISSING" }, { status: 400 });
  }

  const session = await exchangeCodeForGoogleSession(code);

  const redirectUrl = new URL("/", request.nextUrl.origin);
  redirectUrl.searchParams.set("projectId", projectId);
  redirectUrl.searchParams.set("googleDrive", "connected");
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(
    SESSION_COOKIE_NAME,
    session.sessionId,
    getSessionCookieOptions(session.expiresAt)
  );
  return response;
}
