import { describe, expect, it } from "vitest";

import { parseModelOutput } from "@/lib/ai";
import { gradeOutputSchema } from "@/lib/schemas";

describe("grade parser guardrails", () => {
  it("parses valid JSON wrapped in extra text", () => {
    const parsed = parseModelOutput(
      `Result follows:\n{"scorePercent":88,"missingConcepts":["mitosis"],"misconceptions":[],"modelAnswer":"The cell cycle includes interphase and mitosis to replicate DNA and divide.","explanationShort":"Strong response with one missing concept."}`,
      gradeOutputSchema,
    );

    expect(parsed.scorePercent).toBe(88);
    expect(parsed.missingConcepts).toContain("mitosis");
  });

  it("throws for malformed or non-JSON output", () => {
    expect(() => parseModelOutput("not-json", gradeOutputSchema)).toThrow();
    expect(() =>
      parseModelOutput(
        "{\"scorePercent\":150,\"missingConcepts\":[],\"misconceptions\":[],\"modelAnswer\":\"bad\",\"explanationShort\":\"short\"}",
        gradeOutputSchema,
      ),
    ).toThrow();
  });
});
