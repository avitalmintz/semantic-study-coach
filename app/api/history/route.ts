import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { requireApiUser } from "@/lib/services/auth";
import { deleteHistoryForUser } from "@/lib/services/history";

export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await requireApiUser(
      request.headers.get("authorization"),
    );

    const body = await request.json().catch(() => ({}));
    const deckId = typeof body.deckId === "string" ? body.deckId : undefined;

    await deleteHistoryForUser({
      supabase,
      userId: user.id,
      deckId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
