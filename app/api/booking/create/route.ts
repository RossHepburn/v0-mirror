import { NextResponse } from "next/server";
import { createBooking, type BookingRequest } from "@/lib/booking";

export async function POST(req: Request) {
  const body = (await req.json()) as BookingRequest;
  const result = await createBooking(body);
  return NextResponse.json(result);
}
