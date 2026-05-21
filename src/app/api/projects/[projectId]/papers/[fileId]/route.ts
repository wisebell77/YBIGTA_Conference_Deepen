import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const { projectId, fileId } = await params;
    const pdf = await storage.readPdf(projectId, fileId);
    return new NextResponse(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileId}.pdf"`
      }
    });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json(
      { success: false, error: message },
      { status: message === "PDF_NOT_FOUND" ? 404 : 500 }
    );
  }
}
