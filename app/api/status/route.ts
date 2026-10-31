import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/youcam/client";

export async function GET() {
  return NextResponse.json({ demo: isDemoMode(), agent: Boolean(process.env.ANTHROPIC_API_KEY) });
}
