import pdfParse from "pdf-parse";

type JigsawInput =
  | {
      file: {
        buffer: Buffer;
        mimeType: string;
        fileName: string;
      };
    }
  | {
      fileUrl: string;
    };

const JIGSAW_API_BASE = process.env.JIGSAWSTACK_API_URL || "https://api.jigsawstack.com/v1";

function cleanExtractedText(raw: string) {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\r\f\v]+/g, "\n")
    .trim();
}

function getTextFromUnknownPayload(payload: any): string {
  if (!payload) return "";

  const textCandidates = [
    payload.text,
    payload.content,
    payload.extracted_text,
    payload.markdown,
    payload.data?.text,
    payload.data?.content,
    Array.isArray(payload.pages)
      ? payload.pages.map((p: any) => p.text || p.content || "").join("\n")
      : "",
  ];

  return textCandidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0) || "";
}

async function extractWithJigsaw(input: JigsawInput): Promise<string> {
  const apiKey = process.env.JIGSAWSTACK_API_KEY;
  if (!apiKey) return "";

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  };

  const formData = new FormData();
  if ("file" in input) {
    formData.append(
      "file",
      new Blob([input.file.buffer], { type: input.file.mimeType }),
      input.file.fileName
    );
  } else {
    formData.append("url", input.fileUrl);
  }

  const endpoint = `${JIGSAW_API_BASE}/ocr`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn("JigsawStack OCR failed:", errorBody);
    return "";
  }

  const payload = await response.json();
  return cleanExtractedText(getTextFromUnknownPayload(payload));
}

async function extractPdfFallback(buffer: Buffer): Promise<string> {
  const parsed = await pdfParse(buffer);
  return cleanExtractedText(parsed.text || "");
}

export async function extractCvText(input: JigsawInput): Promise<string> {
  const fromJigsaw = await extractWithJigsaw(input);
  if (fromJigsaw) return fromJigsaw;

  if ("file" in input && input.file.mimeType === "application/pdf") {
    return extractPdfFallback(input.file.buffer);
  }

  return "";
}
