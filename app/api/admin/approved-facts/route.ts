
import { NextResponse } from "next/server";
import { adminClient, getUser } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/audit";

async function requireAdmin(req: Request) {
  const user = await getUser(req);

  if (!user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  if (user.role !== "admin") {
    return { error: "Admin access required", status: 403 as const };
  }

  return { user };
}

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;

  const date = new Date(`${value}T00:00:00`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const db = adminClient();

  const { data, error } = await db
    .from("approved_facts")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ facts: data });
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();

    const fact = String(body.fact || "").trim();
    const source = String(body.source || "").trim();
    const owner = String(body.owner || "").trim();
    const expires_on = String(body.expires_on || "").trim();

    if (!fact || !source || !owner || !validDate(expires_on)) {
      return NextResponse.json(
        {
          error: "Fact, source, owner and a valid expiry date are required.",
        },
        { status: 400 }
      );
    }

    const db = adminClient();

    const { data, error } = await db
      .from("approved_facts")
      .insert({
        fact,
        source,
        owner,
        expires_on,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    try {
      await writeAudit({
        action: "approved_fact_created",
        actor: auth.user.email,
        comment: `Created approved fact ID ${data.id}`,
      });
    } catch (auditError) {
      console.error("Approved fact audit failed:", auditError);

      return NextResponse.json(
        {
          error: "Fact was created, but its audit record failed. Contact an administrator.",
          fact: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ fact: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const body = await req.json();
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "A valid fact ID is required." },
        { status: 400 }
      );
    }

    const updates: Record<string, string | boolean> = {};

    if (body.fact !== undefined) {
      const fact = String(body.fact).trim();

      if (!fact) {
        return NextResponse.json(
          { error: "Fact cannot be empty." },
          { status: 400 }
        );
      }

      updates.fact = fact;
    }

    if (body.source !== undefined) {
      const source = String(body.source).trim();

      if (!source) {
        return NextResponse.json(
          { error: "Source cannot be empty." },
          { status: 400 }
        );
      }

      updates.source = source;
    }

    if (body.owner !== undefined) {
      const owner = String(body.owner).trim();

      if (!owner) {
        return NextResponse.json(
          { error: "Owner cannot be empty." },
          { status: 400 }
        );
      }

      updates.owner = owner;
    }

    if (body.expires_on !== undefined) {
      if (!validDate(body.expires_on)) {
        return NextResponse.json(
          { error: "Enter a valid expiry date." },
          { status: 400 }
        );
      }

      updates.expires_on = body.expires_on;
    }

    if (body.is_active !== undefined) {
      if (typeof body.is_active !== "boolean") {
        return NextResponse.json(
          { error: "is_active must be true or false." },
          { status: 400 }
        );
      }

      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided." },
        { status: 400 }
      );
    }

    const db = adminClient();

    const { data, error } = await db
      .from("approved_facts")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Approved fact not found." },
        { status: 404 }
      );
    }

    const action =
      updates.is_active === false
        ? "approved_fact_retired"
        : updates.is_active === true
          ? "approved_fact_reactivated"
          : "approved_fact_updated";

    try {
      await writeAudit({
        action,
        actor: auth.user.email,
        comment: `Updated approved fact ID ${id}`,
      });
    } catch (auditError) {
      console.error("Approved fact audit failed:", auditError);

      return NextResponse.json(
        {
          error: "Fact was updated, but its audit record failed. Contact an administrator.",
          fact: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ fact: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
