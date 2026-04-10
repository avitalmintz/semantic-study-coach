import type { ReviewState } from "@/lib/types";

const MIN_EASE_FACTOR = 1.3;
const INITIAL_EASE_FACTOR = 2.5;

export function qualityFromScore(scorePercent: number): 1 | 2 | 3 | 4 | 5 {
  if (scorePercent >= 90) return 5;
  if (scorePercent >= 75) return 4;
  if (scorePercent >= 60) return 3;
  if (scorePercent >= 40) return 2;
  return 1;
}

interface NextReviewInput {
  previous?: {
    repetition: number;
    intervalDays: number;
    easeFactor: number;
  };
  quality: 1 | 2 | 3 | 4 | 5;
  scorePercent: number;
  now?: Date;
}

export function calculateNextReview(input: NextReviewInput): ReviewState {
  const now = input.now ?? new Date();
  const previous = input.previous;
  const quality = input.quality;
  const scorePercent = input.scorePercent;

  const priorRepetition = previous?.repetition ?? 0;
  const priorInterval = previous?.intervalDays ?? 0;
  const priorEase = previous?.easeFactor ?? INITIAL_EASE_FACTOR;

  let repetition = priorRepetition;
  let intervalDays = priorInterval;
  let easeFactor = priorEase;

  if (quality < 3) {
    repetition = 0;
    intervalDays = scorePercent < 40 ? 0 : 1;
  } else {
    repetition = priorRepetition + 1;

    if (repetition === 1) {
      intervalDays = 1;
    } else if (repetition === 2) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(1, Math.round(priorInterval * priorEase));
    }

    const efDelta =
      0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    easeFactor = Math.max(MIN_EASE_FACTOR, priorEase + efDelta);
  }

  const nextReviewAt = new Date(now);
  if (quality < 3 && scorePercent < 40) {
    nextReviewAt.setHours(nextReviewAt.getHours() + 4);
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);
  }

  return {
    repetition,
    intervalDays,
    easeFactor,
    nextReviewAt: nextReviewAt.toISOString(),
    lastQuality: quality,
  };
}
