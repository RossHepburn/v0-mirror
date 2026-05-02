import { NextResponse } from "next/server";

// TODO: replace with Dentally sandbox call (POST /v1/appointments)
// Real Dentally integration ships post-hackathon. The shape below should
// remain compatible with whatever the chatbot's book_appointment tool sends.

type BookingRequest = {
  practitioner: string;
  date: string;
  time: string;
  patientName: string;
  patientContact: string;
  treatment?: string;
};

function makeReference(): string {
  const slug = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KW-${slug}`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as BookingRequest;

  console.log(
    `[booking-stub] would book in Dentally as:`,
    JSON.stringify(
      {
        practitioner: body.practitioner,
        time: `${body.date} ${body.time}`,
        patient: { name: body.patientName, contact: body.patientContact },
        treatment: body.treatment,
      },
      null,
      2,
    ),
  );

  const reference = makeReference();

  return NextResponse.json({
    ok: true,
    reference,
    confirmedAt: new Date().toISOString(),
    appointment: {
      practitioner: body.practitioner,
      date: body.date,
      time: body.time,
      treatment: body.treatment ?? "Consultation",
      durationMinutes: 30,
    },
    patient: {
      name: body.patientName,
      contact: body.patientContact,
    },
    source: "stub",
  });
}
