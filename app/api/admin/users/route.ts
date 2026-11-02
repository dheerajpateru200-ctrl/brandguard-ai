
import { NextResponse } from "next/server";
import { getUser, adminClient } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";

const allowedRoles = ["creator", "reviewer", "admin"];

export async function GET(req: Request) {
  const user = await getUser(req);

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  const db = adminClient();

  const { data, error } = await db
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: data || [] });
}

export async function PATCH(req: Request) {
  const admin = await getUser(req);

  if (!admin || admin.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const userId = String(body.userId || "");
    const role = String(body.role || "");

    if (!userId || !allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid user ID or role." },
        { status: 400 }
      );
    }

    if (userId === admin.id) {
      return NextResponse.json(
        { error: "You cannot change your own role." },
        { status: 400 }
      );
    }

    const db = adminClient();

    const { data: target, error: targetError } = await db
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    if (target.role === role) {
      return NextResponse.json({
        message: "Role is already assigned.",
      });
    }

    // Prevent removing the final administrator.
    if (target.role === "admin" && role !== "admin") {
      const { count, error: countError } = await db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        console.error("Could not count administrators:", countError);

        return NextResponse.json(
          { error: "Could not verify administrator count." },
          { status: 500 }
        );
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              "Cannot remove the last administrator. Assign another administrator first.",
          },
          { status: 409 }
        );
      }
    }

    const { error: updateError } = await db
      .from("profiles")
      .update({ role })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    try {
      await writeAudit({
        reviewId: null,
        action: "USER_ROLE_CHANGED",
        actor: admin.email,
        comment: `Changed ${target.email} role from ${target.role} to ${role}`,
      });
    } catch (auditError) {
      console.error("Role change audit failed:", auditError);
    }

    return NextResponse.json({
      message: "User role updated successfully.",
      user: {
        id: userId,
        email: target.email,
        role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
