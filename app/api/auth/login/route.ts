
import { NextResponse } from "next/server";
import { adminClient } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const authClient = adminClient();

    const session = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (
      session.error ||
      !session.data.session ||
      !session.data.user
    ) {
      return NextResponse.json(
        { error: "Wrong email or password." },
        { status: 401 }
      );
    }

    const db = adminClient();

    const profile = await db
      .from("profiles")
      .select("role,email")
      .eq("id", session.data.user.id)
      .single();

    if (profile.error || !profile.data) {
      return NextResponse.json(
        { error: "User profile not found." },
        { status: 403 }
      );
    }

    const role = profile.data.role;

    if (!["creator", "reviewer", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid user role." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      access_token: session.data.session.access_token,
      email: profile.data.email,
      role,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to process login." },
      { status: 500 }
    );
  }
}
