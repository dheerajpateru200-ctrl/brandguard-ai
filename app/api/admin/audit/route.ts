
import { NextResponse } from "next/server";
import {
  getUser,
  requireAdmin,
  adminClient,
} from "../../../../lib/auth";

export async function GET(req: Request) {
  try {
    // Authenticate the request.
    const user = await getUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Allow only administrators.
    if (!requireAdmin(user)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Fetch audit logs.
    const db = adminClient();

    const { data, error } = await db
      .from("audit_log")
      .select(
        "id, review_id, action, actor, comment, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error(
        "Audit log fetch failed:",
        error.message
      );

      return NextResponse.json(
        { error: "Unable to fetch audit logs" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { logs: data ?? [] },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Audit API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
