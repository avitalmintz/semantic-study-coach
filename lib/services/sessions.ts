import { gradeAnswerSemantically } from "@/lib/ai";
import { ApiError } from "@/lib/http";
import { calculateNextReview, qualityFromScore } from "@/lib/sm2";
import type { GradeResult } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

interface SessionCardRow {
  id: string;
  prompt: string;
  question_type: "conceptual" | "application";
}

interface ReviewStateRow {
  card_id: string;
  next_review_at: string;
}

interface PreviousReviewStateRow {
  repetition: number;
  interval_days: number;
  ease_factor: number;
}

function pickNextCard(
  cards: SessionCardRow[],
  reviewStateMap: Map<string, ReviewStateRow>,
) {
  const now = Date.now();

  const dueCards = cards.filter((card) => {
    const state = reviewStateMap.get(card.id);
    if (!state) {
      return true;
    }

    return new Date(state.next_review_at).getTime() <= now;
  });

  const orderedDue = dueCards.sort((a, b) => {
    const stateA = reviewStateMap.get(a.id);
    const stateB = reviewStateMap.get(b.id);
    const timeA = stateA?.next_review_at
      ? new Date(stateA.next_review_at).getTime()
      : 0;
    const timeB = stateB?.next_review_at
      ? new Date(stateB.next_review_at).getTime()
      : 0;

    return timeA - timeB;
  });

  if (orderedDue.length > 0) {
    return orderedDue[0];
  }

  return cards
    .slice()
    .sort((a, b) => {
      const stateA = reviewStateMap.get(a.id);
      const stateB = reviewStateMap.get(b.id);
      const timeA = stateA?.next_review_at
        ? new Date(stateA.next_review_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const timeB = stateB?.next_review_at
        ? new Date(stateB.next_review_at).getTime()
        : Number.MAX_SAFE_INTEGER;

      return timeA - timeB;
    })[0];
}

export async function startSessionForUser(input: {
  supabase: SupabaseClient;
  userId: string;
  deckId: string;
}): Promise<{
  sessionId: string;
  firstCard: {
    id: string;
    prompt: string;
    questionType: "conceptual" | "application";
  } | null;
}> {
  const { data: deck, error: deckError } = await input.supabase
    .from("decks")
    .select("id, status")
    .eq("id", input.deckId)
    .eq("user_id", input.userId)
    .single();

  if (deckError || !deck) {
    throw new ApiError(404, "Deck not found");
  }

  if (deck.status !== "published") {
    throw new ApiError(400, "Deck must be published before starting a session");
  }

  const { data: cards, error: cardsError } = await input.supabase
    .from("cards")
    .select("id, prompt, question_type, position")
    .eq("deck_id", input.deckId)
    .eq("user_id", input.userId)
    .order("position", { ascending: true });

  if (cardsError) {
    throw new ApiError(500, "Could not load cards");
  }

  if (!cards || cards.length === 0) {
    throw new ApiError(400, "Deck has no cards");
  }

  const typedCards = (cards ?? []) as SessionCardRow[];
  const cardIds = typedCards.map((card) => card.id);

  const { data: reviewRows, error: reviewError } = await input.supabase
    .from("review_state")
    .select("card_id, next_review_at")
    .eq("user_id", input.userId)
    .in("card_id", cardIds);

  if (reviewError) {
    throw new ApiError(500, "Could not load review state");
  }

  const reviewMap = new Map<string, ReviewStateRow>();
  for (const row of (reviewRows ?? []) as ReviewStateRow[]) {
    reviewMap.set(row.card_id, row);
  }

  const firstCard = pickNextCard(typedCards, reviewMap);

  const { data: session, error: sessionError } = await input.supabase
    .from("sessions")
    .insert({
      user_id: input.userId,
      deck_id: input.deckId,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new ApiError(500, "Failed to start session");
  }

  return {
    sessionId: session.id,
    firstCard: firstCard
      ? {
          id: firstCard.id,
          prompt: firstCard.prompt,
          questionType: firstCard.question_type,
        }
      : null,
  };
}

export async function submitAnswerForUser(input: {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  cardId: string;
  answerText: string;
}): Promise<GradeResult> {
  const { data: session, error: sessionError } = await input.supabase
    .from("sessions")
    .select("id, deck_id")
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .single();

  if (sessionError || !session) {
    throw new ApiError(404, "Study session not found");
  }

  const { data: card, error: cardError } = await input.supabase
    .from("cards")
    .select("id, prompt, ideal_answer, key_concepts")
    .eq("id", input.cardId)
    .eq("deck_id", session.deck_id)
    .eq("user_id", input.userId)
    .single();

  if (cardError || !card) {
    throw new ApiError(404, "Card not found in this deck");
  }

  const graded = await gradeAnswerSemantically({
    prompt: card.prompt,
    idealAnswer: card.ideal_answer,
    keyConcepts: card.key_concepts,
    studentAnswer: input.answerText,
  });

  const quality = qualityFromScore(graded.scorePercent);

  const { data: previousReview } = await input.supabase
    .from("review_state")
    .select("repetition, interval_days, ease_factor")
    .eq("user_id", input.userId)
    .eq("card_id", card.id)
    .maybeSingle();

  const typedPrevious = previousReview as PreviousReviewStateRow | null;

  const nextReview = calculateNextReview({
    previous: typedPrevious
      ? {
          repetition: typedPrevious.repetition,
          intervalDays: typedPrevious.interval_days,
          easeFactor: typedPrevious.ease_factor,
        }
      : undefined,
    quality,
    scorePercent: graded.scorePercent,
  });

  const { error: reviewError } = await input.supabase
    .from("review_state")
    .upsert(
      {
        user_id: input.userId,
        card_id: card.id,
        repetition: nextReview.repetition,
        interval_days: nextReview.intervalDays,
        ease_factor: nextReview.easeFactor,
        next_review_at: nextReview.nextReviewAt,
        last_quality: nextReview.lastQuality,
      },
      { onConflict: "user_id,card_id" },
    );

  if (reviewError) {
    throw new ApiError(500, "Failed to update review state");
  }

  const { error: attemptError } = await input.supabase
    .from("attempts")
    .insert({
      user_id: input.userId,
      session_id: input.sessionId,
      card_id: card.id,
      answer_text: input.answerText,
      score_percent: graded.scorePercent,
      quality,
      missing_concepts: graded.missingConcepts,
      misconceptions: graded.misconceptions,
      model_answer: graded.modelAnswer,
      explanation_short: graded.explanationShort,
      created_at: new Date().toISOString(),
    });

  if (attemptError) {
    throw new ApiError(500, "Failed to save attempt");
  }

  return {
    scorePercent: graded.scorePercent,
    quality,
    missingConcepts: graded.missingConcepts,
    misconceptions: graded.misconceptions,
    modelAnswer: graded.modelAnswer,
    explanationShort: graded.explanationShort,
    nextReviewAt: nextReview.nextReviewAt,
  };
}
