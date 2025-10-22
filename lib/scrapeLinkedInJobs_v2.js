import puppeteer from 'puppeteer';

export async function scrapeLinkedInJobs(input = [], location = '', workMode = 'All') {
  let extractedKeywords = [];

  // 🧠 Handle object, array, or string input
  if (typeof input === 'object' && input !== null && input.query) {
    extractedKeywords = input.query
      .replace(/"/g, '')
      .split(/\s+OR\s+/i)
      .map(k => k.trim())
      .filter(Boolean);
    location = input.location || '';
    workMode = input.workMode || 'All';
  } else if (Array.isArray(input)) {
    extractedKeywords = input.filter(Boolean);
  } else if (typeof input === 'string') {
    extractedKeywords = input
      .replace(/"/g, '')
      .split(/\s+OR\s+/i)
      .map(k => k.trim())
      .filter(Boolean);
  }

  // 🛑 If no keywords extracted → stop immediately
  if (!extractedKeywords.length) {
    console.warn('⚠️ No extracted keywords found — skipping LinkedIn scrape.');
    return [];
  }

  // 🧩 Build query string strictly from extracted keywords
  const sanitizedQuery = extractedKeywords.map(k => `"${k}"`).join(' OR ');
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
    sanitizedQuery
  )}&location=${encodeURIComponent(location)}`;

  console.log('🔑 Extracted Keywords:', extractedKeywords);
  console.log(`🔍 LinkedIn Query: ${sanitizedQuery}`);
  console.log(`🔗 Search URL: ${searchUrl}`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.jobs-search__results-list li, .base-card', { timeout: 8000 });
    await new Promise(r => setTimeout(r, 2000)); // Allow content to stabilize

    const rawJobs = await page.evaluate(() => {
      const jobCards = Array.from(document.querySelectorAll('.jobs-search__results-list li, .base-card'));

      return jobCards.map(card => {
        const title = card.querySelector('h3')?.innerText?.trim() || 'Untitled Role';
        const company = card.querySelector('.base-search-card__subtitle')?.innerText?.trim() || 'Unknown Company';
        const location = card.querySelector('.job-search-card__location')?.innerText?.trim() || 'Unknown Location';
        const url = card.querySelector('a')?.href || '#';
        const description = card.innerText?.toLowerCase() || '';
        const job_description = card.innerText?.slice(0, 500) || `${title} at ${company}`;

        const locationLower = location.toLowerCase();
        const job_country = /india|bengaluru|karnataka|mumbai|delhi|hyderabad|chennai|pune|noida|gurgaon|telangana|maharashtra/.test(locationLower)
          ? 'India'
          : 'Global';

        const work_mode = /remote/.test(description)
          ? 'Remote'
          : /hybrid/.test(description)
          ? 'Hybrid'
          : 'Onsite';

        return {
          title,
          company,
          location,
          url,
          job_description,
          work_mode,
          job_country,
          source: 'LinkedIn'
        };
      });
    });

    // 🧹 Filter jobs based on mode
    const jobs = rawJobs.filter(job => {
      if (!job || !job.job_description || job.job_description.length < 50) return false;
      if (workMode === 'All') return true;
      return job.work_mode.toLowerCase() === workMode.toLowerCase();
    });

    console.log(`✅ Scraped ${jobs.length} jobs from LinkedIn`);
    return jobs;
  } catch (err) {
    console.error('❌ LinkedIn scraping failed:', err.message);
    return [];
  } finally {
    await browser.close();
  }
}
