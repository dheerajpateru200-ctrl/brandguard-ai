
import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";

async function authorize(req: Request) {
  const user = await getUser(req);

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export async function GET(req: Request) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;

  const db = adminClient();

  const { data, error } = await db
    .from("reviewer_requests")
    .select(`
      id,
      user_id,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load reviewer requests." },
      { status: 500 }
    );
  }

  const userIds = [...new Set((data || []).map((r) => r.user_id))];

  const { data: profiles, error: profileError } = userIds.length
    ? await db
        .from("profiles")
        .select("id, email, role")
        .in("id", userIds)
    : { data: [], error: null };

  if (profileError) {
    return NextResponse.json(
      { error: "Could not load requester details." },
      { status: 500 }
    );
  }

  const profileMap = new Map(
    (profiles || []).map((profile) => [profile.id, profile])
  );

  const requests = (data || []).map((request) => ({
    ...request,
    requester: profileMap.get(request.user_id) || null,
  }));

  return NextResponse.json({ requests });
}

export async function PATCH(req: Request) {
  const auth = await authorize(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const id = Number(body.id);
    const decision = String(body.decision || "");

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid request ID." },
        { status: 400 }
      );
    }

    if (!["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "Decision must be approved or rejected." },
        { status: 400 }
      );
    }

    const db = adminClient();

    const { data: request, error: requestError } = await db
      .from("reviewer_requests")
      .select("id, user_id, status")
      .eq("id", id)
      .single();

    if (requestError || !request) {
      return NextResponse.json(
        { error: "Reviewer request not found." },
        { status: 404 }
      );
    }

    if (request.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been reviewed." },
        { status: 409 }
      );
    }

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role")
      .eq("id", request.user_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Requester profile not found." },
        { status: 404 }
      );
    }

    if (profile.role !== "creator") {
      return NextResponse.json(
        {
          error:
            "Only creator accounts can be promoted through this request.",
        },
        { status: 409 }
      );
    }

    if (decision === "approved") {
      const { error: roleError } = await db
        .from("profiles")
        .update({ role: "reviewer" })
        .eq("id", request.user_id)
        .eq("role", "creator");

      if (roleError) {
        return NextResponse.json(
          { error: "Could not update the user's role." },
          { status: 500 }
        );
      }
    }

    const { data: updated, error: updateError } = await db
      .from("reviewer_requests")
      .update({
        status: decision,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        {
          error:
            decision === "approved"
              ? "The role may have been updated, but the request status could not be saved. Check the request before retrying."
              : "Could not save the request decision.",
        },
        { status: 500 }
      );
    }

    try {
      await writeAudit({
        reviewId: null,
        action: `reviewer_request_${decision}`,
        actor: auth.user.email,
        comment: `Reviewer request ${id} ${decision}. User: ${request.user_id}`,
      });
    } catch (auditError) {
      console.error("Reviewer request audit log failed:", auditError);
    }

    return NextResponse.json({
      message:
        decision === "approved"
          ? "Reviewer access approved."
          : "Reviewer access rejected.",
      request: updated,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
