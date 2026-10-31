import { NextResponse } from "next/server";
import { hasClaude } from "@/lib/claude";
import { direct, directOffline } from "@/lib/director";
import type { Production } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { production?: Production; message?: string; history?: { role: "user" | "assistant"; text: string }[] };
    if (!body.production || !body.message?.trim()) {
      return NextResponse.json({ error: "bad_request", message: "production and message are required" }, { status: 400 });
    }
    const message = body.message.slice(0, 2000);
    const result = hasClaude() ? await direct(body.production, message, body.history ?? []) : directOffline(body.production, message);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "director_error", message: "The director is busy. Try again in a moment." }, { status: 502 });
  }
}
