import axios from 'axios';

let isLocal = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
let puppeteer, chromium;

try {
  if (isLocal) {
    const pkg = await import('puppeteer');
    puppeteer = pkg.default || pkg;
    console.log('🧠 Using local Puppeteer');
  } else {
    const chrome = await import('@sparticuz/chromium');
    const core = await import('puppeteer-core');
    chromium = chrome.default || chrome;
    puppeteer = core.default || core;
    console.log('🧠 Using puppeteer-core + @sparticuz/chromium');
  }
} catch (err) {
  console.error('❌ Failed to import puppeteer/chromium:', err.message);
}

export async function scrapeLinkedInJobs(input = [], location = '', workMode = 'All') {
  let extractedKeywords = [];

  // 🔑 Extract keywords
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

  if (!extractedKeywords.length) {
    console.warn('⚠️ No extracted keywords found — skipping LinkedIn scrape.');
    return [];
  }

  const sanitizedQuery = extractedKeywords.map(k => `"${k}"`).join(' OR ');
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
    sanitizedQuery
  )}&location=${encodeURIComponent(location)}`;

  console.log('🔑 Extracted Keywords:', extractedKeywords);
  console.log(`🔍 LinkedIn Query: ${sanitizedQuery}`);
  console.log(`🔗 Search URL: ${searchUrl}`);
  console.log(`🌍 Environment: ${isLocal ? 'Local' : 'Vercel'}`);

  // ⚙️ Force fallback if on Vercel
  if (!isLocal) {
    console.log('⚙️ Skipping Puppeteer (LinkedIn blocks headless). Using Google fallback instead.');
    return await scrapeLinkedInViaGoogleFallback(sanitizedQuery, location, workMode);
  }

  // 🧩 Puppeteer run (local only)
  try {
    const launchOptions = { headless: 'new' };
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.jobs-search__results-list li, .base-card', { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1500));

    const rawJobs = await page.evaluate(() => {
      const jobCards = Array.from(
        document.querySelectorAll('.jobs-search__results-list li, .base-card')
      );
      return jobCards.map(card => {
        const title = card.querySelector('h3')?.innerText?.trim() || 'Untitled Role';
        const company =
          card.querySelector('.base-search-card__subtitle')?.innerText?.trim() ||
          'Unknown Company';
        const location =
          card.querySelector('.job-search-card__location')?.innerText?.trim() ||
          'Unknown Location';
        const url = card.querySelector('a')?.href || '#';
        const description = card.innerText?.toLowerCase() || '';

        const job_country = /india|bengaluru|mumbai|delhi|pune|hyderabad|chennai|noida|gurgaon/.test(
          location.toLowerCase()
        )
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
          job_description: description.slice(0, 500),
          work_mode,
          job_country,
          source: 'LinkedIn',
        };
      });
    });

    await browser.close();

    const jobs = rawJobs.filter(job => {
      if (!job.job_description || job.job_description.length < 50) return false;
      if (workMode === 'All') return true;
      return job.work_mode.toLowerCase() === workMode.toLowerCase();
    });

    console.log(`✅ Scraped ${jobs.length} jobs from LinkedIn`);
    return jobs;
  } catch (err) {
    console.error('❌ Puppeteer/LinkedIn failed:', err.message);
    console.log('⚙️ Falling back to Google site:linkedin.com/jobs...');
    return await scrapeLinkedInViaGoogleFallback(sanitizedQuery, location, workMode);
  }
}

// 🧠 Fallback scraper using Google CSE
async function scrapeLinkedInViaGoogleFallback(query, location = '', workMode = 'All') {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX_ID;

  if (!apiKey || !cx) {
    console.error('❌ Missing Google API credentials for fallback.');
    return [];
  }

  const googleQuery = `${query} site:linkedin.com/jobs`;
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    googleQuery
  )}&key=${apiKey}&cx=${cx}`;

  try {
    console.log(`🔍 Google Fallback Query: ${googleQuery}`);
    console.log(`🔗 API URL: ${url}`);

    const { data } = await axios.get(url);

    const jobs = (data.items || []).map(item => ({
      title: item.title || 'Untitled Role',
      company: item.displayLink || 'LinkedIn',
      location: location || 'Global',
      url: item.link,
      job_description: item.snippet?.slice(0, 500) || '',
      work_mode: /remote/i.test(item.snippet) ? 'Remote' : 'Onsite',
      job_country: location.toLowerCase().includes('india') ? 'India' : 'Global',
      source: 'LinkedIn (via Google)',
    }));

    console.log(`✅ Fallback scraped ${jobs.length} LinkedIn jobs via Google`);
    return jobs;
  } catch (err) {
    console.error('❌ Google fallback failed:', err.message);
    return [];
  }
}
