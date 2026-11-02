
import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";

async function requireAdmin(req: Request) {
  const user = await getUser(req);

  if (!user) {
    return { error: "Not logged in.", status: 401 as const };
  }

  if (user.role !== "admin") {
    return { error: "Admin access required.", status: 403 as const };
  }

  return { user };
}

// GET: List all banned terms.
export async function GET(req: Request) {
  const access = await requireAdmin(req);

  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  const db = adminClient();
  const result = await db
    .from("banned_terms")
    .select("*")
    .order("id", { ascending: true });

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ terms: result.data });
}

// POST: Add a banned term.
export async function POST(req: Request) {
  const access = await requireAdmin(req);

  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const term = String(body.term || "").trim();
  const reason = String(body.reason || "").trim();
  const suggestion = String(body.suggestion || "").trim();
  const severity = String(body.severity || "medium");

  if (!term || !reason) {
    return NextResponse.json(
      { error: "Term and reason are required." },
      { status: 400 }
    );
  }

  if (!["high", "medium", "low"].includes(severity)) {
    return NextResponse.json(
      { error: "Invalid severity." },
      { status: 400 }
    );
  }

  const db = adminClient();

  const inserted = await db
    .from("banned_terms")
    .insert({
      term,
      reason,
      suggestion: suggestion || null,
      severity,
      is_active: true,
    })
    .select()
    .single();

  if (inserted.error) {
    return NextResponse.json(
      { error: inserted.error.message },
      { status: 500 }
    );
  }

  try {
    await writeAudit({
      action: "banned_term_created",
      actor: access.user.email,
      comment: `Added banned term: ${term}`,
    });
  } catch (error) {
    console.error("Audit logging failed:", error);
    return NextResponse.json(
      {
        term: inserted.data,
        warning: "Term was saved, but its audit entry failed.",
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    { term: inserted.data },
    { status: 201 }
  );
}

// PATCH: Edit or retire a banned term.
export async function PATCH(req: Request) {
  const access = await requireAdmin(req);

  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const id = Number(body.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "A valid term ID is required." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.term === "string") {
    const value = body.term.trim();
    if (!value) {
      return NextResponse.json(
        { error: "Term cannot be empty." },
        { status: 400 }
      );
    }
    updates.term = value;
  }

  if (typeof body.reason === "string") {
    const value = body.reason.trim();
    if (!value) {
      return NextResponse.json(
        { error: "Reason cannot be empty." },
        { status: 400 }
      );
    }
    updates.reason = value;
  }

  if (typeof body.suggestion === "string") {
    updates.suggestion = body.suggestion.trim() || null;
  }

  if (typeof body.severity === "string") {
    if (!["high", "medium", "low"].includes(body.severity)) {
      return NextResponse.json(
        { error: "Invalid severity." },
        { status: 400 }
      );
    }
    updates.severity = body.severity;
  }

  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid changes provided." },
      { status: 400 }
    );
  }

  const db = adminClient();

  const updated = await db
    .from("banned_terms")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updated.error) {
    return NextResponse.json(
      { error: updated.error.message },
      { status: 500 }
    );
  }

  try {
    await writeAudit({
      action: updates.is_active === false
        ? "banned_term_retired"
        : "banned_term_updated",
      actor: access.user.email,
      comment: `Updated banned term ID ${id}: ${JSON.stringify(updates)}`,
    });
  } catch (error) {
    console.error("Audit logging failed:", error);
    return NextResponse.json(
      {
        term: updated.data,
        warning: "Term was updated, but its audit entry failed.",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ term: updated.data });
}
