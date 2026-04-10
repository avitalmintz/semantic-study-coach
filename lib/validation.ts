import { ZodError } from "zod";

import { ApiError } from "@/lib/http";

export function throwIfInvalid(error: unknown): never {
  if (error instanceof ZodError) {
    throw new ApiError(400, error.issues.map((issue) => issue.message).join("; "));
  }

  throw error;
}
