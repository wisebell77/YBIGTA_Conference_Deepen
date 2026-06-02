import pdfParse from "pdf-parse";
import { Readable } from "stream";

type DocumentParseProvider = "local" | "upstage";

const UPSTAGE_DOCUMENT_PARSE_URL =
  process.env.UPSTAGE_DOCUMENT_PARSE_URL ?? "https://api.upstage.ai/v1/document-digitization";

function textProvider(): DocumentParseProvider {
  const provider = process.env.PDF_TEXT_PROVIDER ?? process.env.DOCUMENT_PARSE_PROVIDER ?? "local";
  return provider === "upstage" ? "upstage" : "local";
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstTextField(value: unknown): string {
  return typeof value === "string" ? normalizeText(value) : "";
}

function preferredTextFromRecord(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const content = record.content;

  return (
    firstTextField(record.text) ||
    firstTextField(record.markdown) ||
    (content && typeof content === "object"
      ? preferredTextFromRecord(content as Record<string, unknown>)
      : firstTextField(content)) ||
    firstTextField(record.html)
  );
}

function collectPreferredFragments(value: unknown, fragments: string[] = []): string[] {
  if (!value) return fragments;

  if (typeof value === "string") {
    const text = normalizeText(value);
    if (text) fragments.push(text);
    return fragments;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectPreferredFragments(item, fragments));
    return fragments;
  }

  if (typeof value !== "object") return fragments;

  const preferred = preferredTextFromRecord(value);
  if (preferred) {
    fragments.push(preferred);
    return fragments;
  }

  const record = value as Record<string, unknown>;
  collectPreferredFragments(record.elements, fragments);
  collectPreferredFragments(record.pages, fragments);
  return fragments;
}

function extractDocumentParseText(value: unknown): string {
  const fragments = collectPreferredFragments(value);
  return normalizeText([...new Set(fragments)].join("\n"));
}

async function extractTextWithPdfParse(pdfBuffer: Buffer): Promise<string> {
  const result = await pdfParse(pdfBuffer);
  const text = normalizeText(result.text);
  if (!text || text.length < 50) throw new Error("PDF_TEXT_TOO_SHORT");
  return text;
}

async function extractTextWithUpstage(pdfBuffer: Buffer, filename = "paper.pdf"): Promise<string> {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY_MISSING");

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("document", blob, filename);
  formData.append("model", process.env.UPSTAGE_DOCUMENT_PARSE_MODEL ?? "document-parse");
  formData.append("ocr", process.env.UPSTAGE_DOCUMENT_PARSE_OCR ?? "auto");

  const outputFormat = process.env.UPSTAGE_DOCUMENT_PARSE_OUTPUT_FORMAT;
  if (outputFormat) formData.append("output_format", outputFormat);

  const response = await fetch(UPSTAGE_DOCUMENT_PARSE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`UPSTAGE_DOCUMENT_PARSE_FAILED: ${body.slice(0, 500)}`);
  }

  const json = (await response.json()) as unknown;
  const text = extractDocumentParseText(json);
  if (!text || text.length < 50) throw new Error("UPSTAGE_DOCUMENT_PARSE_TEXT_TOO_SHORT");
  return text;
}

function appendMultipartField(parts: Array<string | Buffer>, boundary: string, name: string, value: string) {
  parts.push(
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="${name}"\r\n\r\n`,
    `${value}\r\n`
  );
}

function safeMultipartFilename(filename: string): string {
  return filename.replace(/[\r\n"]/g, "_") || "paper.pdf";
}

function upstageMultipartBoundary(): string {
  return `----deepen-upstage-${crypto.randomUUID().replace(/-/g, "")}`;
}

async function extractTextWithUpstageStream(
  pdfStream: Readable,
  filename = "paper.pdf"
): Promise<string> {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY_MISSING");

  const boundary = upstageMultipartBoundary();
  const body = Readable.from(createUpstageMultipartStreamWithBoundary(pdfStream, filename, boundary));
  const requestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body,
    duplex: "half"
  } as unknown as RequestInit & { duplex: "half" };
  const response = await fetch(UPSTAGE_DOCUMENT_PARSE_URL, requestInit);

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`UPSTAGE_DOCUMENT_PARSE_STREAM_FAILED: ${responseBody.slice(0, 500)}`);
  }

  const json = (await response.json()) as unknown;
  const text = extractDocumentParseText(json);
  if (!text || text.length < 50) throw new Error("UPSTAGE_DOCUMENT_PARSE_TEXT_TOO_SHORT");
  return text;
}

async function* createUpstageMultipartStreamWithBoundary(
  pdfStream: Readable,
  filename: string,
  boundary: string
) {
  const initialParts: Array<string | Buffer> = [];
  appendMultipartField(
    initialParts,
    boundary,
    "model",
    process.env.UPSTAGE_DOCUMENT_PARSE_MODEL ?? "document-parse"
  );
  appendMultipartField(
    initialParts,
    boundary,
    "ocr",
    process.env.UPSTAGE_DOCUMENT_PARSE_OCR ?? "auto"
  );

  const outputFormat = process.env.UPSTAGE_DOCUMENT_PARSE_OUTPUT_FORMAT;
  if (outputFormat) appendMultipartField(initialParts, boundary, "output_format", outputFormat);

  initialParts.push(
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="document"; filename="${safeMultipartFilename(filename)}"\r\n`,
    "Content-Type: application/pdf\r\n\r\n"
  );

  for (const part of initialParts) yield typeof part === "string" ? Buffer.from(part) : part;
  for await (const chunk of pdfStream) yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  yield Buffer.from(`\r\n--${boundary}--\r\n`);
}

export async function extractTextFromPdf(pdfBuffer: Buffer, filename = "paper.pdf"): Promise<string> {
  try {
    if (textProvider() === "upstage") {
      try {
        return await extractTextWithUpstage(pdfBuffer, filename);
      } catch (error) {
        if (process.env.PDF_TEXT_FALLBACK_TO_LOCAL === "false") throw error;
        return await extractTextWithPdfParse(pdfBuffer);
      }
    }

    return await extractTextWithPdfParse(pdfBuffer);
  } catch (error) {
    throw new Error("PDF_TEXT_EXTRACTION_FAILED", { cause: error });
  }
}

export async function extractTextFromPdfStream(
  pdfStream: Readable,
  filename = "paper.pdf",
  fallbackBuffer?: () => Promise<Buffer>
): Promise<string> {
  if (textProvider() !== "upstage") {
    if (!fallbackBuffer) throw new Error("PDF_STREAM_REQUIRES_BUFFER_FALLBACK");
    return extractTextFromPdf(await fallbackBuffer(), filename);
  }

  try {
    return await extractTextWithUpstageStream(pdfStream, filename);
  } catch (error) {
    if (process.env.PDF_TEXT_FALLBACK_TO_LOCAL === "false" && !fallbackBuffer) throw error;
    if (!fallbackBuffer) throw new Error("PDF_TEXT_EXTRACTION_FAILED", { cause: error });
    return extractTextFromPdf(await fallbackBuffer(), filename);
  }
}
