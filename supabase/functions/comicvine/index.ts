// Proxies Comic Vine's search/volume endpoints so the API key stays server-
// side and the browser doesn't have to deal with Comic Vine's CORS policy.
//
// GET /comicvine?resource=search&query=batman
// GET /comicvine?resource=volume&id=<comic vine volume id>
//
// Requires a COMICVINE_API_KEY secret (see README for setup).

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";
const USER_AGENT = "Comical/1.0 (+https://github.com/thelostagents-create/comical)";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CvVolumeRaw {
  id: number;
  name: string;
  publisher?: { name: string } | null;
  image?: { medium_url?: string; small_url?: string } | null;
  start_year?: string | null;
  count_of_issues?: number | null;
  description?: string | null;
  issues?: { id: number; issue_number: string; name: string | null }[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapVolume(v: CvVolumeRaw | null | undefined) {
  if (!v) return null;
  return {
    id: String(v.id),
    name: v.name ?? "",
    publisher: v.publisher?.name ?? "",
    imageUrl: v.image?.medium_url ?? v.image?.small_url ?? null,
    startYear: v.start_year ?? null,
    issueCount: v.count_of_issues ?? null,
    description: stripHtml(v.description ?? ""),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchComicVine(url: URL) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Comic Vine responded ${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("COMICVINE_API_KEY");
  if (!apiKey) {
    return json({ error: "COMICVINE_API_KEY is not configured on this project." }, 500);
  }

  const url = new URL(req.url);
  const resource = url.searchParams.get("resource");

  try {
    if (resource === "search") {
      const query = url.searchParams.get("query")?.trim();
      if (!query) return json({ error: "query is required" }, 400);

      const cvUrl = new URL(`${COMICVINE_BASE}/search/`);
      cvUrl.searchParams.set("api_key", apiKey);
      cvUrl.searchParams.set("format", "json");
      cvUrl.searchParams.set("resources", "volume");
      cvUrl.searchParams.set("query", query);
      cvUrl.searchParams.set("limit", "20");
      cvUrl.searchParams.set(
        "field_list",
        "id,name,publisher,image,start_year,count_of_issues,description",
      );

      const data = await fetchComicVine(cvUrl);
      const results = ((data.results ?? []) as CvVolumeRaw[]).map(mapVolume);
      return json({ results });
    }

    if (resource === "volume") {
      const id = url.searchParams.get("id")?.trim();
      if (!id) return json({ error: "id is required" }, 400);

      const cvUrl = new URL(`${COMICVINE_BASE}/volume/4050-${id}/`);
      cvUrl.searchParams.set("api_key", apiKey);
      cvUrl.searchParams.set("format", "json");
      cvUrl.searchParams.set(
        "field_list",
        "id,name,publisher,image,start_year,count_of_issues,description,issues",
      );

      const data = await fetchComicVine(cvUrl);
      const v = data.results as CvVolumeRaw | undefined;
      const issues = (v?.issues ?? [])
        .map((i) => ({ id: String(i.id), issueNumber: i.issue_number, title: i.name ?? "" }))
        .sort((a, b) => parseFloat(a.issueNumber) - parseFloat(b.issueNumber));

      return json({ volume: mapVolume(v), issues });
    }

    return json({ error: "unknown resource — expected 'search' or 'volume'" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Comic Vine request failed" }, 502);
  }
});
