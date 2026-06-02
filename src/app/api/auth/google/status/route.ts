import { NextResponse } from "next/server";
import { getGoogleAuthStatus } from "@/lib/google-drive/auth";
import { storageBackend } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const status = await getGoogleAuthStatus();
  return NextResponse.json({ success: true, ...status, storageBackend: storageBackend() });
}
