import { describe, expect, it } from "vitest";

import { calculateNextReview, qualityFromScore } from "@/lib/sm2";

describe("SM-2 scheduling", () => {
  it("maps score ranges to quality", () => {
    expect(qualityFromScore(95)).toBe(5);
    expect(qualityFromScore(80)).toBe(4);
    expect(qualityFromScore(65)).toBe(3);
    expect(qualityFromScore(45)).toBe(2);
    expect(qualityFromScore(10)).toBe(1);
  });

  it("sets first intervals to 1 then 3 days for passing scores", () => {
    const first = calculateNextReview({ quality: 5, scorePercent: 95, now: new Date("2026-01-01T00:00:00Z") });
    expect(first.repetition).toBe(1);
    expect(first.intervalDays).toBe(1);

    const second = calculateNextReview({
      previous: {
        repetition: first.repetition,
        intervalDays: first.intervalDays,
        easeFactor: first.easeFactor,
      },
      quality: 4,
      scorePercent: 80,
      now: new Date("2026-01-02T00:00:00Z"),
    });

    expect(second.repetition).toBe(2);
    expect(second.intervalDays).toBe(3);
  });

  it("resets repetition and retries quickly for failing scores", () => {
    const result = calculateNextReview({
      previous: {
        repetition: 3,
        intervalDays: 10,
        easeFactor: 2.4,
      },
      quality: 1,
      scorePercent: 20,
      now: new Date("2026-01-10T00:00:00Z"),
    });

    expect(result.repetition).toBe(0);
    expect(result.intervalDays).toBe(0);
    expect(new Date(result.nextReviewAt).getTime()).toBe(
      new Date("2026-01-10T04:00:00Z").getTime(),
    );
  });
});
