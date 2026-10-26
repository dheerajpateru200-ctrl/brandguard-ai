import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const reviews = await db
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  const audit = await db
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: true });
  const error = reviews.error || audit.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reviews: reviews.data, audit: audit.data });
}
