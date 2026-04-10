import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { patchCardsRequestSchema } from "@/lib/schemas";
import { requireApiUser } from "@/lib/services/auth";
import { updateDeckCardsForUser } from "@/lib/services/decks";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ deckId: string }> },
) {
  try {
    const { user, supabase } = await requireApiUser(
      request.headers.get("authorization"),
    );

    const { deckId } = await context.params;
    const parsed = patchCardsRequestSchema.parse(await request.json());

    const result = await updateDeckCardsForUser({
      supabase,
      userId: user.id,
      deckId,
      cards: parsed.cards,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 },
      );
    }

    return jsonError(error);
  }
}
