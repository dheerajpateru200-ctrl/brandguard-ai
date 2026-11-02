
import { adminClient } from "./auth";

type AuditInput = {
  reviewId?: string | null;
  action: string;
  actor: string;
  comment?: string | null;
};

export async function writeAudit(input: AuditInput) {
  const db = adminClient();

  const { data, error } = await db
    .from("audit_log")
    .insert({
      review_id: input.reviewId ?? null,
      action: input.action,
      actor: input.actor,
      comment: input.comment ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Audit logging failed:", error.message);
    throw new Error(`Audit logging failed: ${error.message}`);
  }

  return data;
}
