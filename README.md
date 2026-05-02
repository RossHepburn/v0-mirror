# Mirror

> A salesperson enters a UK dental practice URL. Mirror gives them (a) a
> sales battle card and (b) a working pilot site with our AI receptionist
> chatbot embedded, branded as the practice — in under a minute.

Built for the Zero-to-Agent London hackathon (May 2026), bundling
**Vercel** (Gateway, Next.js, Workflow-style background jobs, deploy),
**Mubit** (operational memory across prospects), and
**Bright Data** (Web Unlocker scrape + screenshot for visual cloning).

## What it does

1. **Landing → job kickoff.** `POST /api/jobs/create` with a prospect URL.
   Background pipeline starts immediately; `/jobs/[id]` polls
   `/api/jobs/[id]/status` for live progress on three steps.

2. **Analyse the prospect.** Bright Data Web Unlocker scrapes the homepage
   HTML and a screenshot in parallel. A Cheerio pre-pass pulls phones,
   logo, and JSON-LD; `gpt-4o-mini` (via the Vercel AI Gateway) extracts a
   strict-Zod `PracticeProfile` from the cleaned text. `gpt-4o` vision
   pulls `VisualTokens` (palette, fonts, mood) from the screenshot. An
   adapter (`fromProfile`) collapses both into the chatbot's
   `PracticeContext`.

3. **Battle card.** `claude-sonnet-4.5` (also via Gateway) writes a
   structured battle card with practice snapshot, gap analysis,
   competitive landscape, chatbot pitch, ROI, three opening lines, and a
   fit signal. Before generation it queries Mubit's cross-prospect lessons
   lane and surfaces the result as a "Lessons from past prospects"
   section on `/jobs/[id]/deck`.

4. **Pilot site.** Multi-tenant template at `/p/[id]` renders the
   prospect's content with the extracted brand tokens applied via CSS
   variables. The existing `<Chatbot />` component is embedded, configured
   with the prospect's `PracticeContext`.

5. **Chat with operational memory.** `/api/chat` does one explicit
   `client.recall()` against `PROJECT_LANE_SESSION` per turn (the
   middleware's auto-injection isn't reliable intra-chat — see
   `spikes/mubit/SPEC.md` §3 supersede). Lessons get injected into the
   system prompt. The AI SDK model is wrapped with
   `mubitMemoryMiddleware({ injectLessons: false })` so each interaction
   is auto-captured. When the `book_appointment` tool succeeds,
   `recordConversion()` writes a lesson to both the per-prospect lane
   and the cross-prospect `PROJECT_LANE_SESSION` — so the *next*
   prospect's battle card and chatbot inherit what worked.

## How the integrations slot in

| Vendor | Where |
|---|---|
| **Vercel AI Gateway** | All `streamText`/`generateObject` calls. Model strings: `openai/gpt-4o-mini`, `openai/gpt-4o`, `anthropic/claude-sonnet-4.5`. Per-prospect `gateway.tags` for usage analytics. |
| **Vercel `after()`** | Schedules Mubit ingest after the chat response so capture survives function suspension. |
| **Bright Data** | `https://api.brightdata.com/request` with the `mirror_unlocker` zone, `format: raw` for HTML, `data_format: screenshot` for the visual pass. |
| **Mubit `@mubit-ai/sdk@0.7.0`** | `client.recall()` for lessons, `client.remember()` for capture, `client.recordOutcome()` for conversion reinforcement. |
| **Mubit `@mubit-ai/ai-sdk@0.6.0`** | `mubitMemoryMiddleware` wraps the gateway model for auto-capture. |

## Local dev

```bash
pnpm install
cp ../.env .env.local   # AI_GATEWAY_API_KEY, BRIGHTDATA_*, MUBIT_*
pnpm dev                # http://localhost:3000
```

End-to-end smoke test against the running server:

```bash
JOB=$(curl -s -X POST http://localhost:3000/api/jobs/create \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.confidental.co.uk/"}' | jq -r .id)
watch "curl -s http://localhost:3000/api/jobs/$JOB/status | jq '.steps'"
open http://localhost:3000/jobs/$JOB
```

A real run on `confidental.co.uk` lands at `/p/<jobId>` with the chatbot
streaming in ~50s end-to-end (~$0.01-0.03 per prospect — most of it is
the screenshot vision pass).

## Code map

```
v0-mirror/
  app/
    page.tsx                          ← landing form → POST /api/jobs/create
    jobs/[id]/page.tsx                ← live progress polling
    jobs/[id]/deck/page.tsx           ← battle card view
    jobs/[id]/pilot/page.tsx          ← link to pilot URL
    p/[id]/page.tsx                   ← multi-tenant pilot site
    p/[id]/pilot-template.tsx
    api/jobs/create/route.ts          ← kicks off runBuildPilot()
    api/jobs/[id]/status/route.ts     ← polled by the UI
    api/chat/route.ts                 ← Gateway model + Mubit middleware
    api/booking/{create,slots}/route.ts
  components/chatbot/Chatbot.tsx      ← embedded into /p/[id]
  lib/
    jobs.ts                           ← /tmp JSON persistence
    build-pilot.ts                    ← orchestrator (3 steps)
    profile-prospect.ts               ← BD scrape + Cheerio + LLM
    visual-tokens.ts                  ← BD screenshot + vision
    practice-context.ts               ← shape + fromProfile adapter
    battle-card.ts                    ← generateObject + Mubit insights
    mubit.ts                          ← singleton + recall/remember helpers
    booking.ts                        ← Dentally-shaped stub
```

## Known limitations (hackathon scope)

- Persistence is `/tmp` JSON files. Single-instance only; reset on restart.
  Lift onto KV or Workflow durable state for production.
- Pilot deploy is in-app (`/p/[id]`) rather than a per-prospect Vercel
  project. The Vercel MCP path (Option B) was descoped for time.
- Mubit cross-prospect lessons rely on conversions being captured. Until
  enough chats convert, `lessonsFromPastProspects` will be empty.
- Booking calls a stub (`lib/booking.ts`). Dentally sandbox integration
  is post-hackathon.
