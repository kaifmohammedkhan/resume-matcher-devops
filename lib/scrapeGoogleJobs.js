import axios from "axios";

export async function scrapeGoogleJobs(query = '"developer"', location = "", workMode = "All") {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX_ID;

  if (!apiKey || !cx) {
    console.error("❌ Missing Google API credentials");
    return [];
  }

  // 🧼 Clean and prepare the query
  const sanitizedQuery =
    typeof query === "string"
      ? query.replace(/[^a-zA-Z0-9\s\-_."]/g, "").trim()
      : '"developer" OR "engineer" OR "software"';

  // 🔍 Force LinkedIn Jobs domain
  const googleQuery = `${sanitizedQuery} site:linkedin.com/jobs ${location}`.trim();
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    googleQuery
  )}&key=${apiKey}&cx=${cx}&num=10`;

  try {
    console.log(`🔍 Google CSE Query: ${googleQuery}`);
    console.log(`🔗 API URL: ${url}`);

    const { data } = await axios.get(url);
    const results = data.items || [];

    if (!results.length) {
      console.warn("⚠️ No results found for Google CSE query.");
      return [];
    }

    const rawJobs = results.map((item) => {
      const title = item.title?.replace(/\s*\|.*$/, "").trim() || "Untitled Role";
      const snippet = item.snippet || "";
      const link = item.link || "#";
      const displayLink = item.displayLink || "linkedin.com";
      const lowerSnippet = snippet.toLowerCase();

      // 🧠 Simple heuristics for extracting details
      const companyMatch = snippet.match(/at\s([A-Za-z0-9&.,\-\s]+)/i);
      const company = companyMatch ? companyMatch[1].trim() : displayLink;

      const work_mode = /remote/.test(lowerSnippet)
        ? "Remote"
        : /hybrid/.test(lowerSnippet)
        ? "Hybrid"
        : "Onsite";

      const job_country = location.toLowerCase().includes("india") ? "India" : "Global";

      return {
        title,
        company,
        location: location || "Global",
        url: link,
        job_description: snippet.slice(0, 400),
        work_mode,
        job_country,
        source: "LinkedIn (via Google)",
      };
    });

    // 🎯 Filter and clean up
    const jobs = rawJobs.filter((job) => {
      if (!job.title || !job.url.includes("linkedin.com/jobs")) return false;
      if (workMode === "All") return true;
      return job.work_mode.toLowerCase() === workMode.toLowerCase();
    });

    console.log(`✅ Scraped ${jobs.length} LinkedIn job results via Google CSE`);
    return jobs;
  } catch (err) {
    console.error("❌ Google CSE scraping failed:", err.message);
    return [];
  }
}
