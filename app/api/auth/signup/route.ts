import { NextResponse } from "next/server";
import { adminClient } from "../../../../lib/auth";

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 }
    );
  }

  const db = adminClient();
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    return NextResponse.json(
      { error: created.error?.message || "Could not create the account." },
      { status: 400 }
    );
  }

  const inserted = await db
    .from("profiles")
    .insert({ id: created.data.user.id, email, role: "creator" });
  if (inserted.error) {
    await db.auth.admin.deleteUser(created.data.user.id);
    return NextResponse.json({ error: inserted.error.message }, { status: 500 });
  }

  const authClient = adminClient();
  const session = await authClient.auth.signInWithPassword({ email, password });
  if (session.error || !session.data.session) {
    return NextResponse.json({ error: "Account created. Please log in." }, { status: 500 });
  }

  return NextResponse.json({
    access_token: session.data.session.access_token,
    email,
    role: "creator",
  });
}
