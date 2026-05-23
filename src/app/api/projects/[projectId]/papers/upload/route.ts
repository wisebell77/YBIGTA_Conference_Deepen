import { NextResponse } from "next/server";
import { analyzeUploadedPaper } from "@/lib/analyze";

const DEFAULT_MAX_MB = 20;

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "PDF_FILE_REQUIRED" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "PDF_ONLY" }, { status: 400 });
    }

    const maxMb = Number(process.env.MAX_UPLOAD_MB || DEFAULT_MAX_MB);
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "PDF_TOO_LARGE" }, { status: 413 });
    }

    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const result = await analyzeUploadedPaper({
      projectId,
      pdfBuffer,
      originalFilename: file.name
    });

    return NextResponse.json({ success: true, paperId: result.paperId, graph: result.graph });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "PDF_TEXT_EXTRACTION_FAILED" ? 422 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
