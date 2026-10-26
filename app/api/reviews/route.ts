import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../lib/auth";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const db = adminClient();
  let q = db
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (user.role !== "reviewer") {
    q = q.eq("created_by", user.email);
  }
  const reviews = await q;
  if (reviews.error) {
    return NextResponse.json({ error: reviews.error.message }, { status: 500 });
  }

  const ids = (reviews.data ?? []).map((r) => r.id);
  let audit: unknown[] = [];
  if (ids.length > 0) {
    const a = await db
      .from("audit_log")
      .select("*")
      .in("review_id", ids)
      .order("created_at", { ascending: true });
    if (a.error) {
      return NextResponse.json({ error: a.error.message }, { status: 500 });
    }
    audit = a.data ?? [];
  }
  return NextResponse.json({ reviews: reviews.data, audit });
}
