import { generateCardsFromMaterial } from "@/lib/ai";
import { ApiError } from "@/lib/http";
import { chunkTextForGeneration, normalizeStudyText } from "@/lib/text";
import type { GeneratedCard } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateDeckForUser(input: {
  supabase: SupabaseClient;
  userId: string;
  materialId: string;
  title: string;
  cardCountTarget: number;
}): Promise<{ deckId: string; cards: GeneratedCard[] }> {
  const { data: material, error: materialError } = await input.supabase
    .from("materials")
    .select("id, raw_text")
    .eq("id", input.materialId)
    .eq("user_id", input.userId)
    .single();

  if (materialError || !material) {
    throw new ApiError(404, "Material not found");
  }

  const sourceChunks = chunkTextForGeneration(material.raw_text);
  const condensedSource = normalizeStudyText(sourceChunks.slice(0, 4).join("\n\n"));

  const generatedCards = await generateCardsFromMaterial({
    title: input.title,
    materialText: condensedSource,
    cardCountTarget: input.cardCountTarget,
  });

  const { data: deck, error: deckError } = await input.supabase
    .from("decks")
    .insert({
      user_id: input.userId,
      material_id: input.materialId,
      title: input.title,
      status: "draft",
    })
    .select("id")
    .single();

  if (deckError || !deck) {
    throw new ApiError(500, "Failed to create deck");
  }

  const cardsPayload = generatedCards.map((card, index) => ({
    user_id: input.userId,
    deck_id: deck.id,
    prompt: card.prompt,
    ideal_answer: card.idealAnswer,
    key_concepts: card.keyConcepts,
    question_type: card.questionType,
    position: index,
  }));

  const { error: cardError } = await input.supabase
    .from("cards")
    .insert(cardsPayload);

  if (cardError) {
    throw new ApiError(500, "Failed to save generated cards");
  }

  return {
    deckId: deck.id,
    cards: generatedCards,
  };
}

export async function updateDeckCardsForUser(input: {
  supabase: SupabaseClient;
  userId: string;
  deckId: string;
  cards: GeneratedCard[];
}): Promise<{ cards: GeneratedCard[] }> {
  const { data: deck, error: deckError } = await input.supabase
    .from("decks")
    .select("id")
    .eq("id", input.deckId)
    .eq("user_id", input.userId)
    .single();

  if (deckError || !deck) {
    throw new ApiError(404, "Deck not found");
  }

  const { error: deleteError } = await input.supabase
    .from("cards")
    .delete()
    .eq("deck_id", input.deckId)
    .eq("user_id", input.userId);

  if (deleteError) {
    throw new ApiError(500, "Failed to clear existing cards");
  }

  const payload = input.cards.map((card, index) => ({
    user_id: input.userId,
    deck_id: input.deckId,
    prompt: card.prompt,
    ideal_answer: card.idealAnswer,
    key_concepts: card.keyConcepts,
    question_type: card.questionType,
    position: index,
  }));

  const { error: insertError } = await input.supabase
    .from("cards")
    .insert(payload);

  if (insertError) {
    throw new ApiError(500, "Failed to persist edited cards");
  }

  const { error: publishError } = await input.supabase
    .from("decks")
    .update({ status: "published" })
    .eq("id", input.deckId)
    .eq("user_id", input.userId);

  if (publishError) {
    throw new ApiError(500, "Failed to publish deck");
  }

  return { cards: input.cards };
}
