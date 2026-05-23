import { NextResponse } from "next/server";
import { analyzeDrivePaper } from "@/lib/analyze";
import { GoogleDriveStorageAdapter } from "@/lib/google-drive/storage-adapter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = (await request.json()) as { driveFileId?: string };
    const driveFileId = body.driveFileId?.trim();

    if (!driveFileId) {
      return NextResponse.json({ success: false, error: "DRIVE_FILE_ID_REQUIRED" }, { status: 400 });
    }

    const adapter = new GoogleDriveStorageAdapter();
    const storedFile = await adapter.getPdfInfo(projectId, driveFileId);
    const pdfStream = await adapter.readPdfStream(projectId, driveFileId);
    const result = await analyzeDrivePaper({
      projectId,
      storedFile,
      pdfStream,
      readPdfBuffer: () => adapter.readPdf(projectId, driveFileId)
    });

    return NextResponse.json({ success: true, paperId: result.paperId, graph: result.graph });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "PDF_TEXT_EXTRACTION_FAILED" ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
