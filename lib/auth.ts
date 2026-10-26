import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AppUser = { id: string; email: string; role: "creator" | "reviewer" };

export async function getUser(req: Request): Promise<AppUser | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const db = adminClient();
  const found = await db.auth.getUser(token);
  if (found.error || !found.data.user) return null;

  const profile = await db
    .from("profiles")
    .select("role,email")
    .eq("id", found.data.user.id)
    .single();
  if (profile.error || !profile.data) return null;

  return {
    id: found.data.user.id,
    email: profile.data.email,
    role: profile.data.role === "reviewer" ? "reviewer" : "creator",
  };
}
