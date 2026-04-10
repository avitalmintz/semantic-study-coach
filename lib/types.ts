export type SourceType = "text" | "pdf";

export type QuestionType = "conceptual" | "application";

export interface GeneratedCard {
  prompt: string;
  idealAnswer: string;
  keyConcepts: string[];
  questionType: QuestionType;
}

export interface GradeResult {
  scorePercent: number;
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  missingConcepts: string[];
  misconceptions: string[];
  modelAnswer: string;
  explanationShort: string;
  nextReviewAt: string;
}

export interface BaseGradeResult {
  scorePercent: number;
  missingConcepts: string[];
  misconceptions: string[];
  modelAnswer: string;
  explanationShort: string;
}

export interface ReviewState {
  repetition: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: string;
  lastQuality: number;
}
