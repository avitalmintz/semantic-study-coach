import { ApiError } from "@/lib/http";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function deleteHistoryForUser(input: {
  supabase: SupabaseClient;
  userId: string;
  deckId?: string;
}): Promise<void> {
  let cardIds: string[] = [];

  if (input.deckId) {
    const { data: cards, error: cardsError } = await input.supabase
      .from("cards")
      .select("id")
      .eq("deck_id", input.deckId)
      .eq("user_id", input.userId);

    if (cardsError) {
      throw new ApiError(500, "Could not load cards for history deletion");
    }

    cardIds = (cards ?? []).map((card: { id: string }) => card.id);
  }

  if (cardIds.length > 0) {
    const { error: attemptsError } = await input.supabase
      .from("attempts")
      .delete()
      .eq("user_id", input.userId)
      .in("card_id", cardIds);

    if (attemptsError) {
      throw new ApiError(500, "Could not delete attempt history");
    }

    const { error: reviewError } = await input.supabase
      .from("review_state")
      .delete()
      .eq("user_id", input.userId)
      .in("card_id", cardIds);

    if (reviewError) {
      throw new ApiError(500, "Could not delete review state");
    }

    return;
  }

  if (!input.deckId) {
    const { error: attemptsError } = await input.supabase
      .from("attempts")
      .delete()
      .eq("user_id", input.userId);

    if (attemptsError) {
      throw new ApiError(500, "Could not delete attempt history");
    }

    const { error: reviewError } = await input.supabase
      .from("review_state")
      .delete()
      .eq("user_id", input.userId);

    if (reviewError) {
      throw new ApiError(500, "Could not delete review state");
    }
  }
}
