import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { ingestRequestSchema } from "@/lib/schemas";
import { requireApiUser } from "@/lib/services/auth";
import { ingestMaterialForUser } from "@/lib/services/materials";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireApiUser(
      request.headers.get("authorization"),
    );

    const parsed = ingestRequestSchema.parse(await request.json());

    const result = await ingestMaterialForUser({
      supabase,
      userId: user.id,
      sourceType: parsed.sourceType,
      text: parsed.text,
      fileId: parsed.fileId,
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
