import OpenAI from "openai";
import type { ZodType } from "zod";

import {
  generatedCardsOutputSchema,
  gradeOutputSchema,
} from "@/lib/schemas";
import type { BaseGradeResult, GeneratedCard } from "@/lib/types";

const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
const apiKey = process.env.OPENAI_API_KEY;

const client = apiKey ? new OpenAI({ apiKey }) : null;

function extractJsonPayload(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON payload found in model response");
  }

  return JSON.parse(raw.slice(start, end + 1));
}

export function parseModelOutput<T>(raw: string, schema: ZodType<T>): T {
  const payload = extractJsonPayload(raw);
  return schema.parse(payload);
}

function heuristicCards(sourceText: string, cardCountTarget: number): GeneratedCard[] {
  const sentences = sourceText
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 30)
    .slice(0, Math.max(cardCountTarget * 2, 20));

  const cards: GeneratedCard[] = [];

  for (let i = 0; i < cardCountTarget; i += 1) {
    const sentence = sentences[i % Math.max(sentences.length, 1)] ||
      "Explain a core concept from your notes.";

    cards.push({
      prompt:
        i % 2 === 0
          ? `In your own words, explain this concept: ${sentence}`
          : `Apply this idea to a realistic scenario: ${sentence}`,
      idealAnswer: sentence,
      keyConcepts: sentence
        .split(/\W+/)
        .filter((token) => token.length > 5)
        .slice(0, 5),
      questionType: i % 2 === 0 ? "conceptual" : "application",
    });
  }

  return cards;
}

function heuristicGrade(input: {
  keyConcepts: string[];
  idealAnswer: string;
  studentAnswer: string;
}): BaseGradeResult {
  const answer = input.studentAnswer.toLowerCase();
  const concepts = input.keyConcepts.map((concept) => concept.toLowerCase());

  const matched = concepts.filter((concept) => answer.includes(concept));
  const missing = concepts.filter((concept) => !answer.includes(concept));

  const scoreFromConcepts =
    concepts.length === 0
      ? 50
      : Math.round((matched.length / concepts.length) * 100);

  const scoreFromLength = Math.min(25, Math.floor(answer.length / 20));
  const scorePercent = Math.max(0, Math.min(100, scoreFromConcepts + scoreFromLength));

  return {
    scorePercent,
    missingConcepts: missing,
    misconceptions: scorePercent < 40 ? ["Response does not cover core meaning"] : [],
    modelAnswer: input.idealAnswer,
    explanationShort:
      scorePercent >= 75
        ? "Good conceptual coverage in your own words."
        : "You captured part of the idea, but key concepts are still missing.",
  };
}

export async function generateCardsFromMaterial(input: {
  title: string;
  materialText: string;
  cardCountTarget: number;
}): Promise<GeneratedCard[]> {
  if (!client) {
    return heuristicCards(input.materialText, input.cardCountTarget);
  }

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You are a study coach. Generate high-quality conceptual and application short-answer cards. Return JSON only.",
      },
      {
        role: "user",
        content: `Create ${input.cardCountTarget} cards from the notes below. Output JSON with shape {"cards":[{"prompt":"...","idealAnswer":"...","keyConcepts":["..."],"questionType":"conceptual|application"}]} and no markdown. Deck title: ${input.title}\n\nNotes:\n${input.materialText}`,
      },
    ],
  });

  const parsed = parseModelOutput(
    response.output_text ?? "",
    generatedCardsOutputSchema,
  );

  const applicationNeeded = Math.floor(input.cardCountTarget / 2);
  const currentApplicationCount = parsed.cards.filter(
    (card) => card.questionType === "application",
  ).length;

  if (currentApplicationCount < applicationNeeded) {
    return parsed.cards.map((card, index) => ({
      ...card,
      questionType:
        index % 2 === 1 ? "application" : card.questionType,
    }));
  }

  return parsed.cards;
}

export async function gradeAnswerSemantically(input: {
  prompt: string;
  idealAnswer: string;
  keyConcepts: string[];
  studentAnswer: string;
}): Promise<BaseGradeResult> {
  if (!client) {
    return heuristicGrade(input);
  }

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "Grade semantics, not exact wording. Accept synonyms and paraphrase. Return JSON only.",
      },
      {
        role: "user",
        content: `Evaluate the student response with rubric-based semantic grading. Return JSON shape {"scorePercent":0-100,"missingConcepts":[],"misconceptions":[],"modelAnswer":"...","explanationShort":"..."}.\n\nPrompt: ${input.prompt}\nIdeal answer: ${input.idealAnswer}\nKey concepts: ${input.keyConcepts.join(", ")}\nStudent answer: ${input.studentAnswer}`,
      },
    ],
  });

  return parseModelOutput(response.output_text ?? "", gradeOutputSchema);
}
