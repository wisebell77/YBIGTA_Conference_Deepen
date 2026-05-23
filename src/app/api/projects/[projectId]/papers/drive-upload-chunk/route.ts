import { NextResponse } from "next/server";

const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const uploadUrl = request.headers.get("x-drive-upload-url");
    const start = Number(request.headers.get("x-upload-start"));
    const end = Number(request.headers.get("x-upload-end"));
    const total = Number(request.headers.get("x-upload-total"));
    const contentType = request.headers.get("x-upload-content-type") || "application/pdf";

    if (!uploadUrl) {
      return NextResponse.json({ success: false, error: "DRIVE_UPLOAD_URL_REQUIRED" }, { status: 400 });
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      !Number.isSafeInteger(total) ||
      start < 0 ||
      end < start ||
      total <= 0
    ) {
      return NextResponse.json({ success: false, error: "INVALID_CHUNK_RANGE" }, { status: 400 });
    }

    const chunk = Buffer.from(await request.arrayBuffer());
    if (!chunk.byteLength || chunk.byteLength > MAX_CHUNK_BYTES) {
      return NextResponse.json({ success: false, error: "INVALID_CHUNK_SIZE" }, { status: 413 });
    }
    if (chunk.byteLength !== end - start + 1) {
      return NextResponse.json({ success: false, error: "CHUNK_RANGE_MISMATCH" }, { status: 400 });
    }

    const driveResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Type": contentType
      },
      body: chunk
    });

    if (driveResponse.status === 308) {
      return NextResponse.json({ success: true, done: false });
    }

    if (!driveResponse.ok) {
      const body = await driveResponse.text();
      return NextResponse.json(
        { success: false, error: `DRIVE_CHUNK_UPLOAD_FAILED: ${body.slice(0, 500)}` },
        { status: driveResponse.status }
      );
    }

    const file = (await driveResponse.json()) as unknown;
    return NextResponse.json({ success: true, done: true, file });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
