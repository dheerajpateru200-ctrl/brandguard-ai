
import { NextResponse } from "next/server";
import { getUser, adminClient } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";

const ALLOWED = ["approved", "changes_requested", "escalated"];

export async function POST(req: Request) {
  try {
    // Authenticate reviewer or admin.
    const user = await getUser(req);

    if (!user || !["reviewer", "admin"].includes(user.role)) {
      return NextResponse.json(
        { error: "Reviewer or admin access required." },
        { status: 403 }
      );
    }

    // Validate request body.
    const body = await req.json();
    const id = String(body.id || "").trim();
    const decision = String(body.decision || "").trim();
    const comment = String(body.comment || "").trim();

    if (!id || !ALLOWED.includes(decision)) {
      return NextResponse.json(
        { error: "Invalid decision." },
        { status: 400 }
      );
    }

    if (decision !== "approved" && !comment) {
      return NextResponse.json(
        { error: "Add a comment explaining your decision." },
        { status: 400 }
      );
    }

    const db = adminClient();

    // Fetch the submission.
    const { data: review, error: reviewError } = await db
      .from("reviews")
      .select("id, created_by, status")
      .eq("id", id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: "Review not found." },
        { status: 404 }
      );
    }

    // Prevent reviewers and admins from reviewing their own submissions.
    // The created_by column stores the creator's email.
    const creatorEmail = String(review.created_by || "")
      .trim()
      .toLowerCase();

    const reviewerEmail = String(user.email || "")
      .trim()
      .toLowerCase();

    if (creatorEmail && reviewerEmail && creatorEmail === reviewerEmail) {
      return NextResponse.json(
        {
          error: "You cannot review or approve your own submission.",
        },
        { status: 403 }
      );
    }

    // Prevent decisions on already processed submissions.
    if (
      review.status === "approved" ||
      review.status === "changes_requested" ||
      review.status === "escalated"
    ) {
      return NextResponse.json(
        { error: "This review already has a decision." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Update only if the status has not changed since it was fetched.
    const { data: updated, error: updateError } = await db
      .from("reviews")
      .update({
        status: decision,
        decision_comment: comment,
        decided_by: user.id,
        decided_at: now,
      })
      .eq("id", id)
      .eq("status", review.status)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          error: "Unable to update review. It may have changed already.",
        },
        { status: 409 }
      );
    }

    // Record the decision in the audit log.
    try {
      await writeAudit({
        reviewId: id,
        action: decision,
        actor: user.email,
        comment,
      });
    } catch (auditError) {
      console.error("Review decision audit failed:", auditError);

      return NextResponse.json(
        {
          error: "Decision saved, but audit logging failed. Contact an administrator.",
          review: updated,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Review decision error:", error);

    return NextResponse.json(
      { error: "Unable to process review decision." },
      { status: 500 }
    );
  }
}
