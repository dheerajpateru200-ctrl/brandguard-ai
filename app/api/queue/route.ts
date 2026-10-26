import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../lib/auth";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  if (user.role !== "reviewer") {
    return NextResponse.json({ error: "Only reviewers can see the queue." }, { status: 403 });
  }

  const db = adminClient();
  const q = await db
    .from("reviews")
    .select("id,title,content,findings,created_by,created_at")
    .eq("status", "awaiting_approval")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  if (q.error) {
    return NextResponse.json({ error: q.error.message }, { status: 500 });
  }
  return NextResponse.json({ reviews: q.data });
}
