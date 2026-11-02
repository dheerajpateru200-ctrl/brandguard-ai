
import { NextResponse } from "next/server";
import { getUser, adminClient } from "../../../../lib/auth";

const FINAL_STATUSES = [
  "approved",
  "changes_requested",
  "escalated",
];

export async function GET(req: Request) {
  try {
    const user = await getUser(req);

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const db = adminClient();

    let reviewsQuery = db
      .from("reviews")
      .select(
        "id, status, findings, created_by, created_at, decided_at, decided_by"
      );

    let auditQuery = db
      .from("audit_log")
      .select("review_id, action, actor, created_at");

    if (from) {
      reviewsQuery = reviewsQuery.gte("created_at", from);
      auditQuery = auditQuery.gte("created_at", from);
    }

    if (to) {
      reviewsQuery = reviewsQuery.lte("created_at", to);
      auditQuery = auditQuery.lte("created_at", to);
    }

    const [
      { data: reviews, error: reviewsError },
      { data: audit, error: auditError },
    ] = await Promise.all([reviewsQuery, auditQuery]);

    if (reviewsError || auditError) {
      console.error("Insights query error:", reviewsError || auditError);
      return NextResponse.json(
        { error: "Unable to load analytics." },
        { status: 500 }
      );
    }

    const rows = reviews || [];
    const auditRows = audit || [];

    const statusCounts: Record<string, number> = {
      pending: 0,
      approved: 0,
      changes_requested: 0,
      escalated: 0,
    };

    for (const review of rows) {
      const status = String(review.status || "pending");
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    const decidedCount = FINAL_STATUSES.reduce(
      (sum, status) => sum + (statusCounts[status] || 0),
      0
    );

    const dailyMap = new Map<
      string,
      { date: string; submissions: number; decisions: number }
    >();

    for (const review of rows) {
      const date = String(review.created_at).slice(0, 10);
      const entry = dailyMap.get(date) || {
        date,
        submissions: 0,
        decisions: 0,
      };
      entry.submissions++;
      dailyMap.set(date, entry);
    }

    for (const event of auditRows) {
      const date = String(event.created_at).slice(0, 10);
      const entry = dailyMap.get(date) || {
        date,
        submissions: 0,
        decisions: 0,
      };

      if (FINAL_STATUSES.includes(String(event.action))) {
        entry.decisions++;
      }

      dailyMap.set(date, entry);
    }

    const findingCounts = new Map<string, number>();

    for (const review of rows) {
      const findings = Array.isArray(review.findings)
        ? review.findings
        : [];

      for (const finding of findings) {
        const label =
          typeof finding === "string"
            ? finding
            : finding?.title || finding?.category || finding?.type;

        if (label && typeof label === "string") {
          findingCounts.set(
            label,
            (findingCounts.get(label) || 0) + 1
          );
        }
      }
    }

    const reviewerCounts = new Map<string, number>();

    for (const event of auditRows) {
      if (!FINAL_STATUSES.includes(String(event.action))) continue;

      const actor = String(event.actor || "Unknown");
      reviewerCounts.set(actor, (reviewerCounts.get(actor) || 0) + 1);
    }

    return NextResponse.json({
      summary: {
        totalSubmissions: rows.length,
        pending: statusCounts.pending || 0,
        approved: statusCounts.approved || 0,
        changesRequested: statusCounts.changes_requested || 0,
        escalated: statusCounts.escalated || 0,
        decided: decidedCount,
        approvalRate:
          decidedCount > 0
            ? Number(
                ((statusCounts.approved / decidedCount) * 100).toFixed(1)
              )
            : 0,
      },
      dailyActivity: Array.from(dailyMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
      topFindings: Array.from(findingCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      reviewerActivity: Array.from(reviewerCounts.entries())
        .map(([reviewer, decisions]) => ({ reviewer, decisions }))
        .sort((a, b) => b.decisions - a.decisions),
    });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json(
      { error: "Unable to load insights." },
      { status: 500 }
    );
  }
}
