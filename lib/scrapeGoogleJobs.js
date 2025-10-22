import axios from "axios";

// Google-based LinkedIn Job Scraper (Extended mode)
export async function scrapeGoogleJobs(input = [], location = "", workMode = "All") {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX_ID;

  if (!apiKey || !cx) {
    console.error("❌ Missing Google API credentials");
    return [];
  }

  // 🧠 Extract and clean keywords (same as before)
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

  // 🧩 Build Google query (same as LinkedIn logic)
  const sanitizedQuery = extractedKeywords.map((k) => `"${k}"`).join(" OR ");
  const googleQuery = `${sanitizedQuery} site:linkedin.com/jobs/view ${location}`.trim();

  console.log("🔑 Extracted Keywords:", extractedKeywords);
  console.log(`🔍 Google API Query: ${googleQuery}`);

  // ⚙️ Fetch multiple pages (up to 100 results)
  const allResults = [];
  const maxResults = 100; // API limit
  const pageSize = 10;

  for (let start = 1; start <= maxResults; start += pageSize) {
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      googleQuery
    )}&key=${apiKey}&cx=${cx}&num=${pageSize}&start=${start}`;

    console.log(`📄 Fetching page starting at ${start}...`);

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
            item.title?.replace(/\|.*$/g, "").replace(/ - LinkedIn.*$/i, "").trim() ||
            "Untitled Role";
          const companyMatch = snippet.match(/at\s([A-Za-z0-9&.,\- ]+)/i);
          const company = companyMatch ? companyMatch[1].trim() : "Unknown Company";

          const work_mode = /remote/.test(lower)
            ? "Remote"
            : /hybrid/.test(lower)
            ? "Hybrid"
            : "Onsite";

          const job_country = location.toLowerCase().includes("india")
            ? "India"
            : "Global";

          return {
            title,
            company,
            location: location || "Global",
            url: item.link,
            job_description: snippet.slice(0, 400),
            work_mode,
            job_country,
            source: "LinkedIn (via Google)",
          };
        });

      allResults.push(...pageResults);

      // Stop if fewer than 10 returned → no more pages
      if (data.items.length < pageSize) break;
    } catch (err) {
      console.error(`❌ Error fetching page ${start}:`, err.message);
      break;
    }
  }

  // 🧹 Filter final results
  const jobs = allResults.filter((job) => {
    if (!job.title || !job.url.includes("linkedin.com/jobs/view")) return false;
    if (!job.job_description || job.job_description.length < 50) return false;
    if (workMode === "All") return true;
    return job.work_mode.toLowerCase() === workMode.toLowerCase();
  });

  console.log(`✅ Scraped ${jobs.length} total LinkedIn job results via Google CSE`);
  return jobs;
}
