import { describe, expect, it } from "vitest";

import {
  chunkTextForGeneration,
  estimateTokenCount,
  normalizeStudyText,
} from "@/lib/text";

describe("text normalization and chunking", () => {
  it("normalizes whitespace and newlines", () => {
    const raw = "Line 1\r\n\r\n\r\nLine    2\u00a0\u00a0value";
    expect(normalizeStudyText(raw)).toBe("Line 1\n\nLine 2 value");
  });

  it("chunks large text by paragraph", () => {
    const input = [
      "A".repeat(50),
      "B".repeat(50),
      "C".repeat(50),
    ].join("\n\n");

    const chunks = chunkTextForGeneration(input, 90);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("\n\n").replace(/\n{3,}/g, "\n\n")).toContain("A");
  });

  it("estimates token count with floor of 1", () => {
    expect(estimateTokenCount("")).toBe(1);
    expect(estimateTokenCount("abcdabcd")).toBe(2);
  });
});
