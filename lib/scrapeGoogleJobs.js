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

/** ✅ Helper 2: Extract details (Backtracking/ReDoS Fixed) */
function parseJobItem(item, location) {
  const snippet = item.snippet || item.displayLink || "";
  const lower = snippet.toLowerCase();
  const title = item.title?.split('|')[0]?.split(/ - LinkedIn/i)[0]?.trim() || "Untitled Role";
  
  // FIX: Linear regex without nested quantifiers to prevent ReDoS
  const safeRegex = /at\s+([A-Z][\w&.,\-\s]{1,50})/;
  const companyMatch = snippet.match(safeRegex) || item.title?.match(safeRegex);
  const company = companyMatch ? companyMatch[1].trim() : "Unknown Company";

  let workMode = "Onsite";
  if (lower.includes("remote")) workMode = "Remote";
  else if (lower.includes("hybrid")) workMode = "Hybrid";

  const description = snippet.length > 50 ? snippet : `${snippet}. Job role: ${title} at ${company}.`;

  return {
    title,
    company,
    location: location || "Global",
    url: item.link,
    job_description: description,
    work_mode: workMode,
    job_country: String(location).toLowerCase().includes("india") ? "India" : "Global",
    source: "LinkedIn",
  };
}

/** ✅ Helper 3: Isolated Pagination & Key Rotation 
 * This reduces main function complexity significantly.
 */
async function getPageResults(query, apiKeys, cx, start, location) {
  for (const key of apiKeys) {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${key}&cx=${cx}&num=10&start=${start}`;
    try {
      const { data } = await axios.get(url);
      const items = data.items || [];
      if (items.length === 0) return { results: [], stop: true };

      const processed = items
        .filter(item => /linkedin\.com\/jobs\/view/i.test(item.link))
        .map(item => parseJobItem(item, location));
      
      return { results: processed, stop: items.length < 10 };
    } catch (err) {
      // Continue to next key ONLY if rate limited (429)
      if (err.response?.status !== 429) break;
    }
  }
  return { results: [], stop: true };
}

/** ✅ Main Scraper Function 
 * Complexity: ~6 (Passes the <15 threshold)
 */
export async function scrapeGoogleJobs(input = [], locationInput = "", workModeInput = "All") {
  const isObj = typeof input === 'object' && !Array.isArray(input);
  const location = isObj ? (input.location || locationInput) : locationInput;
  const workMode = isObj ? (input.workMode || workModeInput) : workModeInput;

  const apiKeys = (process.env.GOOGLE_API_KEY || "").split(',').map(k => k.trim()).filter(Boolean);
  const cx = process.env.GOOGLE_CX_ID;

  if (!apiKeys.length || !cx) return [];

  const keywords = getKeywords(input);
  if (keywords.length === 0) return [];

  const quoted = keywords.map(k => `"${k}"`);
  const googleQuery = `${quoted.join(" OR ")} site:linkedin.com/jobs/view ${location}`.trim();

  const allResults = [];
  const startIndices = [1, 11]; // Max 2 pages for efficiency

  for (const start of startIndices) {
    const { results, stop } = await getPageResults(googleQuery, apiKeys, cx, start, location);
    allResults.push(...results);
    if (stop) break;
  }

  return allResults.filter(j => 
    workMode === "All" || j.work_mode.toLowerCase() === workMode.toLowerCase()
  );
}