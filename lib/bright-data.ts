export async function fetchHtmlViaBrightData(url: string): Promise<string> {
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
  if (!res.ok) {
    throw new Error(`Bright Data scrape failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}
