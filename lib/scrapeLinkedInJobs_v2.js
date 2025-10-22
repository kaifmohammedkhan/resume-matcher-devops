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
    console.warn(⚠️ No extracted keywords found — skipping LinkedIn scrape.');
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

  try {
    const executablePath = !isLocal ? await chromium.executablePath() : undefined;

    const launchOptions = isLocal
      ? { headless: 'new' }
      : {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath,
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        };

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // 🕵️‍♂️ Apply stealth mode headers
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/123.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua':
        '"Not.A/Brand";v="8", "Chromium";v="123", "Google Chrome";v="123"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    });

    // 🚫 Disable LinkedIn anti-bot detection scripts
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // 🧭 Go to LinkedIn Jobs
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
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
