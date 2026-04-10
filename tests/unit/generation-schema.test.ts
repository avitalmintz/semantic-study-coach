import { describe, expect, it } from "vitest";

import { generatedCardsOutputSchema } from "@/lib/schemas";

describe("generated card schema", () => {
  it("accepts valid conceptual and application cards", () => {
    const parsed = generatedCardsOutputSchema.parse({
      cards: [
        {
          prompt: "Explain osmosis in your own words.",
          idealAnswer: "Osmosis is water movement across a membrane from lower solute concentration to higher solute concentration.",
          keyConcepts: ["water movement", "membrane", "solute concentration"],
          questionType: "conceptual",
        },
        {
          prompt: "How would osmosis affect a plant in salty soil?",
          idealAnswer: "Water leaves plant cells in salty soil, reducing turgor pressure and causing wilting.",
          keyConcepts: ["hypertonic", "water leaves cells", "turgor pressure"],
          questionType: "application",
        },
      ],
    });

    expect(parsed.cards).toHaveLength(2);
  });

  it("rejects cards missing key concepts", () => {
    expect(() =>
      generatedCardsOutputSchema.parse({
        cards: [
          {
            prompt: "Short?",
            idealAnswer: "Too short",
            keyConcepts: [],
            questionType: "conceptual",
          },
        ],
      }),
    ).toThrow();
  });
});
