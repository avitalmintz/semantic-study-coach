const TOKEN_APPROX_CHARS = 4;

export function normalizeStudyText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function estimateTokenCount(input: string): number {
  const normalized = normalizeStudyText(input);
  return Math.max(1, Math.ceil(normalized.length / TOKEN_APPROX_CHARS));
}

export function chunkTextForGeneration(
  input: string,
  maxChunkChars = 12000,
): string[] {
  const normalized = normalizeStudyText(input);
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      continue;
    }

    const candidate = current
      ? `${current}\n\n${paragraph}`
      : paragraph;

    if (candidate.length <= maxChunkChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (paragraph.length <= maxChunkChars) {
      current = paragraph;
      continue;
    }

    for (let i = 0; i < paragraph.length; i += maxChunkChars) {
      chunks.push(paragraph.slice(i, i + maxChunkChars));
    }

    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
