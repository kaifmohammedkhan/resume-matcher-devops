import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/** ✅ Helper 1: Extract and clean keywords */
function getKeywords(input) {
  if (!input) return [];
  let rawQuery = "";

  if (typeof input === "object" && !Array.isArray(input)) {
    rawQuery = Array.isArray(input.query) ? input.query.join(" OR ") : (input.query || "");
  } else if (Array.isArray(input)) {
    rawQuery = input.join(" OR ");
  } else {
    rawQuery = String(input);
  }

  return rawQuery
    .replace(/"/g, "")
    .split(/\s+OR\s+/i)
    .map(k => k.trim())
    .filter(Boolean);
}

/** ✅ Helper 2: Extract details from SerpAPI job item */
function parseJobItem(item, location) {
  const title = item.title || "Untitled Role";
  const company = item.company_name || "Unknown Company";
  const description = item.description || "";
  const workMode = item.detected_extensions?.work_from_home ? "Remote" : "Onsite";

  return {
    title,
    company,
    location: item.location || location || "Global",
    // Standardized to match frontend expectations
    job_apply_link: item.apply_options?.[0]?.link || item.link || "#",
    url: item.link || "#", 
    job_description: description,
    work_mode: workMode,
    job_country: String(location).toLowerCase().includes("india") ? "India" : "Global",
    source: "SerpAPI",
  };
}

/** ✅ Helper 3: SerpAPI Pagination & Key Rotation */
async function getPageResults(query, apiKeys, start, location) {
  for (const key of apiKeys) {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&engine=google_jobs&api_key=${key}&start=${start}`;
    try {
      const { data } = await axios.get(url);
      const items = data.jobs_results || [];
      if (items.length === 0) return { results: [], stop: true };

      const processed = items.map(item => parseJobItem(item, location));
      return { results: processed, stop: items.length < 10 };
    } catch (err) {
      // Rotate to next key only if rate limited
      if (err.response?.status !== 429) break;
    }
  }
  return { results: [], stop: true };
}

/** ✅ Main Scraper Function */
export async function scrapeGoogleJobs(input = [], locationInput = "", workModeInput = "All") {
  const isObj = typeof input === 'object' && !Array.isArray(input);
  const location = isObj ? (input.location || locationInput) : locationInput;
  const workMode = isObj ? (input.workMode || workModeInput) : workModeInput;

  const apiKeys = (process.env.GOOGLE_API_KEY || "")
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (!apiKeys.length) return [];

  const keywords = getKeywords(input);
  if (keywords.length === 0) return [];

  const quoted = keywords.map(k => `"${k}"`);
  const serpQuery = `${quoted.join(" OR ")} ${location}`.trim();

  const allResults = [];
  const startIndices = [0, 10]; // SerpAPI pagination

  for (const start of startIndices) {
    const { results, stop } = await getPageResults(serpQuery, apiKeys, start, location);
    allResults.push(...results);
    if (stop) break;
  }

  return allResults.filter(j =>
    workMode === "All" || j.work_mode.toLowerCase() === workMode.toLowerCase()
  );
}