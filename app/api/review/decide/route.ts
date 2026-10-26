import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED = ["approved", "changes_requested", "escalated"];

export async function POST(req: Request) {
  const body = await req.json();
  const id = String(body.id || "");
  const decision = String(body.decision || "");
  const comment = String(body.comment || "");
  const actor = String(body.actor || "reviewer");

  if (!id || !ALLOWED.includes(decision)) {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }
  if (decision !== "approved" && !comment.trim()) {
    return NextResponse.json(
      { error: "Add a comment explaining your decision." },
      { status: 400 }
    );
  }

  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const upd = await db
    .from("reviews")
    .update({
      status: decision,
      decision_comment: comment,
      decided_by: actor,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (upd.error) {
    return NextResponse.json({ error: upd.error.message }, { status: 500 });
  }

  await db.from("audit_log").insert({ review_id: id, action: decision, actor, comment });
  return NextResponse.json(upd.data);
}
