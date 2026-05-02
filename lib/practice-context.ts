export type Practitioner = {
  name: string;
  role: string;
  bio: string;
  treatments: string[];
};

export type Treatment = {
  name: string;
  priceFrom?: number;
  priceTo?: number;
  description?: string;
  practitioners?: string[];
};

export type OpeningHour = {
  day: string;
  hours: string;
};

export type PracticeBrand = {
  primary: string;
  secondary: string;
  accent: string;
  fontFamily?: string;
};

export type PracticeContext = {
  slug: string;
  name: string;
  tagline?: string;
  address: string;
  phone: string;
  email: string;
  nhsAccepted: boolean;
  privateOnly?: boolean;
  hours: OpeningHour[];
  practitioners: Practitioner[];
  treatments: Treatment[];
  brand: PracticeBrand;
};

export const mockPracticeContext: PracticeContext = {
  slug: "kingsway-dental",
  name: "Kingsway Dental Practice",
  tagline: "Modern dentistry on the high street.",
  address: "112 Kingsway, London WC2B 6LH",
  phone: "020 7946 0123",
  email: "hello@kingswaydental.example",
  nhsAccepted: false,
  privateOnly: true,
  hours: [
    { day: "Monday", hours: "08:30 – 18:00" },
    { day: "Tuesday", hours: "08:30 – 18:00" },
    { day: "Wednesday", hours: "08:30 – 19:30" },
    { day: "Thursday", hours: "08:30 – 18:00" },
    { day: "Friday", hours: "08:30 – 17:00" },
    { day: "Saturday", hours: "09:00 – 13:00" },
    { day: "Sunday", hours: "Closed" },
  ],
  practitioners: [
    {
      name: "Dr Anya Patel",
      role: "Principal Dentist",
      bio: "BDS (London), 14 years' experience. Lead clinician for Invisalign and cosmetic bonding.",
      treatments: ["Check-up", "Invisalign", "Composite bonding", "Whitening"],
    },
    {
      name: "Dr Marcus Lin",
      role: "Implant & Restorative Dentist",
      bio: "BDS, MSc Implant Dentistry. Trained at the Eastman. Handles complex restorative and implant cases.",
      treatments: ["Implants", "Crowns", "Bridges", "Root canal"],
    },
    {
      name: "Sofia Romano",
      role: "Hygienist",
      bio: "10 years as a dental hygienist. Specialises in airflow cleaning and gum health programmes.",
      treatments: ["Hygiene", "Airflow cleaning", "Gum disease therapy"],
    },
  ],
  treatments: [
    { name: "New patient consultation", priceFrom: 95, description: "Includes full exam, X-rays and treatment plan.", practitioners: ["Dr Anya Patel", "Dr Marcus Lin"] },
    { name: "Hygiene appointment", priceFrom: 75, priceTo: 95, practitioners: ["Sofia Romano"] },
    { name: "Invisalign", priceFrom: 2800, priceTo: 4500, description: "Clear aligner orthodontics. Price depends on complexity.", practitioners: ["Dr Anya Patel"] },
    { name: "Composite bonding", priceFrom: 250, priceTo: 350, description: "Per tooth.", practitioners: ["Dr Anya Patel"] },
    { name: "Teeth whitening", priceFrom: 395, description: "Take-home Enlighten or Boutique system.", practitioners: ["Dr Anya Patel"] },
    { name: "Dental implants", priceFrom: 2500, description: "Single tooth implant including crown.", practitioners: ["Dr Marcus Lin"] },
    { name: "Root canal treatment", priceFrom: 450, priceTo: 850, practitioners: ["Dr Marcus Lin"] },
  ],
  brand: {
    primary: "#0E5C5C",
    secondary: "#F5EFE6",
    accent: "#D4A24C",
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export function practiceContextAsSystemFacts(ctx: PracticeContext): string {
  const lines: string[] = [];
  lines.push(`Practice: ${ctx.name}`);
  if (ctx.tagline) lines.push(`Tagline: ${ctx.tagline}`);
  lines.push(`Address: ${ctx.address}`);
  lines.push(`Phone: ${ctx.phone}`);
  lines.push(`Email: ${ctx.email}`);
  lines.push(`NHS patients accepted: ${ctx.nhsAccepted ? "yes" : "no"}${ctx.privateOnly ? " (private only)" : ""}`);
  lines.push("");
  lines.push("Opening hours:");
  for (const h of ctx.hours) lines.push(`- ${h.day}: ${h.hours}`);
  lines.push("");
  lines.push("Practitioners:");
  for (const p of ctx.practitioners) {
    lines.push(`- ${p.name} (${p.role}). ${p.bio} Treatments: ${p.treatments.join(", ")}.`);
  }
  lines.push("");
  lines.push("Treatments offered (with prices in GBP):");
  for (const t of ctx.treatments) {
    const price = t.priceTo ? `£${t.priceFrom}–£${t.priceTo}` : t.priceFrom ? `from £${t.priceFrom}` : "POA";
    const who = t.practitioners?.length ? ` Provided by: ${t.practitioners.join(", ")}.` : "";
    const desc = t.description ? ` ${t.description}` : "";
    lines.push(`- ${t.name} — ${price}.${desc}${who}`);
  }
  return lines.join("\n");
}
