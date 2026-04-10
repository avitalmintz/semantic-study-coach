import { describe, expect, it } from "vitest";

import { calculateNextReview, qualityFromScore } from "@/lib/sm2";

describe("multi-answer progression", () => {
  it("updates interval growth across repeated answers on one card", () => {
    const first = calculateNextReview({
      quality: qualityFromScore(92),
      scorePercent: 92,
      now: new Date("2026-02-01T00:00:00Z"),
    });

    const second = calculateNextReview({
      previous: {
        repetition: first.repetition,
        intervalDays: first.intervalDays,
        easeFactor: first.easeFactor,
      },
      quality: qualityFromScore(79),
      scorePercent: 79,
      now: new Date("2026-02-02T00:00:00Z"),
    });

    const third = calculateNextReview({
      previous: {
        repetition: second.repetition,
        intervalDays: second.intervalDays,
        easeFactor: second.easeFactor,
      },
      quality: qualityFromScore(88),
      scorePercent: 88,
      now: new Date("2026-02-05T00:00:00Z"),
    });

    expect(first.intervalDays).toBe(1);
    expect(second.intervalDays).toBe(3);
    expect(third.intervalDays).toBeGreaterThanOrEqual(7);
    expect(third.repetition).toBe(3);
  });

  it("resets repetition after low semantic score", () => {
    const reset = calculateNextReview({
      previous: {
        repetition: 4,
        intervalDays: 16,
        easeFactor: 2.6,
      },
      quality: qualityFromScore(30),
      scorePercent: 30,
      now: new Date("2026-02-10T10:00:00Z"),
    });

    expect(reset.repetition).toBe(0);
    expect(reset.intervalDays).toBe(0);
  });
});
