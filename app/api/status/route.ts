import { NextResponse } from "next/server";
import { hasLLM } from "@/lib/ai";
import { isDemoMode } from "@/lib/youcam/client";

export async function GET() {
  return NextResponse.json({ demo: isDemoMode(), agent: hasLLM() });
}
