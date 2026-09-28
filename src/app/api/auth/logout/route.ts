import { NextResponse } from "next/server";
import { authorize, respond } from "@/lib/http";
import { signOut } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await authorize(request, () => true, true);
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (error) { return respond(error); }
}
