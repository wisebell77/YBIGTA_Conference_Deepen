import { NextResponse, type NextRequest } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google-drive/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const projectId =
    request.nextUrl.searchParams.get("projectId") ||
    process.env.DEFAULT_PROJECT_ID ||
    "demo-project";

  return NextResponse.redirect(getGoogleAuthUrl(projectId));
}
