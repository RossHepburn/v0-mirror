import { generateObject } from "ai";
import { z } from "zod";
import * as cheerio from "cheerio";

// OpenAI strict-mode structured outputs require every property in `required`.
// Use `.nullable()` for optional values, NOT `.optional()` or `.default()`.
const Practitioner = z.object({
  name: z.string(),
  role: z.string().nullable(),
  bio: z.string().nullable(),
});

const Service = z.object({
  name: z.string(),
  priceFrom: z.string().nullable().describe('e.g. "£99", "from £2,500", null if not shown'),
});

const Location = z.object({
  name: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
});

const PracticeSchema = z.object({
  practiceName: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  locations: z.array(Location),
  openingHours: z.string().nullable().describe('Free-text summary, e.g. "Mon–Fri 9–5, Sat 9–1"'),
  services: z.array(Service),
  practitioners: z.array(Practitioner),
  payerMix: z.enum(["nhs_only", "private_only", "mixed", "unknown"]),
  signatureTreatments: z.array(z.string()),
  battlecardHooks: z.array(z.string()),
});

export type PracticeProfile = z.infer<typeof PracticeSchema>;

export type ProspectExtraction = {
  profile: PracticeProfile;
  logo: string | null;
  phones: string[];
  url: string;
};

async function fetchSiteHtml(url: string): Promise<string> {
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone: process.env.BRIGHTDATA_UNLOCKER_ZONE,
      url,
      format: "raw",
    }),
  });
  if (!res.ok) throw new Error(`Bright Data scrape failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function cheerioPrepass(html: string, base: string) {
  const $ = cheerio.load(html);
  const phones = new Set<string>();
  $('a[href^="tel:"]').each((_, el) => {
    phones.add(($(el).attr("href") || "").replace("tel:", "").trim());
  });
  let logo: string | null = null;
  $("header img, nav img, img").each((_, el) => {
    if (logo) return;
    const src = $(el).attr("src") || $(el).attr("data-src");
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (src && (alt.includes("logo") || src.toLowerCase().includes("logo"))) {
      try {
        logo = new URL(src, base).toString();
      } catch {
        // ignore malformed src
      }
    }
  });
  if (!logo) logo = $('meta[property="og:image"]').attr("content") || null;

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      jsonLd.push(JSON.parse($(el).contents().text()));
    } catch {
      // skip malformed JSON-LD blocks
    }
  });

  return { phones: [...phones], logo, jsonLd };
}

export async function profileProspect(url: string): Promise<ProspectExtraction> {
  const html = await fetchSiteHtml(url);
  const pre = cheerioPrepass(html, url);

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const cleaned = $("body").text().replace(/\s+/g, " ").slice(0, 60_000);

  const { object } = await generateObject({
    model: "openai/gpt-4o-mini",
    schema: PracticeSchema,
    system:
      "You extract structured information about UK dental practices from website content. " +
      "Be faithful to the source. If something is not stated, leave it null/empty. Do not invent.",
    prompt:
      `URL: ${url}\n` +
      `JSON-LD already parsed (use as ground truth where it conflicts): ${JSON.stringify(pre.jsonLd).slice(0, 4000)}\n\n` +
      `Page text:\n${cleaned}`,
    temperature: 0,
    providerOptions: {
      gateway: {
        tags: ["mirror", "extract", `host:${new URL(url).host}`],
      },
    },
  });

  return { profile: object, logo: pre.logo, phones: pre.phones, url };
}
