import { generateText } from "ai";

async function main() {
  const { text } = await generateText({
    model: "anthropic/claude-sonnet-4-5",
    prompt: "Say 'hello' in 3 words.",
    providerOptions: {
      gateway: {
        tags: ["mirror", "compose", "model:claude", "host:verify"],
      },
    },
  });
  console.log("OK:", text);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
