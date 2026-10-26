import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  const terms = await supabase.from("banned_terms").select("term");
  const facts = await supabase.from("approved_facts").select("fact");
  const error = terms.error || facts.error;
  if (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    status: "ok",
    banned_terms: terms.data?.length ?? "no data",
    approved_facts: facts.data?.length ?? "no data",
  });
}
