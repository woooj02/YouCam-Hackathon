import { NextResponse } from "next/server";
import { getCredits, isDemoMode } from "@/lib/youcam/client";
import { findBalance } from "@/lib/youcam/result";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

/** The account's live unit balance, so the studio shows real spend, not just estimates. */
export async function GET() {
  try {
    if (isDemoMode()) return NextResponse.json({ balance: null, demo: true });
    return NextResponse.json({ balance: findBalance(await getCredits()) ?? null, demo: false });
  } catch (err) {
    return errorResponse(err);
  }
}
