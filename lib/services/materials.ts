import { ApiError } from "@/lib/http";
import { estimateTokenCount, normalizeStudyText } from "@/lib/text";
import type { SourceType } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const MATERIALS_BUCKET = process.env.SUPABASE_MATERIALS_BUCKET ?? "materials";

async function extractTextFromPdfArrayBuffer(buffer: ArrayBuffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const parser = new pdfParseModule.PDFParse({ data: Buffer.from(buffer) });
  try {
    const parsed = await parser.getText();
    return normalizeStudyText(parsed.text ?? "");
  } finally {
    await parser.destroy();
  }
}

async function extractTextWithPdfToText(buffer: ArrayBuffer): Promise<string> {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");

  const execFileAsync = promisify(execFile);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "semantic-study-"));
  const pdfPath = path.join(tempDir, `${randomUUID()}.pdf`);
  const txtPath = path.join(tempDir, `${randomUUID()}.txt`);

  try {
    await fs.writeFile(pdfPath, Buffer.from(buffer));
    await execFileAsync("pdftotext", [
      "-layout",
      "-enc",
      "UTF-8",
      pdfPath,
      txtPath,
    ]);
    const text = await fs.readFile(txtPath, "utf8");
    return normalizeStudyText(text);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function ingestMaterialForUser(input: {
  supabase: SupabaseClient;
  userId: string;
  sourceType: SourceType;
  text?: string;
  fileId?: string;
}): Promise<{
  materialId: string;
  extractedText: string;
  tokenEstimate: number;
}> {
  let extractedText = "";

  if (input.sourceType === "text") {
    extractedText = normalizeStudyText(input.text ?? "");
  } else {
    const storagePath = input.fileId;
    if (!storagePath) {
      throw new ApiError(400, "fileId is required for pdf ingestion");
    }

    const { data: file, error: downloadError } = await input.supabase.storage
      .from(MATERIALS_BUCKET)
      .download(storagePath);

    if (downloadError || !file) {
      throw new ApiError(400, "Could not download PDF from storage");
    }

    const buffer = await file.arrayBuffer();
    const extractionErrors: unknown[] = [];

    try {
      extractedText = await extractTextFromPdfArrayBuffer(buffer);
    } catch (error) {
      extractionErrors.push(error);
      extractedText = "";
    }

    if (!extractedText || extractedText.length < 20) {
      try {
        extractedText = await extractTextWithPdfToText(buffer);
      } catch (error) {
        extractionErrors.push(error);
      }
    }

    if (!extractedText || extractedText.length < 20) {
      console.error("PDF extraction failed", extractionErrors);
      throw new ApiError(
        400,
        "Could not parse this PDF text automatically. Try re-downloading as PDF or paste the text directly.",
      );
    }
  }

  if (!extractedText || extractedText.length < 20) {
    throw new ApiError(400, "Not enough usable text was extracted from the source");
  }

  const tokenEstimate = estimateTokenCount(extractedText);

  const { data: material, error } = await input.supabase
    .from("materials")
    .insert({
      user_id: input.userId,
      source_type: input.sourceType,
      raw_text: extractedText,
      storage_path: input.sourceType === "pdf" ? input.fileId : null,
      token_estimate: tokenEstimate,
    })
    .select("id")
    .single();

  if (error || !material) {
    throw new ApiError(500, "Failed to persist material");
  }

  return {
    materialId: material.id,
    extractedText,
    tokenEstimate,
  };
}
