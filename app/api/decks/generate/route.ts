import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { generateDeckRequestSchema } from "@/lib/schemas";
import { requireApiUser } from "@/lib/services/auth";
import { generateDeckForUser } from "@/lib/services/decks";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireApiUser(
      request.headers.get("authorization"),
    );

    const parsed = generateDeckRequestSchema.parse(await request.json());

    const result = await generateDeckForUser({
      supabase,
      userId: user.id,
      materialId: parsed.materialId,
      title: parsed.title,
      cardCountTarget: parsed.cardCountTarget,
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
