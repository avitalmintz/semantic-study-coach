import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { answerRequestSchema } from "@/lib/schemas";
import { requireApiUser } from "@/lib/services/auth";
import { submitAnswerForUser } from "@/lib/services/sessions";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, supabase } = await requireApiUser(
      request.headers.get("authorization"),
    );

    const { sessionId } = await context.params;
    const parsed = answerRequestSchema.parse(await request.json());

    const result = await submitAnswerForUser({
      supabase,
      userId: user.id,
      sessionId,
      cardId: parsed.cardId,
      answerText: parsed.answerText,
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
