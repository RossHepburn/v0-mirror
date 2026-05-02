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

// Binary asset fetch via Bright Data — returns the raw bytes plus the
// upstream Content-Type so we can serve it back at our own origin with the
// right MIME (used by /api/asset for font/CORS proxying).
export async function fetchAssetViaBrightData(
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
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
    throw new Error(`Bright Data asset fetch failed: ${res.status} ${res.statusText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { bytes, contentType: res.headers.get("content-type") };
}
