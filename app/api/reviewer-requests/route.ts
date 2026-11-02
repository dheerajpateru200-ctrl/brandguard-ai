
import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const db = adminClient();

    const { data, error } = await db
      .from("reviewer_requests")
      .select("id, reason, status, created_at, reviewed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: data || [] });
  } catch {
    return NextResponse.json(
      { error: "Could not load reviewer requests." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (user.role !== "creator") {
      return NextResponse.json(
        { error: "Only Creator accounts can request Reviewer access." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const reason = String(body.reason || "").trim();

    if (reason.length < 20 || reason.length > 1000) {
      return NextResponse.json(
        { error: "Explain why you need Reviewer access (20–1000 characters)." },
        { status: 400 }
      );
    }

    const db = adminClient();

    const existing = await db
      .from("reviewer_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (existing.error) {
      return NextResponse.json(
        { error: existing.error.message },
        { status: 500 }
      );
    }

    if (existing.data && existing.data.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending Reviewer access request." },
        { status: 409 }
      );
    }

    const { data, error } = await db
      .from("reviewer_requests")
      .insert({
        user_id: user.id,
        reason,
        status: "pending",
      })
      .select("id, reason, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Reviewer access request submitted successfully.",
        request: data,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid reviewer request." },
      { status: 400 }
    );
  }
}
