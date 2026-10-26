import { NextResponse } from "next/server";
import { adminClient } from "../../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const authClient = adminClient();
  const session = await authClient.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session || !session.data.user) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  const db = adminClient();
  const profile = await db
    .from("profiles")
    .select("role")
    .eq("id", session.data.user.id)
    .single();

  return NextResponse.json({
    access_token: session.data.session.access_token,
    email,
    role: profile.data?.role === "reviewer" ? "reviewer" : "creator",
  });
}
