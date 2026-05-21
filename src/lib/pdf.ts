import pdfParse from "pdf-parse";

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(pdfBuffer);
    const text = result.text.replace(/\s+/g, " ").trim();
    if (!text || text.length < 50) throw new Error("PDF_TEXT_TOO_SHORT");
    return text;
  } catch (error) {
    throw new Error("PDF_TEXT_EXTRACTION_FAILED", { cause: error });
  }
}
