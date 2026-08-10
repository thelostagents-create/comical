// Proxies Comic Vine's search/volume endpoints so the API key stays server-
// side and the browser doesn't have to deal with Comic Vine's CORS policy.
//
// GET /comicvine?resource=search&query=batman
// GET /comicvine?resource=volume&id=<comic vine volume id>
//
// Requires a COMICVINE_API_KEY secret (see README for setup).

const COMICVINE_BASE = "https://comicvine.gamespot.com/api";
const USER_AGENT = "Comical/1.0 (+https://github.com/thelostagents-create/comical)";

// Comic Vine's bulk list endpoints (volume detail's `issues` field, or the
// `/issues/` list filtered by volume) never return `character_credits` —
// that field only comes back from a single issue's own detail endpoint. So
// character data costs one extra upstream request per issue; this caps how
// many of a volume's issues we pay that cost for, matching the client's own
// import cap (MAX_IMPORTED_ISSUES in Library.tsx).
const MAX_ISSUES_WITH_CHARACTERS = 60;
const ISSUE_DETAIL_BATCH_SIZE = 4;
const BATCH_DELAY_MS = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

interface CvIssueDetailRaw {
  id: number;
  issue_number: string;
  name: string | null;
  character_credits?: { id: number; name: string }[];
}

interface CvCharacterRaw {
  id: number;
  name: string;
  image?: { medium_url?: string; small_url?: string } | null;
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

// Comic Vine wraps every response — success or failure — in HTTP 200 with a
// status_code field in the body (1 = OK). Rate limiting, an invalid key,
// etc. all come back this way, NOT as a non-2xx HTTP status, so checking
// res.ok alone silently treats real API errors as empty-but-successful data.
async function fetchComicVine(url: URL) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Comic Vine responded ${res.status}`);
  const data = await res.json();
  if (typeof data?.status_code === "number" && data.status_code !== 1) {
    throw new Error(data.error ? `Comic Vine: ${data.error}` : `Comic Vine error (status_code ${data.status_code})`);
  }
  return data;
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

      const volumeUrl = new URL(`${COMICVINE_BASE}/volume/4050-${id}/`);
      volumeUrl.searchParams.set("api_key", apiKey);
      volumeUrl.searchParams.set("format", "json");
      volumeUrl.searchParams.set(
        "field_list",
        "id,name,publisher,image,start_year,count_of_issues,description,issues",
      );

      const volumeData = await fetchComicVine(volumeUrl);
      const v = volumeData.results as CvVolumeRaw | undefined;

      const issueRefs = (v?.issues ?? [])
        .map((i) => ({ id: i.id, issueNumber: i.issue_number, title: i.name ?? "" }))
        .sort((a, b) => parseFloat(a.issueNumber) - parseFloat(b.issueNumber))
        .slice(0, MAX_ISSUES_WITH_CHARACTERS);

      const issues: { id: string; issueNumber: string; title: string; characters: { comicvineId: string; name: string }[] }[] = [];
      let characterFetchWarning: string | null = null;
      for (let i = 0; i < issueRefs.length; i += ISSUE_DETAIL_BATCH_SIZE) {
        if (i > 0) await delay(BATCH_DELAY_MS);
        const batch = issueRefs.slice(i, i + ISSUE_DETAIL_BATCH_SIZE);
        const detailed = await Promise.all(
          batch.map(async (ref) => {
            try {
              const issueUrl = new URL(`${COMICVINE_BASE}/issue/4000-${ref.id}/`);
              issueUrl.searchParams.set("api_key", apiKey);
              issueUrl.searchParams.set("format", "json");
              issueUrl.searchParams.set("field_list", "id,issue_number,name,character_credits");
              const data = await fetchComicVine(issueUrl);
              const detail = data.results as CvIssueDetailRaw | undefined;
              return {
                id: String(ref.id),
                issueNumber: ref.issueNumber,
                title: ref.title,
                characters: (detail?.character_credits ?? []).map((c) => ({ comicvineId: String(c.id), name: c.name })),
              };
            } catch (err) {
              // A single issue's detail lookup failing shouldn't sink the
              // whole import — it just imports with no character data for
              // that issue. The first failure's reason is still reported
              // back so it doesn't fail completely silently.
              if (!characterFetchWarning) {
                characterFetchWarning = err instanceof Error ? err.message : "Character lookup failed";
              }
              return { id: String(ref.id), issueNumber: ref.issueNumber, title: ref.title, characters: [] };
            }
          }),
        );
        issues.push(...detailed);
      }

      return json({ volume: mapVolume(v), issues, characterFetchWarning });
    }

    if (resource === "character") {
      const id = url.searchParams.get("id")?.trim();
      if (!id) return json({ error: "id is required" }, 400);

      const characterUrl = new URL(`${COMICVINE_BASE}/character/4005-${id}/`);
      characterUrl.searchParams.set("api_key", apiKey);
      characterUrl.searchParams.set("format", "json");
      characterUrl.searchParams.set("field_list", "id,name,image");

      const data = await fetchComicVine(characterUrl);
      const c = data.results as CvCharacterRaw | undefined;
      if (!c) return json({ character: null });
      return json({
        character: {
          id: String(c.id),
          name: c.name ?? "",
          imageUrl: c.image?.medium_url ?? c.image?.small_url ?? null,
        },
      });
    }

    return json({ error: "unknown resource — expected 'search', 'volume', or 'character'" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Comic Vine request failed" }, 502);
  }
});
