import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { startSessionSchema } from "@/lib/schemas";
import { requireApiUser } from "@/lib/services/auth";
import { startSessionForUser } from "@/lib/services/sessions";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireApiUser(
      request.headers.get("authorization"),
    );

    const parsed = startSessionSchema.parse(await request.json());

    const result = await startSessionForUser({
      supabase,
      userId: user.id,
      deckId: parsed.deckId,
    });

    return NextResponse.json(result, { status: 201 });
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
