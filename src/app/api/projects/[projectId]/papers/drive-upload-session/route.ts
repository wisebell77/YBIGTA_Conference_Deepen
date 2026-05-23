import { NextResponse } from "next/server";
import { GoogleDriveStorageAdapter } from "@/lib/google-drive/storage-adapter";

const DEFAULT_MAX_MB = 20;

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as {
      filename?: string;
      size?: number;
      mimeType?: string;
    };

    const filename = body.filename?.trim() || "paper.pdf";
    const size = Number(body.size ?? 0);
    const mimeType = body.mimeType || "application/pdf";

    if (mimeType !== "application/pdf" && !filename.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "PDF_ONLY" }, { status: 400 });
    }

    const maxMb = Number(process.env.MAX_UPLOAD_MB || DEFAULT_MAX_MB);
    if (size > maxMb * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "PDF_TOO_LARGE" }, { status: 413 });
    }

    const adapter = new GoogleDriveStorageAdapter();
    const session = await adapter.createPdfUploadSession(projectId, filename, size || undefined);

    return NextResponse.json({ success: true, ...session });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
