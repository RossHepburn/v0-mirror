// TODO: replace with Dentally sandbox call (POST /v1/appointments).
// Real Dentally integration ships post-hackathon. The shape below should
// remain compatible with whatever the chatbot's book_appointment tool sends.

export type BookingRequest = {
  practitioner: string;
  date: string;
  time: string;
  patientName: string;
  patientContact: string;
  treatment?: string;
};

export type BookingResult = {
  ok: true;
  reference: string;
  confirmedAt: string;
  appointment: {
    practitioner: string;
    date: string;
    time: string;
    treatment: string;
    durationMinutes: number;
  };
  patient: { name: string; contact: string };
  source: "stub";
};

function makeReference(): string {
  const slug = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KW-${slug}`;
}

export async function createBooking(req: BookingRequest): Promise<BookingResult> {
  console.log(
    `[booking-stub] would book in Dentally as:`,
    JSON.stringify(
      {
        practitioner: req.practitioner,
        time: `${req.date} ${req.time}`,
        patient: { name: req.patientName, contact: req.patientContact },
        treatment: req.treatment,
      },
      null,
      2,
    ),
  );

  return {
    ok: true,
    reference: makeReference(),
    confirmedAt: new Date().toISOString(),
    appointment: {
      practitioner: req.practitioner,
      date: req.date,
      time: req.time,
      treatment: req.treatment ?? "Consultation",
      durationMinutes: 30,
    },
    patient: { name: req.patientName, contact: req.patientContact },
    source: "stub",
  };
}
