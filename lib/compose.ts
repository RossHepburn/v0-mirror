import { generateText } from "ai";
import { Redis } from "@upstash/redis";
import type { PracticeContext } from "./practice-context";
import type { VisualTokens } from "./visual-tokens";
import { sanitiseForBabel, stripCodeFences } from "./sanitise-tsx";

export { sanitiseForBabel } from "./sanitise-tsx";

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL!,
  token: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN!,
});

const COMPONENT_TTL_SECONDS = 60 * 60 * 24 * 30;
const MODEL = "anthropic/claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are a senior front-end engineer producing a Next.js page that mirrors
the visual style of a UK dental practice's website. The page must use
Tailwind CSS, shadcn/ui where appropriate, and be a single default-export
TSX component. The component receives a \`practiceContext\` prop containing
real practice data; render that data, do not invent any.

Constraints:
- Single TSX file, default export, named PilotPage
- No external imports beyond react, next/image, tailwind classes, and the
  Chatbot component which will be injected as a prop named \`chatbot\`
- Must include sections that match what's in the source: hero, treatments,
  team, contact/footer at minimum, plus testimonials/awards/multi-location
  if the source has them
- Use the supplied colours and fonts. Do not pick your own
- Render the chatbot prop inside a prominent section labelled appropriately
  (e.g. "Chat with us", "Ask our team")
- Do not output explanation, comments, or code fences — output only the
  TSX`;

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
  if (!res.ok) {
    throw new Error(`Bright Data screenshot failed: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}


export async function composeComponent(args: {
  url: string;
  practiceContext: PracticeContext;
  visual: VisualTokens;
}): Promise<string> {
  const { url, practiceContext, visual } = args;
  const png = await fetchScreenshot(url).catch((err) => {
    console.warn("[compose] screenshot fetch failed, proceeding without:", err);
    return null;
  });

  const userText = `Source URL: ${url}
Visual identity: ${JSON.stringify(visual)}
Practice content: ${JSON.stringify(practiceContext)}

${png ? "Screenshot of the source homepage attached." : "(Screenshot unavailable.)"}

Generate a Next.js page that visually mirrors the source's style and
information density, populated with the practice data above.`;

  const userContent: any[] = [{ type: "text", text: userText }];
  if (png) userContent.push({ type: "image", image: png });

  const { text } = await generateText({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
    temperature: 0.4,
    providerOptions: {
      gateway: {
        tags: ["mirror", "compose", "model:claude", `host:${new URL(url).host}`],
      },
    },
  });

  return sanitiseForBabel(stripCodeFences(text));
}

const componentKey = (id: string) => `job:${id}:component`;

export async function saveComponent(jobId: string, tsx: string): Promise<void> {
  await kv.set(componentKey(jobId), tsx, { ex: COMPONENT_TTL_SECONDS });
}

export async function readComponent(jobId: string): Promise<string | null> {
  const tsx = await kv.get<string>(componentKey(jobId));
  return tsx ?? null;
}
