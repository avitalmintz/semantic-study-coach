import type { User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/http";
import { createUserSupabase } from "@/lib/supabase/server";

export async function requireApiUser(authHeader: string | null): Promise<{
  user: User;
  supabase: ReturnType<typeof createUserSupabase>;
}> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing Bearer token");
  }

  const supabase = createUserSupabase(authHeader);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiError(401, "Unauthorized");
  }

  return { user: data.user, supabase };
}
