import { NextResponse } from "next/server";
import { mockPracticeContext } from "@/lib/practice-context";

// TODO: replace with Dentally sandbox call (GET /v1/appointments/availability)
// Real Dentally integration ships post-hackathon.

type SlotQuery = {
  practitioner?: string;
  date?: string; // YYYY-MM-DD
};

function generateSlotsForDate(date: string): string[] {
  const base = ["09:00", "09:30", "10:00", "11:30", "13:00", "14:30", "15:00", "16:00", "16:30"];
  // Deterministically drop a couple based on the date so different days look different.
  const seed = date.split("-").reduce((acc, n) => acc + Number(n), 0);
  return base.filter((_, i) => (i + seed) % 4 !== 0);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q: SlotQuery = {
    practitioner: url.searchParams.get("practitioner") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
  };

  const date = q.date ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const practitioner =
    q.practitioner ?? mockPracticeContext.practitioners[0]!.name;

  const slots = generateSlotsForDate(date).map((time) => ({
    practitioner,
    date,
    time,
    durationMinutes: 30,
  }));

  return NextResponse.json({
    practitioner,
    date,
    slots,
    source: "stub",
  });
}
