import axios from "axios";

// Google-based LinkedIn Job Scraper (Rotating Keys + Throttled + Resilient)
export async function scrapeGoogleJobs(input = [], location = "", workMode = "All") {
  const apiKeys = process.env.GOOGLE_API_KEYS?.split(',') || [];
  const cx = process.env.GOOGLE_CX_ID;

  if (!apiKeys.length || !cx) {
    console.error("❌ Missing Google API credentials");
    return [];
  }

  let extractedKeywords = [];

  if (typeof input === "object" && input !== null && input.query) {
    extractedKeywords = input.query
      .replace(/"/g, "")
      .split(/\s+OR\s+/i)
      .map((k) => k.trim())
      .filter(Boolean);
    location = input.location || "";
    workMode = input.workMode || "All";
  } else if (Array.isArray(input)) {
    extractedKeywords = input.filter(Boolean);
  } else if (typeof input === "string") {
    extractedKeywords = input
      .replace(/"/g, "")
      .split(/\s+OR\s+/i)
      .map((k) => k.trim())
      .filter(Boolean);
  }

  if (!extractedKeywords.length) {
    console.warn("⚠️ No extracted keywords found — skipping Google scrape.");
    return [];
  }

  const sanitizedQuery = extractedKeywords.map((k) => `"${k}"`).join(" OR ");
  const googleQuery = `${sanitizedQuery} site:linkedin.com/jobs/view ${location}`.trim();

  console.log("🔑 Extracted Keywords:", extractedKeywords);
  console.log(`🔍 Google API Query: ${googleQuery}`);

  const allResults = [];
  const maxResults = 30;
  const pageSize = 10;

  for (let start = 1; start <= maxResults; start += pageSize) {
    const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      googleQuery
    )}&key=${apiKey}&cx=${cx}&num=${pageSize}&start=${start}`;

    console.log(`📄 Fetching page starting at ${start} with key: ${apiKey.slice(0, 6)}...`);

    try {
      const { data } = await axios.get(url);

      if (!data.items?.length) {
        console.log("⚠️ No results on this page, stopping early.");
        break;
      }

      const pageResults = data.items
        .filter((item) => /linkedin\.com\/jobs\/view/i.test(item.link))
        .map((item) => {
          const snippet = item.snippet || "";
          const lower = snippet.toLowerCase();

          const title =
            item.title
              ?.replace(/\|.*$/g, "")
              ?.replace(/ - LinkedIn.*$/i, "")
              ?.trim() || "Untitled Role";

          let company = "Unknown Company";
          const companyMatch =
            snippet.match(/at\s+([A-Z][A-Za-z0-9&.,\- ]+)/) ||
            item.title?.match(/at\s+([A-Z][A-Za-z0-9&.,\- ]+)/);
          if (companyMatch) company = companyMatch[1].trim();

          let extractedLocation = location || "";
          const locationMatch =
            snippet.match(/\b(in|at)\s+([A-Z][A-Za-z\s,]+)\b(,?\s?(India|USA|UK|Canada|Remote))?/i);
          if (locationMatch) {
            extractedLocation = locationMatch[2].trim();
            if (locationMatch[4]) extractedLocation += `, ${locationMatch[4]}`;
          }

          extractedLocation = extractedLocation.replace(/\b(\w+)(,?\s+\1\b)+/gi, "$1");

          const work_mode = /remote/.test(lower)
            ? "Remote"
            : /hybrid/.test(lower)
            ? "Hybrid"
            : "Onsite";

          const job_country = extractedLocation.toLowerCase().includes("india") ? "India" : "Global";

          return {
            title,
            company,
            location: extractedLocation || "Global",
            url: item.link,
            job_description: snippet.slice(0, 400),
            work_mode,
            job_country,
            source: "LinkedIn",
          };
        });

      allResults.push(...pageResults);

      if (data.items.length < pageSize) break;

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      const status = err.response?.status || "unknown";
      console.error(`❌ Error fetching page ${start}:`, status, err.message);

      if (status === 429) {
        console.warn("⚠️ Rate limit hit — rotating key and stopping early.");
        break;
      }
    }
  }

  const jobs = allResults.filter((job) => {
    if (!job.title || !job.url.includes("linkedin.com/jobs/view")) return false;
    if (!job.job_description || job.job_description.length < 50) return false;
    if (workMode === "All") return true;
    return job.work_mode.toLowerCase() === workMode.toLowerCase();
  });

  console.log(`✅ Scraped ${jobs.length} total LinkedIn job results via Google CSE`);
  return jobs;
}