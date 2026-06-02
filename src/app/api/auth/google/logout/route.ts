import { NextResponse } from "next/server";
import { deleteCurrentGoogleSession } from "@/lib/google-drive/auth";
import { SESSION_COOKIE_NAME } from "@/lib/google-drive/constants";

export const runtime = "nodejs";

export async function POST() {
  await deleteCurrentGoogleSession();
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
