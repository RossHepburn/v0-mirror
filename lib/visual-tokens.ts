import { generateObject } from "ai";
import { z } from "zod";

const VisualTokensSchema = z.object({
  primary: z.string().describe("Hex code"),
  secondary: z.string().nullable(),
  accent: z.string().nullable(),
  background: z.string(),
  text: z.string(),
  fontHeading: z.string(),
  fontBody: z.string(),
  mood: z.enum(["minimal", "corporate", "warm", "clinical", "playful", "luxe"]),
});

export type VisualTokens = z.infer<typeof VisualTokensSchema>;

async function fetchScreenshot(url: string): Promise<Buffer> {
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
      data_format: "screenshot",
    }),
  });
  if (!res.ok) throw new Error(`Bright Data screenshot failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

const FALLBACK: VisualTokens = {
  primary: "#0E5C5C",
  secondary: "#F5EFE6",
  accent: "#D4A24C",
  background: "#FFFFFF",
  text: "#1a1a1a",
  fontHeading: "Inter, system-ui, sans-serif",
  fontBody: "Inter, system-ui, sans-serif",
  mood: "clinical",
};

export async function extractVisualTokens(url: string): Promise<VisualTokens> {
  try {
    const png = await fetchScreenshot(url);
    const { object } = await generateObject({
      model: "openai/gpt-4o",
      schema: VisualTokensSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the visual design tokens (colours, fonts, mood) from this dental practice homepage screenshot. URL: ${url}`,
            },
            { type: "image", image: png },
          ],
        },
      ],
      temperature: 0,
      providerOptions: {
        gateway: {
          tags: ["mirror", "visual", `host:${new URL(url).host}`],
        },
      },
    });
    return object;
  } catch (err) {
    console.error("[visual-tokens] failed, using fallback:", err);
    return FALLBACK;
  }
}
