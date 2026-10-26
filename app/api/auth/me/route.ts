import { NextResponse } from "next/server";
import { getUser } from "../../../../lib/auth";

export async function GET(req: Request) {
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }
  return NextResponse.json({ email: user.email, role: user.role });
}
