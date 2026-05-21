import { NextResponse } from "next/server";
import { getGoogleAuthStatus } from "@/lib/google-drive/auth";

export const runtime = "nodejs";

export async function GET() {
  const status = await getGoogleAuthStatus();
  return NextResponse.json({ success: true, ...status });
}
