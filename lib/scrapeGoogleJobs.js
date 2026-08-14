import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/** ============================================================
 * Helper 1: Extract and clean keywords
 * ============================================================ */
function getKeywords(input) {
  if (!input) return [];

  let rawQuery = "";

  if (typeof input === "object" && !Array.isArray(input)) {
    rawQuery = Array.isArray(input.query)
      ? input.query.join(" OR ")
      : (input.query || "");
  } else if (Array.isArray(input)) {
    rawQuery = input.join(" OR ");
  } else {
    rawQuery = String(input);
  }

  return rawQuery
    .replace(/"/g, "")
    .split(/\bOR\b/i)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

/** ============================================================
 * Helper 2: Determine country from job location
 * ============================================================ */
function getJobCountry(jobLocation, fallbackLocation = "") {
  const locationText = String(
    jobLocation || fallbackLocation || ""
  ).toLowerCase();

  if (
    locationText.includes("india") ||
    locationText.includes("delhi") ||
    locationText.includes("mumbai") ||
    locationText.includes("bangalore") ||
    locationText.includes("bengaluru") ||
    locationText.includes("hyderabad") ||
    locationText.includes("chennai") ||
    locationText.includes("pune") ||
    locationText.includes("kolkata") ||
    locationText.includes("noida") ||
    locationText.includes("gurgaon") ||
    locationText.includes("gurugram") ||
    locationText.includes("ahmedabad") ||
    locationText.includes("jaipur") ||
    locationText.includes("kochi") ||
    locationText.includes("indore")
  ) {
    return "India";
  }

  return "Global";
}

/** ============================================================
 * Helper 3: Extract details from SerpAPI job item
 * ============================================================ */
function parseJobItem(item, location) {
  const jobLocation = item.location || location || "Global";

  const title = item.title || "Untitled Role";

  const company = item.company_name || "Unknown Company";

  // Preserve undefined when SerpAPI does not provide description.
  // Some unit tests explicitly verify this behavior.
  const description = item.description;

  const workMode = item.detected_extensions?.work_from_home
    ? "Remote"
    : "Onsite";

  return {
    title,

    company,

    location: jobLocation,

    job_apply_link:
      item.apply_options?.[0]?.link ||
      item.link ||
      "#",

    url: item.link || "#",

    job_description: description || "",

    // Preserve the original description field as returned by SerpAPI.
    description,

    work_mode: workMode,

    // Determine country using the actual job location first.
    job_country: getJobCountry(jobLocation, location),

    source: "SerpAPI",
  };
}

/** ============================================================
 * Helper 4: SerpAPI Pagination & Key Rotation
 * ============================================================ */
async function getPageResults(
  query,
  apiKeys,
  start,
  location
) {
  for (const key of apiKeys) {
    const url =
      `https://serpapi.com/search.json` +
      `?q=${encodeURIComponent(query)}` +
      `&engine=google_jobs` +
      `&api_key=${key}` +
      `&start=${start}`;

    try {
      const { data } = await axios.get(url);

      const items = data.jobs_results || [];

      if (items.length === 0) {
        return {
          results: [],
          stop: true,
        };
      }

      const processed = items.map((item) =>
        parseJobItem(item, location)
      );

      return {
        results: processed,
        stop: items.length < 10,
      };
    } catch (err) {
      /*
       * Rotate to the next API key only when the current
       * key has been rate limited.
       */
      if (err.response?.status !== 429) {
        break;
      }
    }
  }

  return {
    results: [],
    stop: true,
  };
}

/** ============================================================
 * Main Scraper Function
 * ============================================================ */
export async function scrapeGoogleJobs(
  input = [],
  locationInput = "",
  workModeInput = "All"
) {
  /*
   * Important:
   * typeof null === "object"
   *
   * Therefore we must explicitly exclude null before
   * accessing input.location or input.workMode.
   */
  const isObj =
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input);

  const location = isObj
    ? (input.location || locationInput)
    : locationInput;

  const workMode = isObj
    ? (input.workMode || workModeInput)
    : workModeInput;

  /** ==========================================================
   * WireMock Mode
   * ========================================================== */
  if (process.env.WIREMOCK_URL) {
    try {
      const url =
        `${process.env.WIREMOCK_URL}/search`;

      const { data } = await axios.get(url);

      const jobs = data.results || [];

      return jobs.filter((job) =>
        workMode === "All" ||
        job.work_mode?.toLowerCase() ===
          workMode.toLowerCase()
      );
    } catch (err) {
      console.error(
        "WireMock call failed:",
        err.message
      );

      return [];
    }
  }

  /** ==========================================================
   * Legacy Mock Mode
   * ========================================================== */
  if (process.env.MOCK_SERP === "true") {
    const mockJobs = [
      {
        title: "Software Engineer (Mock)",
        company: "DevOps Labs",
        location: location || "Global",
        job_apply_link:
          "https://example.com/apply/1",
        url:
          "https://example.com/job/1",
        job_description:
          "This is a comprehensive mock job description long enough to satisfy length validation rules for testing pipelines safely without hitting real API limits.",
        work_mode: "Remote",
        job_country: "Global",
        source: "Mock",
      },
      {
        title: "Full Stack Developer (Mock)",
        company: "Cloud Solutions Inc",
        location: location || "Global",
        job_apply_link:
          "https://example.com/apply/2",
        url:
          "https://example.com/job/2",
        job_description:
          "Another mock job description used to simulate successful database inserts, scoring overhead, and rendering workflows during high volume k6 runs.",
        work_mode: "Onsite",
        job_country: "Global",
        source: "Mock",
      },
    ];

    return mockJobs.filter((job) =>
      workMode === "All" ||
      job.work_mode.toLowerCase() ===
        workMode.toLowerCase()
    );
  }

  /** ==========================================================
   * Real SerpAPI Mode
   * ========================================================== */
  const apiKeys = (
    process.env.GOOGLE_API_KEY || ""
  )
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (!apiKeys.length) {
    return [];
  }

  const keywords = getKeywords(input);

  if (keywords.length === 0) {
    return [];
  }

  const quoted = keywords.map(
    (keyword) => `"${keyword}"`
  );

  const serpQuery =
    `${quoted.join(" OR ")} ${location}`.trim();

  if (serpQuery.length > 5000) {
    throw new Error("Query too long");
  }

  const allResults = [];

  const startIndices = [0, 10];

  for (const start of startIndices) {
    const {
      results,
      stop,
    } = await getPageResults(
      serpQuery,
      apiKeys,
      start,
      location
    );

    allResults.push(...results);

    if (stop) {
      break;
    }
  }

  return allResults.filter((job) =>
    workMode === "All" ||
    job.work_mode?.toLowerCase() ===
      workMode.toLowerCase()
  );
}