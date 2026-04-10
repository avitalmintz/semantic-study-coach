import { z } from "zod";

export const ingestRequestSchema = z
  .object({
    sourceType: z.enum(["text", "pdf"]),
    text: z.string().optional(),
    fileId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sourceType === "text" && !value.text?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "text is required when sourceType is text",
        path: ["text"],
      });
    }

    if (value.sourceType === "pdf" && !value.fileId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fileId is required when sourceType is pdf",
        path: ["fileId"],
      });
    }
  });

export const generateDeckRequestSchema = z.object({
  materialId: z.string().uuid(),
  title: z.string().min(3).max(120),
  cardCountTarget: z.number().int().min(3).max(60).default(12),
});

export const cardSchema = z.object({
  prompt: z.string().min(10),
  idealAnswer: z.string().min(20),
  keyConcepts: z.array(z.string().min(1)).min(2).max(10),
  questionType: z.enum(["conceptual", "application"]),
});

export const patchCardsRequestSchema = z.object({
  cards: z.array(cardSchema).min(1).max(200),
});

export const startSessionSchema = z.object({
  deckId: z.string().uuid(),
});

export const answerRequestSchema = z.object({
  cardId: z.string().uuid(),
  answerText: z.string().min(2).max(10000),
});

export const generatedCardsOutputSchema = z.object({
  cards: z.array(cardSchema).min(1),
});

export const gradeOutputSchema = z.object({
  scorePercent: z.number().min(0).max(100),
  missingConcepts: z.array(z.string()).max(12),
  misconceptions: z.array(z.string()).max(12),
  modelAnswer: z.string().min(20),
  explanationShort: z.string().min(10).max(280),
});
